using Hireflow.Application.Workspaces;
using Hireflow.Domain.Workspaces;
using Hireflow.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Hireflow.Infrastructure.Workspaces;

public sealed class WorkspaceMembershipService(HireflowDbContext dbContext, ILogger<WorkspaceMembershipService> logger)
    : IWorkspaceMembershipService
{
    public async Task<ChangeMemberRoleResult> ChangeRoleAsync(
        Guid workspaceId,
        Guid callerUserId,
        Guid targetUserId,
        ChangeMemberRoleRequest request,
        CancellationToken cancellationToken)
    {
        var callerRole = await WorkspaceAccessQueries.GetCallerRoleAsync(dbContext, workspaceId, callerUserId, cancellationToken);
        if (callerRole is null)
        {
            return ChangeMemberRoleResult.NotFound();
        }

        if (callerRole != WorkspaceRole.Owner)
        {
            return ChangeMemberRoleResult.Forbidden();
        }

        if (!Enum.TryParse<WorkspaceRole>(request.Role, ignoreCase: true, out var newRole))
        {
            return ChangeMemberRoleResult.ValidationFailed(["Role must be Owner, Recruiter, or Interviewer."]);
        }

        await using var transaction = await dbContext.Database.BeginTransactionAsync(cancellationToken);

        // Locks every Owner row in this workspace for the duration of the transaction,
        // so a concurrent demotion/removal of the last Owner serializes against this one
        // instead of both reading a stale Owner count.
        await LockOwnerRowsAsync(workspaceId, cancellationToken);

        var target = await dbContext.WorkspaceMembers
            .SingleOrDefaultAsync(member => member.WorkspaceId == workspaceId && member.UserId == targetUserId, cancellationToken);
        if (target is null)
        {
            await transaction.RollbackAsync(cancellationToken);
            return ChangeMemberRoleResult.NotFound();
        }

        if (target.Role == WorkspaceRole.Owner && newRole != WorkspaceRole.Owner)
        {
            var ownerCount = await dbContext.WorkspaceMembers
                .CountAsync(member => member.WorkspaceId == workspaceId && member.Role == WorkspaceRole.Owner, cancellationToken);
            if (ownerCount <= 1)
            {
                await transaction.RollbackAsync(cancellationToken);
                return ChangeMemberRoleResult.LastOwner();
            }
        }

        target.Role = newRole;
        await dbContext.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);

        logger.LogInformation(
            "Member {TargetUserId} in workspace {WorkspaceId} changed to role {Role} by {CallerUserId}.",
            targetUserId, workspaceId, newRole, callerUserId);

        return ChangeMemberRoleResult.Success();
    }

    public async Task<RemoveMemberOutcome> RemoveAsync(
        Guid workspaceId,
        Guid callerUserId,
        Guid targetUserId,
        CancellationToken cancellationToken)
    {
        var callerRole = await WorkspaceAccessQueries.GetCallerRoleAsync(dbContext, workspaceId, callerUserId, cancellationToken);
        if (callerRole is null)
        {
            return RemoveMemberOutcome.NotFound;
        }

        if (callerRole != WorkspaceRole.Owner)
        {
            return RemoveMemberOutcome.Forbidden;
        }

        await using var transaction = await dbContext.Database.BeginTransactionAsync(cancellationToken);

        await LockOwnerRowsAsync(workspaceId, cancellationToken);

        var target = await dbContext.WorkspaceMembers
            .SingleOrDefaultAsync(member => member.WorkspaceId == workspaceId && member.UserId == targetUserId, cancellationToken);
        if (target is null)
        {
            await transaction.RollbackAsync(cancellationToken);
            return RemoveMemberOutcome.NotFound;
        }

        if (target.Role == WorkspaceRole.Owner)
        {
            var ownerCount = await dbContext.WorkspaceMembers
                .CountAsync(member => member.WorkspaceId == workspaceId && member.Role == WorkspaceRole.Owner, cancellationToken);
            if (ownerCount <= 1)
            {
                await transaction.RollbackAsync(cancellationToken);
                return RemoveMemberOutcome.LastOwner;
            }
        }

        // Removes only the WorkspaceMember row; the Identity account is untouched.
        dbContext.WorkspaceMembers.Remove(target);
        await dbContext.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);

        logger.LogInformation(
            "Member {TargetUserId} removed from workspace {WorkspaceId} by {CallerUserId}.",
            targetUserId, workspaceId, callerUserId);

        return RemoveMemberOutcome.Success;
    }

    private Task LockOwnerRowsAsync(Guid workspaceId, CancellationToken cancellationToken) =>
        dbContext.Database.ExecuteSqlInterpolatedAsync(
            $"""
             SELECT 1 FROM "WorkspaceMembers"
             WHERE "WorkspaceId" = {workspaceId} AND "Role" = 'Owner'
             FOR UPDATE
             """,
            cancellationToken);
}
