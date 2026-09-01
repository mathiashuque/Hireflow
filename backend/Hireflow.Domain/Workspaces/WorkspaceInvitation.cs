namespace Hireflow.Domain.Workspaces;

/// <summary>
/// A tenant-owned, single-use invitation for someone to join a workspace at a given
/// role. The raw invitation secret is never stored; <see cref="TokenHash" /> is a
/// non-recoverable verifier computed from it.
/// </summary>
public sealed class WorkspaceInvitation
{
    public required Guid Id { get; init; }

    public required Guid WorkspaceId { get; init; }

    /// <summary>The invitee's email as entered, for display.</summary>
    public required string Email { get; init; }

    /// <summary>The invitee's email normalized the same way Identity normalizes account emails.</summary>
    public required string NormalizedEmail { get; init; }

    /// <summary>Always <see cref="WorkspaceRole.Recruiter" /> or <see cref="WorkspaceRole.Interviewer" />; an invitation never grants Owner.</summary>
    public required WorkspaceRole Role { get; init; }

    /// <summary>A non-recoverable hash of the one-time invitation secret.</summary>
    public required string TokenHash { get; init; }

    public required Guid InvitedByUserId { get; init; }

    public required DateTimeOffset CreatedAt { get; init; }

    public required DateTimeOffset ExpiresAt { get; init; }

    public DateTimeOffset? AcceptedAt { get; set; }

    public Guid? AcceptedByUserId { get; set; }

    public DateTimeOffset? RevokedAt { get; set; }
}
