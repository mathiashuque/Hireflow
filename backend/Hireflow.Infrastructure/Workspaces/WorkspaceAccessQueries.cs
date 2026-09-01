using Hireflow.Domain.Workspaces;
using Hireflow.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Hireflow.Infrastructure.Workspaces;

/// <summary>
/// A single, reusable membership/role lookup shared by every workspace-scoped service
/// so tenant and role checks are never duplicated or reimplemented per feature.
/// </summary>
internal static class WorkspaceAccessQueries
{
    /// <summary>The caller's role in the workspace, or <c>null</c> if they are not a member (including a nonexistent workspace).</summary>
    public static Task<WorkspaceRole?> GetCallerRoleAsync(
        HireflowDbContext dbContext,
        Guid workspaceId,
        Guid userId,
        CancellationToken cancellationToken) =>
        dbContext.WorkspaceMembers
            .Where(member => member.WorkspaceId == workspaceId && member.UserId == userId)
            .Select(member => (WorkspaceRole?)member.Role)
            .SingleOrDefaultAsync(cancellationToken);
}
