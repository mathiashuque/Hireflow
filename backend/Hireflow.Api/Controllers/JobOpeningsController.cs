using Hireflow.Api.Authentication;
using Hireflow.Application.Common;
using Hireflow.Application.Jobs;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.ModelBinding;

namespace Hireflow.Api.Controllers;

[ApiController]
[Route("api/workspaces/{workspaceId:guid}/jobs")]
[Authorize]
public sealed class JobOpeningsController(IJobOpeningService jobOpeningService, ICurrentUser currentUser)
    : ControllerBase
{
    [HttpPost]
    [ValidateCsrfToken]
    public async Task<ActionResult<JobOpeningResponse>> Create(
        Guid workspaceId,
        [FromBody] CreateJobOpeningRequest request,
        CancellationToken cancellationToken)
    {
        var result = await jobOpeningService.CreateAsync(workspaceId, currentUser.UserId, request, cancellationToken);

        return result.Outcome switch
        {
            CreateJobOpeningOutcome.Success => Ok(result.Job),
            CreateJobOpeningOutcome.NotFound => NotFound(),
            CreateJobOpeningOutcome.Forbidden => Forbid(),
            CreateJobOpeningOutcome.ValidationFailed => ValidationProblem(ToModelState(nameof(request.Title), result.Errors)),
            _ => Problem(statusCode: StatusCodes.Status500InternalServerError),
        };
    }

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<JobOpeningResponse>>> List(
        Guid workspaceId,
        [FromQuery] string? status,
        CancellationToken cancellationToken)
    {
        var result = await jobOpeningService.ListAsync(workspaceId, currentUser.UserId, status, cancellationToken);

        return result.Outcome switch
        {
            ListJobOpeningsOutcome.Success => Ok(result.Jobs),
            ListJobOpeningsOutcome.NotFound => NotFound(),
            ListJobOpeningsOutcome.ValidationFailed => ValidationProblem(ToModelState(nameof(status), result.Errors)),
            _ => Problem(statusCode: StatusCodes.Status500InternalServerError),
        };
    }

    [HttpGet("{jobId:guid}")]
    public async Task<ActionResult<JobOpeningResponse>> GetById(Guid workspaceId, Guid jobId, CancellationToken cancellationToken)
    {
        var job = await jobOpeningService.GetAsync(workspaceId, currentUser.UserId, jobId, cancellationToken);

        // A guessed job ID under the wrong workspace, or a job that doesn't exist, is
        // the same 404 as a nonexistent/inaccessible workspace.
        return job is null ? NotFound() : Ok(job);
    }

    [HttpPatch("{jobId:guid}")]
    [ValidateCsrfToken]
    public async Task<ActionResult<JobOpeningResponse>> Update(
        Guid workspaceId,
        Guid jobId,
        [FromBody] UpdateJobOpeningRequest request,
        CancellationToken cancellationToken)
    {
        var result = await jobOpeningService.UpdateAsync(workspaceId, currentUser.UserId, jobId, request, cancellationToken);

        return result.Outcome switch
        {
            UpdateJobOpeningOutcome.Success => Ok(result.Job),
            UpdateJobOpeningOutcome.NotFound => NotFound(),
            UpdateJobOpeningOutcome.Forbidden => Forbid(),
            UpdateJobOpeningOutcome.ValidationFailed => ValidationProblem(ToModelState(nameof(request.Title), result.Errors)),
            UpdateJobOpeningOutcome.ConcurrencyConflict => Problem(
                title: "Job changed since you loaded it",
                detail: result.Errors.FirstOrDefault(),
                statusCode: StatusCodes.Status409Conflict),
            _ => Problem(statusCode: StatusCodes.Status500InternalServerError),
        };
    }

    [HttpPatch("{jobId:guid}/status")]
    [ValidateCsrfToken]
    public async Task<ActionResult<JobOpeningResponse>> ChangeStatus(
        Guid workspaceId,
        Guid jobId,
        [FromBody] ChangeJobOpeningStatusRequest request,
        CancellationToken cancellationToken)
    {
        var result = await jobOpeningService.ChangeStatusAsync(workspaceId, currentUser.UserId, jobId, request, cancellationToken);

        return result.Outcome switch
        {
            ChangeJobOpeningStatusOutcome.Success => Ok(result.Job),
            ChangeJobOpeningStatusOutcome.NotFound => NotFound(),
            ChangeJobOpeningStatusOutcome.Forbidden => Forbid(),
            ChangeJobOpeningStatusOutcome.ValidationFailed => ValidationProblem(ToModelState(nameof(request.Status), result.Errors)),
            ChangeJobOpeningStatusOutcome.InvalidTransition => Problem(
                title: "Invalid status transition",
                detail: result.Errors.FirstOrDefault(),
                statusCode: StatusCodes.Status409Conflict),
            ChangeJobOpeningStatusOutcome.ConcurrencyConflict => Problem(
                title: "Job changed since you loaded it",
                detail: result.Errors.FirstOrDefault(),
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
