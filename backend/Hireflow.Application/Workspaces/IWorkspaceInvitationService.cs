namespace Hireflow.Application.Workspaces;

/// <summary>
/// Orchestrates invitation creation, listing, revocation, and acceptance behind
/// <c>/api/workspaces/{workspaceId}/invitations</c> and <c>/api/invitations/{token}</c>.
/// </summary>
public interface IWorkspaceInvitationService
{
    Task<CreateInvitationResult> CreateAsync(
        Guid workspaceId,
        Guid callerUserId,
        CreateInvitationRequest request,
        CancellationToken cancellationToken);

    Task<ListInvitationsResult> ListAsync(Guid workspaceId, Guid callerUserId, CancellationToken cancellationToken);

    Task<RevokeInvitationOutcome> RevokeAsync(
        Guid workspaceId,
        Guid callerUserId,
        Guid invitationId,
        CancellationToken cancellationToken);

    /// <summary>
    /// Accepts an invitation on behalf of the authenticated caller. The token is the
    /// sole route parameter: acceptance is scoped to the token, not to a workspace
    /// route, and never trusts a caller-supplied workspace id or email.
    /// </summary>
    Task<AcceptInvitationResult> AcceptAsync(string token, Guid callerUserId, CancellationToken cancellationToken);
}
