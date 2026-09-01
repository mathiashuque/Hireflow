using System.Text.RegularExpressions;
using Hireflow.Application.Workspaces;
using Hireflow.Domain.Workspaces;
using Hireflow.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Npgsql;

namespace Hireflow.Infrastructure.Workspaces;

public sealed partial class WorkspaceService(
    HireflowDbContext dbContext,
    TimeProvider timeProvider,
    ILogger<WorkspaceService> logger)
    : IWorkspaceService
{
    private const int MaxSlugAttempts = 25;

    public async Task<CreateWorkspaceResult> CreateAsync(
        Guid ownerUserId,
        CreateWorkspaceRequest request,
        CancellationToken cancellationToken)
    {
        var name = request.Name.Trim();
        if (name.Length is 0 or > 200)
        {
            return CreateWorkspaceResult.ValidationFailed(["Workspace name must be between 1 and 200 characters."]);
        }

        var baseSlug = NormalizeSlug(request.Slug is { Length: > 0 } slug ? slug : name);
        var now = timeProvider.GetUtcNow();

        // Every candidate is attempted inside its own transaction so a unique-slug
        // violation from a concurrent create rolls back cleanly and never leaves a
        // partially written workspace or overwrites the row that won the race.
        for (var attempt = 0; attempt < MaxSlugAttempts; attempt++)
        {
            var candidateSlug = attempt == 0 ? baseSlug : $"{baseSlug}-{attempt + 1}";

            var workspace = new Workspace
            {
                Id = Guid.NewGuid(),
                Name = name,
                Slug = candidateSlug,
                CreatedAt = now,
            };

            var membership = new WorkspaceMember
            {
                WorkspaceId = workspace.Id,
                UserId = ownerUserId,
                Role = WorkspaceRole.Owner,
                JoinedAt = now,
            };

            dbContext.Workspaces.Add(workspace);
            dbContext.WorkspaceMembers.Add(membership);

            await using var transaction = await dbContext.Database.BeginTransactionAsync(cancellationToken);
            try
            {
                // Both inserts commit together: an observer never sees a workspace
                // without its creator's Owner membership.
                await dbContext.SaveChangesAsync(cancellationToken);
                await transaction.CommitAsync(cancellationToken);

                logger.LogInformation("Workspace {WorkspaceId} created by user {UserId}.", workspace.Id, ownerUserId);

                return CreateWorkspaceResult.Success(new WorkspaceDetailResponse(
                    workspace.Id,
                    workspace.Name,
                    workspace.Slug,
                    workspace.CreatedAt,
                    WorkspaceRole.Owner.ToString()));
            }
            catch (DbUpdateException ex) when (IsUniqueSlugViolation(ex))
            {
                await transaction.RollbackAsync(cancellationToken);
                dbContext.Entry(workspace).State = EntityState.Detached;
                dbContext.Entry(membership).State = EntityState.Detached;
                logger.LogInformation("Workspace slug {Slug} already taken; retrying with a suffixed slug.", candidateSlug);
            }
        }

        logger.LogInformation("Exhausted {MaxAttempts} slug candidates for workspace creation by user {UserId}.", MaxSlugAttempts, ownerUserId);
        return CreateWorkspaceResult.SlugConflict();
    }

    public async Task<IReadOnlyList<WorkspaceSummaryResponse>> ListForUserAsync(Guid userId, CancellationToken cancellationToken) =>
        await dbContext.WorkspaceMembers
            .Where(member => member.UserId == userId)
            .OrderBy(member => member.Workspace!.Name)
            .ThenBy(member => member.WorkspaceId)
            .Select(member => new WorkspaceSummaryResponse(
                member.WorkspaceId,
                member.Workspace!.Name,
                member.Workspace.Slug,
                member.Workspace.CreatedAt,
                member.Role.ToString()))
            .ToArrayAsync(cancellationToken);

    public async Task<WorkspaceDetailResponse?> GetDetailAsync(Guid userId, Guid workspaceId, CancellationToken cancellationToken)
    {
        return await dbContext.WorkspaceMembers
            .Where(member => member.WorkspaceId == workspaceId && member.UserId == userId)
            .Select(member => new WorkspaceDetailResponse(
                member.WorkspaceId,
                member.Workspace!.Name,
                member.Workspace.Slug,
                member.Workspace.CreatedAt,
                member.Role.ToString()))
            .SingleOrDefaultAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<WorkspaceMemberResponse>?> ListMembersAsync(
        Guid userId,
        Guid workspaceId,
        CancellationToken cancellationToken)
    {
        // Membership is confirmed as its own scoped query before any member data is
        // read, so a nonmember never learns whether the workspace exists.
        var isMember = await dbContext.WorkspaceMembers
            .AnyAsync(member => member.WorkspaceId == workspaceId && member.UserId == userId, cancellationToken);

        if (!isMember)
        {
            return null;
        }

        return await (
                from member in dbContext.WorkspaceMembers
                join user in dbContext.Users on member.UserId equals user.Id
                where member.WorkspaceId == workspaceId
                orderby member.JoinedAt, member.UserId
                select new WorkspaceMemberResponse(member.UserId, user.DisplayName, member.Role.ToString(), member.JoinedAt))
            .ToArrayAsync(cancellationToken);
    }

    private static bool IsUniqueSlugViolation(DbUpdateException exception) =>
        exception.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation };

    private static string NormalizeSlug(string input)
    {
        var lowered = input.Trim().ToLowerInvariant();
        var normalized = NonSlugCharacters().Replace(lowered, "-").Trim('-');

        if (normalized.Length > 80)
        {
            normalized = normalized[..80].Trim('-');
        }

        return normalized.Length == 0 ? "workspace" : normalized;
    }

    [GeneratedRegex("[^a-z0-9]+")]
    private static partial Regex NonSlugCharacters();
}
