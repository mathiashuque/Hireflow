using Hireflow.Api.Authentication;
using Hireflow.Api.Errors;
using Hireflow.Application.Common;
using Hireflow.Application.Workspaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Hireflow.Api.Controllers;

[ApiController]
[Route("api/workspaces/{workspaceId:guid}/invitations")]
[Authorize]
public sealed class WorkspaceInvitationsController(IWorkspaceInvitationService invitationService, ICurrentUser currentUser)
    : ControllerBase
{
    [HttpPost]
    [ValidateCsrfToken]
    public async Task<ActionResult<InvitationCreatedResponse>> Create(
        Guid workspaceId,
        [FromBody] CreateInvitationRequest request,
        CancellationToken cancellationToken)
    {
        var result = await invitationService.CreateAsync(workspaceId, currentUser.UserId, request, cancellationToken);

        return result.Outcome switch
        {
            CreateInvitationOutcome.Success => Ok(result.Invitation),
            CreateInvitationOutcome.NotFound => NotFound(),
            CreateInvitationOutcome.Forbidden => Forbid(),
            CreateInvitationOutcome.ValidationFailed => this.ValidationProblemWithCode(
                ProblemResultExtensions.ToModelState(nameof(request.Role), result.Errors)),
            CreateInvitationOutcome.AlreadyMember => this.ProblemWithCode(
                StatusCodes.Status409Conflict,
                ProblemCodes.InvitationAlreadyMember,
                title: "Invitation failed",
                detail: result.Errors.FirstOrDefault()),
            CreateInvitationOutcome.DuplicateActiveInvitation => this.ProblemWithCode(
                StatusCodes.Status409Conflict,
                ProblemCodes.InvitationDuplicate,
                title: "Invitation failed",
                detail: result.Errors.FirstOrDefault()),
            _ => Problem(statusCode: StatusCodes.Status500InternalServerError),
        };
    }

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<PendingInvitationResponse>>> List(Guid workspaceId, CancellationToken cancellationToken)
    {
        var result = await invitationService.ListAsync(workspaceId, currentUser.UserId, cancellationToken);

        return result.Outcome switch
        {
            ListInvitationsOutcome.Success => Ok(result.Invitations),
            ListInvitationsOutcome.NotFound => NotFound(),
            ListInvitationsOutcome.Forbidden => Forbid(),
            _ => Problem(statusCode: StatusCodes.Status500InternalServerError),
        };
    }

    [HttpDelete("{invitationId:guid}")]
    [ValidateCsrfToken]
    public async Task<IActionResult> Revoke(Guid workspaceId, Guid invitationId, CancellationToken cancellationToken)
    {
        var outcome = await invitationService.RevokeAsync(workspaceId, currentUser.UserId, invitationId, cancellationToken);

        return outcome switch
        {
            RevokeInvitationOutcome.Success => NoContent(),
            RevokeInvitationOutcome.NotFound => NotFound(),
            RevokeInvitationOutcome.Forbidden => Forbid(),
            _ => Problem(statusCode: StatusCodes.Status500InternalServerError),
        };
    }
}
