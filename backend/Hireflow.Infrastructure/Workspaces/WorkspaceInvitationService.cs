using System.Security.Cryptography;
using System.Text;
using Hireflow.Application.Workspaces;
using Hireflow.Domain.Workspaces;
using Hireflow.Infrastructure.Identity;
using Hireflow.Infrastructure.Persistence;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Npgsql;

namespace Hireflow.Infrastructure.Workspaces;

public sealed class WorkspaceInvitationService(
    HireflowDbContext dbContext,
    UserManager<HireflowUser> userManager,
    TimeProvider timeProvider,
    IOptions<WorkspaceInvitationOptions> options,
    ILogger<WorkspaceInvitationService> logger)
    : IWorkspaceInvitationService
{
    public async Task<CreateInvitationResult> CreateAsync(
        Guid workspaceId,
        Guid callerUserId,
        CreateInvitationRequest request,
        CancellationToken cancellationToken)
    {
        var callerRole = await WorkspaceAccessQueries.GetCallerRoleAsync(dbContext, workspaceId, callerUserId, cancellationToken);
        if (callerRole is null)
        {
            return CreateInvitationResult.NotFound();
        }

        if (callerRole != WorkspaceRole.Owner)
        {
            return CreateInvitationResult.Forbidden();
        }

        if (!Enum.TryParse<WorkspaceRole>(request.Role, ignoreCase: true, out var invitedRole)
            || invitedRole is not (WorkspaceRole.Recruiter or WorkspaceRole.Interviewer))
        {
            return CreateInvitationResult.ValidationFailed(["Role must be Recruiter or Interviewer."]);
        }

        var email = request.Email.Trim();
        var normalizedEmail = userManager.NormalizeEmail(email) ?? email.ToUpperInvariant();

        var alreadyMember = await dbContext.WorkspaceMembers
            .AnyAsync(
                member => member.WorkspaceId == workspaceId && dbContext.Users.Any(
                    user => user.Id == member.UserId && user.NormalizedEmail == normalizedEmail),
                cancellationToken);
        if (alreadyMember)
        {
            return CreateInvitationResult.AlreadyMember();
        }

        var now = timeProvider.GetUtcNow();

        await using var transaction = await dbContext.Database.BeginTransactionAsync(cancellationToken);

        var existing = await dbContext.WorkspaceInvitations
            .Where(invitation =>
                invitation.WorkspaceId == workspaceId &&
                invitation.NormalizedEmail == normalizedEmail &&
                invitation.AcceptedAt == null &&
                invitation.RevokedAt == null)
            .SingleOrDefaultAsync(cancellationToken);

        if (existing is not null)
        {
            if (existing.ExpiresAt > now)
            {
                await transaction.RollbackAsync(cancellationToken);
                return CreateInvitationResult.DuplicateActiveInvitation();
            }

            // The prior invitation expired without being accepted or revoked; supersede
            // it so the new one doesn't collide with the active-invitation index.
            existing.RevokedAt = now;
        }

        var (token, tokenHash) = GenerateToken();
        var invitation = new WorkspaceInvitation
        {
            Id = Guid.NewGuid(),
            WorkspaceId = workspaceId,
            Email = email,
            NormalizedEmail = normalizedEmail,
            Role = invitedRole,
            TokenHash = tokenHash,
            InvitedByUserId = callerUserId,
            CreatedAt = now,
            ExpiresAt = now.AddDays(options.Value.LifetimeDays),
        };

        dbContext.WorkspaceInvitations.Add(invitation);

        try
        {
            await dbContext.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);
        }
        catch (DbUpdateException ex) when (IsUniqueViolation(ex))
        {
            await transaction.RollbackAsync(cancellationToken);
            logger.LogInformation("Concurrent invitation create collided for workspace {WorkspaceId}.", workspaceId);
            return CreateInvitationResult.DuplicateActiveInvitation();
        }

        logger.LogInformation("Invitation {InvitationId} created for workspace {WorkspaceId} by user {UserId}.", invitation.Id, workspaceId, callerUserId);

        return CreateInvitationResult.Success(new InvitationCreatedResponse(
            invitation.Id, invitation.Email, invitation.Role.ToString(), invitation.ExpiresAt, token));
    }

    public async Task<ListInvitationsResult> ListAsync(Guid workspaceId, Guid callerUserId, CancellationToken cancellationToken)
    {
        var callerRole = await WorkspaceAccessQueries.GetCallerRoleAsync(dbContext, workspaceId, callerUserId, cancellationToken);
        if (callerRole is null)
        {
            return ListInvitationsResult.NotFound();
        }

        if (callerRole != WorkspaceRole.Owner)
        {
            return ListInvitationsResult.Forbidden();
        }

        var invitations = await (
                from invitation in dbContext.WorkspaceInvitations
                join inviter in dbContext.Users on invitation.InvitedByUserId equals inviter.Id
                where invitation.WorkspaceId == workspaceId && invitation.AcceptedAt == null && invitation.RevokedAt == null
                orderby invitation.CreatedAt, invitation.Id
                select new PendingInvitationResponse(
                    invitation.Id,
                    invitation.Email,
                    invitation.Role.ToString(),
                    invitation.CreatedAt,
                    invitation.ExpiresAt,
                    invitation.InvitedByUserId,
                    inviter.DisplayName))
            .ToArrayAsync(cancellationToken);

        return ListInvitationsResult.Success(invitations);
    }

    public async Task<RevokeInvitationOutcome> RevokeAsync(
        Guid workspaceId,
        Guid callerUserId,
        Guid invitationId,
        CancellationToken cancellationToken)
    {
        var callerRole = await WorkspaceAccessQueries.GetCallerRoleAsync(dbContext, workspaceId, callerUserId, cancellationToken);
        if (callerRole is null)
        {
            return RevokeInvitationOutcome.NotFound;
        }

        if (callerRole != WorkspaceRole.Owner)
        {
            return RevokeInvitationOutcome.Forbidden;
        }

        var now = timeProvider.GetUtcNow();

        // A guessed invitation id from another workspace, or one already consumed, is
        // indistinguishable from "not found" — this is an Owner-scoped 404, not a
        // cross-tenant leak, since the caller's own membership was already confirmed.
        var rowsAffected = await dbContext.WorkspaceInvitations
            .Where(invitation =>
                invitation.Id == invitationId &&
                invitation.WorkspaceId == workspaceId &&
                invitation.AcceptedAt == null &&
                invitation.RevokedAt == null)
            .ExecuteUpdateAsync(setters => setters.SetProperty(invitation => invitation.RevokedAt, now), cancellationToken);

        return rowsAffected == 1 ? RevokeInvitationOutcome.Success : RevokeInvitationOutcome.NotFound;
    }

    public async Task<AcceptInvitationResult> AcceptAsync(string token, Guid callerUserId, CancellationToken cancellationToken)
    {
        var tokenHash = HashToken(token);
        var now = timeProvider.GetUtcNow();

        var caller = await dbContext.Users
            .Where(user => user.Id == callerUserId)
            .Select(user => new { user.NormalizedEmail })
            .SingleOrDefaultAsync(cancellationToken);
        if (caller?.NormalizedEmail is null)
        {
            return AcceptInvitationResult.InvalidOrExpired();
        }

        await using var transaction = await dbContext.Database.BeginTransactionAsync(cancellationToken);

        var invitation = await dbContext.WorkspaceInvitations
            .SingleOrDefaultAsync(candidate => candidate.TokenHash == tokenHash, cancellationToken);

        var isUsable = invitation is not null
            && invitation.AcceptedAt is null
            && invitation.RevokedAt is null
            && invitation.ExpiresAt > now
            && invitation.NormalizedEmail == caller.NormalizedEmail;

        if (!isUsable)
        {
            await transaction.RollbackAsync(cancellationToken);
            return AcceptInvitationResult.InvalidOrExpired();
        }

        // A compare-and-set update: if a concurrent request already consumed this
        // invitation, exactly one of the racing requests sees rowsAffected == 1.
        var rowsAffected = await dbContext.WorkspaceInvitations
            .Where(candidate => candidate.Id == invitation!.Id && candidate.AcceptedAt == null && candidate.RevokedAt == null)
            .ExecuteUpdateAsync(
                setters => setters
                    .SetProperty(candidate => candidate.AcceptedAt, now)
                    .SetProperty(candidate => candidate.AcceptedByUserId, callerUserId),
                cancellationToken);

        if (rowsAffected != 1)
        {
            await transaction.RollbackAsync(cancellationToken);
            return AcceptInvitationResult.InvalidOrExpired();
        }

        dbContext.WorkspaceMembers.Add(new WorkspaceMember
        {
            WorkspaceId = invitation!.WorkspaceId,
            UserId = callerUserId,
            Role = invitation.Role,
            JoinedAt = now,
        });

        try
        {
            await dbContext.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);
        }
        catch (DbUpdateException ex) when (IsUniqueViolation(ex))
        {
            // Already a member somehow (e.g. joined another way between the checks
            // above and now); the invitation is still consumed, so treat this as a
            // generic failure rather than a partial success.
            await transaction.RollbackAsync(cancellationToken);
            logger.LogInformation("Invitation {InvitationId} acceptance collided with existing membership.", invitation.Id);
            return AcceptInvitationResult.InvalidOrExpired();
        }

        logger.LogInformation("Invitation {InvitationId} accepted by user {UserId}.", invitation.Id, callerUserId);
        return AcceptInvitationResult.Success(invitation.WorkspaceId);
    }

    private static (string Token, string TokenHash) GenerateToken()
    {
        var token = Convert.ToHexStringLower(RandomNumberGenerator.GetBytes(32));
        return (token, HashToken(token));
    }

    private static string HashToken(string token) =>
        Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(token)));

    private static bool IsUniqueViolation(DbUpdateException exception) =>
        exception.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation };
}
