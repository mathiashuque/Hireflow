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
public sealed class WorkspacesController(
    IWorkspaceService workspaceService,
    IWorkspaceMembershipService membershipService,
    IWorkspaceOverviewService overviewService,
    ICurrentUser currentUser)
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

    [HttpGet("{workspaceId:guid}/overview")]
    public async Task<ActionResult<WorkspaceOverviewResponse>> GetOverview(
        Guid workspaceId,
        [FromQuery] int? activityLimit,
        CancellationToken cancellationToken)
    {
        var result = await overviewService.GetAsync(workspaceId, currentUser.UserId, activityLimit, cancellationToken);

        return result.Outcome switch
        {
            GetWorkspaceOverviewOutcome.Success => Ok(result.Overview),
            GetWorkspaceOverviewOutcome.NotFound => NotFound(),
            GetWorkspaceOverviewOutcome.ValidationFailed => ValidationProblem(ToModelState(nameof(activityLimit), result.Errors)),
            _ => Problem(statusCode: StatusCodes.Status500InternalServerError),
        };
    }

    [HttpPatch("{workspaceId:guid}/members/{userId:guid}/role")]
    [ValidateCsrfToken]
    public async Task<IActionResult> ChangeMemberRole(
        Guid workspaceId,
        Guid userId,
        [FromBody] ChangeMemberRoleRequest request,
        CancellationToken cancellationToken)
    {
        var result = await membershipService.ChangeRoleAsync(workspaceId, currentUser.UserId, userId, request, cancellationToken);

        return result.Outcome switch
        {
            ChangeMemberRoleOutcome.Success => NoContent(),
            ChangeMemberRoleOutcome.NotFound => NotFound(),
            ChangeMemberRoleOutcome.Forbidden => Forbid(),
            ChangeMemberRoleOutcome.ValidationFailed => ValidationProblem(ToModelState(nameof(request.Role), result.Errors)),
            ChangeMemberRoleOutcome.LastOwner => Problem(
                title: "Role change rejected",
                detail: result.Errors.FirstOrDefault(),
                statusCode: StatusCodes.Status409Conflict),
            _ => Problem(statusCode: StatusCodes.Status500InternalServerError),
        };
    }

    [HttpDelete("{workspaceId:guid}/members/{userId:guid}")]
    [ValidateCsrfToken]
    public async Task<IActionResult> RemoveMember(Guid workspaceId, Guid userId, CancellationToken cancellationToken)
    {
        var outcome = await membershipService.RemoveAsync(workspaceId, currentUser.UserId, userId, cancellationToken);

        return outcome switch
        {
            RemoveMemberOutcome.Success => NoContent(),
            RemoveMemberOutcome.NotFound => NotFound(),
            RemoveMemberOutcome.Forbidden => Forbid(),
            RemoveMemberOutcome.LastOwner => Problem(
                title: "Removal rejected",
                detail: "A workspace must always have at least one Owner.",
                statusCode: StatusCodes.Status409Conflict),
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
