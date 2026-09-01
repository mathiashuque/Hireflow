using Hireflow.Api.Authentication;
using Hireflow.Application.Common;
using Hireflow.Application.Workspaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.ModelBinding;

namespace Hireflow.Api.Controllers;

[ApiController]
[Route("api/workspaces")]
[Authorize]
public sealed class WorkspacesController(IWorkspaceService workspaceService, ICurrentUser currentUser)
    : ControllerBase
{
    [HttpPost]
    [ValidateCsrfToken]
    public async Task<ActionResult<WorkspaceDetailResponse>> Create(
        [FromBody] CreateWorkspaceRequest request,
        CancellationToken cancellationToken)
    {
        var result = await workspaceService.CreateAsync(currentUser.UserId, request, cancellationToken);

        return result.Outcome switch
        {
            CreateWorkspaceOutcome.Success => Ok(result.Workspace),
            CreateWorkspaceOutcome.ValidationFailed => ValidationProblem(ToModelState(nameof(request.Name), result.Errors)),
            CreateWorkspaceOutcome.SlugConflict => Problem(
                title: "Workspace creation failed",
                detail: result.Errors.FirstOrDefault(),
                statusCode: StatusCodes.Status409Conflict),
            _ => Problem(statusCode: StatusCodes.Status500InternalServerError),
        };
    }

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<WorkspaceSummaryResponse>>> List(CancellationToken cancellationToken)
    {
        var workspaces = await workspaceService.ListForUserAsync(currentUser.UserId, cancellationToken);
        return Ok(workspaces);
    }

    [HttpGet("{workspaceId:guid}")]
    public async Task<ActionResult<WorkspaceDetailResponse>> GetById(Guid workspaceId, CancellationToken cancellationToken)
    {
        var workspace = await workspaceService.GetDetailAsync(currentUser.UserId, workspaceId, cancellationToken);

        // A nonmember gets the same 404 as a nonexistent workspace: existence must not
        // be observable across the tenant boundary.
        return workspace is null ? NotFound() : Ok(workspace);
    }

    [HttpGet("{workspaceId:guid}/members")]
    public async Task<ActionResult<IReadOnlyList<WorkspaceMemberResponse>>> GetMembers(
        Guid workspaceId,
        CancellationToken cancellationToken)
    {
        var members = await workspaceService.ListMembersAsync(currentUser.UserId, workspaceId, cancellationToken);
        return members is null ? NotFound() : Ok(members);
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
