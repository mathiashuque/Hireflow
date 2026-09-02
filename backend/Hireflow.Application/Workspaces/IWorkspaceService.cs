namespace Hireflow.Application.Workspaces;

/// <summary>
/// Orchestrates workspace use cases behind <c>/api/workspaces</c>. Implemented in
/// Infrastructure against EF Core; every read here enforces workspace membership at
/// the query boundary rather than fetching globally and authorizing afterward.
/// </summary>
public interface IWorkspaceService
{
    Task<CreateWorkspaceResult> CreateAsync(Guid ownerUserId, CreateWorkspaceRequest request, CancellationToken cancellationToken);

    /// <summary>Workspaces where the given user is a member, ordered by name then id.</summary>
    Task<IReadOnlyList<WorkspaceSummaryResponse>> ListForUserAsync(Guid userId, CancellationToken cancellationToken);

    /// <summary>The workspace's detail, or <c>null</c> if it does not exist or the user is not a member.</summary>
    Task<WorkspaceDetailResponse?> GetDetailAsync(Guid userId, Guid workspaceId, CancellationToken cancellationToken);

    /// <summary>The workspace's members, or <c>null</c> if it does not exist or the user is not a member.</summary>
    Task<IReadOnlyList<WorkspaceMemberResponse>?> ListMembersAsync(Guid userId, Guid workspaceId, CancellationToken cancellationToken);
}
