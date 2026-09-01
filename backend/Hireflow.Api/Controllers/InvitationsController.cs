using Hireflow.Api.Authentication;
using Hireflow.Application.Common;
using Hireflow.Application.Workspaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Hireflow.Api.Controllers;

/// <summary>
/// Invitation acceptance is scoped to the token itself, not to a workspace route: the
/// token is the only thing that identifies which invitation is being acted on.
/// </summary>
[ApiController]
[Route("api/invitations")]
[Authorize]
public sealed class InvitationsController(IWorkspaceInvitationService invitationService, ICurrentUser currentUser)
    : ControllerBase
{
    [HttpPost("{token}/accept")]
    [ValidateCsrfToken]
    public async Task<IActionResult> Accept(string token, CancellationToken cancellationToken)
    {
        var result = await invitationService.AcceptAsync(token, currentUser.UserId, cancellationToken);

        return result.Outcome switch
        {
            AcceptInvitationOutcome.Success => Ok(new AcceptedInvitationResponse(result.WorkspaceId!.Value)),
            // Deliberately identical for invalid, expired, revoked, already-used, and
            // wrong-account tokens: none of those states may be distinguished by a caller.
            AcceptInvitationOutcome.InvalidOrExpired => Problem(
                title: "Invitation unavailable",
                detail: "This invitation link is invalid, expired, or no longer available.",
                statusCode: StatusCodes.Status410Gone),
            _ => Problem(statusCode: StatusCodes.Status500InternalServerError),
        };
    }
}
