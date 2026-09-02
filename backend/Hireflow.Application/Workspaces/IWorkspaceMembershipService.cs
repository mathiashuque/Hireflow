namespace Hireflow.Application.Workspaces;

/// <summary>
/// Orchestrates Owner-only member management behind
/// <c>/api/workspaces/{workspaceId}/members/{userId}</c>.
/// </summary>
public interface IWorkspaceMembershipService
{
    Task<ChangeMemberRoleResult> ChangeRoleAsync(
        Guid workspaceId,
        Guid callerUserId,
        Guid targetUserId,
        ChangeMemberRoleRequest request,
        CancellationToken cancellationToken);

    Task<RemoveMemberOutcome> RemoveAsync(
        Guid workspaceId,
        Guid callerUserId,
        Guid targetUserId,
        CancellationToken cancellationToken);
}
