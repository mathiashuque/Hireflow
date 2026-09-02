using System.ComponentModel.DataAnnotations;

namespace Hireflow.Application.Workspaces;

/// <summary>Request body for <c>POST /api/workspaces/{workspaceId}/invitations</c>.</summary>
public sealed class CreateInvitationRequest
{
    [Required]
    [EmailAddress]
    [MaxLength(256)]
    public required string Email { get; init; }

    /// <summary><c>"Recruiter"</c> or <c>"Interviewer"</c>; Owner cannot be granted through an invitation.</summary>
    [Required]
    public required string Role { get; init; }
}

/// <summary>
/// The invitation as returned exactly once, immediately after creation. Includes the
/// only copy of the raw token the API will ever return.
/// </summary>
public sealed record InvitationCreatedResponse(Guid Id, string Email, string Role, DateTimeOffset ExpiresAt, string Token);

/// <summary>An unconsumed invitation as it appears in the Owner's pending list. Never includes the token.</summary>
public sealed record PendingInvitationResponse(
    Guid Id,
    string Email,
    string Role,
    DateTimeOffset CreatedAt,
    DateTimeOffset ExpiresAt,
    Guid InvitedByUserId,
    string InvitedByDisplayName);

public enum CreateInvitationOutcome
{
    Success,
    NotFound,
    Forbidden,
    ValidationFailed,
    AlreadyMember,
    DuplicateActiveInvitation,
}

public sealed record CreateInvitationResult(CreateInvitationOutcome Outcome, InvitationCreatedResponse? Invitation, IReadOnlyList<string> Errors)
{
    public static CreateInvitationResult Success(InvitationCreatedResponse invitation) =>
        new(CreateInvitationOutcome.Success, invitation, []);

    public static CreateInvitationResult NotFound() => new(CreateInvitationOutcome.NotFound, null, []);

    public static CreateInvitationResult Forbidden() => new(CreateInvitationOutcome.Forbidden, null, []);

    public static CreateInvitationResult ValidationFailed(IReadOnlyList<string> errors) =>
        new(CreateInvitationOutcome.ValidationFailed, null, errors);

    public static CreateInvitationResult AlreadyMember() =>
        new(CreateInvitationOutcome.AlreadyMember, null, ["This email already belongs to a member of the workspace."]);

    public static CreateInvitationResult DuplicateActiveInvitation() =>
        new(CreateInvitationOutcome.DuplicateActiveInvitation, null, ["An active invitation already exists for this email."]);
}

public enum ListInvitationsOutcome
{
    Success,
    NotFound,
    Forbidden,
}

public sealed record ListInvitationsResult(ListInvitationsOutcome Outcome, IReadOnlyList<PendingInvitationResponse>? Invitations)
{
    public static ListInvitationsResult Success(IReadOnlyList<PendingInvitationResponse> invitations) =>
        new(ListInvitationsOutcome.Success, invitations);

    public static ListInvitationsResult NotFound() => new(ListInvitationsOutcome.NotFound, null);

    public static ListInvitationsResult Forbidden() => new(ListInvitationsOutcome.Forbidden, null);
}

public enum RevokeInvitationOutcome
{
    Success,
    NotFound,
    Forbidden,
}

/// <summary>
/// A single generic outcome covers every way acceptance can fail (invalid, expired,
/// revoked, already used, or wrong account) so a caller can never distinguish them.
/// </summary>
public enum AcceptInvitationOutcome
{
    Success,
    InvalidOrExpired,
}

public sealed record AcceptInvitationResult(AcceptInvitationOutcome Outcome, Guid? WorkspaceId)
{
    public static AcceptInvitationResult Success(Guid workspaceId) => new(AcceptInvitationOutcome.Success, workspaceId);

    public static AcceptInvitationResult InvalidOrExpired() => new(AcceptInvitationOutcome.InvalidOrExpired, null);
}

/// <summary>Response body for <c>POST /api/invitations/{token}/accept</c>.</summary>
public sealed record AcceptedInvitationResponse(Guid WorkspaceId);
