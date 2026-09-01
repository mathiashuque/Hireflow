using Hireflow.Api.Authentication;
using Hireflow.Application.Common;
using Hireflow.Application.Workspaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.ModelBinding;

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
            CreateInvitationOutcome.ValidationFailed => ValidationProblem(ToModelState(nameof(request.Role), result.Errors)),
            CreateInvitationOutcome.AlreadyMember => Problem(
                title: "Invitation failed",
                detail: result.Errors.FirstOrDefault(),
                statusCode: StatusCodes.Status409Conflict),
            CreateInvitationOutcome.DuplicateActiveInvitation => Problem(
                title: "Invitation failed",
                detail: result.Errors.FirstOrDefault(),
                statusCode: StatusCodes.Status409Conflict),
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

    private static ModelStateDictionary ToModelState(string key, IReadOnlyList<string> errors)
    {
        var modelState = new ModelStateDictionary();
        foreach (var error in errors)
        {
            modelState.AddModelError(key, error);
        }

        return modelState;
    }
}
