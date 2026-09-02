namespace Hireflow.Domain.Workspaces;

/// <summary>
/// Membership of one Identity user in one workspace. The composite
/// (<see cref="WorkspaceId" />, <see cref="UserId" />) key is the tenant authorization
/// boundary: every tenant-scoped read or write must go through this table.
/// </summary>
public sealed class WorkspaceMember
{
    public required Guid WorkspaceId { get; init; }

    /// <summary>The stable Identity user key. Domain does not reference the Identity user type.</summary>
    public required Guid UserId { get; init; }

    public required WorkspaceRole Role { get; set; }

    public required DateTimeOffset JoinedAt { get; init; }

    public Workspace? Workspace { get; init; }
}
