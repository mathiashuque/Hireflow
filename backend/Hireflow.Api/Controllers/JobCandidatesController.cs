using Hireflow.Api.Authentication;
using Hireflow.Api.Errors;
using Hireflow.Application.Candidates;
using Hireflow.Application.Common;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Hireflow.Api.Controllers;

/// <summary>Candidate intake and listing, nested under the job they apply to.</summary>
[ApiController]
[Route("api/workspaces/{workspaceId:guid}/jobs/{jobId:guid}/candidates")]
[Authorize]
public sealed class JobCandidatesController(ICandidateService candidateService, ICurrentUser currentUser)
    : ControllerBase
{
    [HttpPost]
    [ValidateCsrfToken]
    public async Task<ActionResult<CandidateResponse>> Create(
        Guid workspaceId,
        Guid jobId,
        [FromBody] CreateCandidateRequest request,
        CancellationToken cancellationToken)
    {
        var result = await candidateService.CreateAsync(workspaceId, jobId, currentUser.UserId, request, cancellationToken);

        return result.Outcome switch
        {
            CreateCandidateOutcome.Success => Ok(result.Candidate),
            CreateCandidateOutcome.NotFound => NotFound(),
            CreateCandidateOutcome.Forbidden => Forbid(),
            CreateCandidateOutcome.ValidationFailed => this.ValidationProblemWithCode(
                ProblemResultExtensions.ToModelState(nameof(request.Name), result.Errors)),
            CreateCandidateOutcome.JobNotOpen => this.ProblemWithCode(
                StatusCodes.Status409Conflict,
                ProblemCodes.JobNotOpen,
                title: "Job is not open",
                detail: result.Errors.FirstOrDefault()),
            CreateCandidateOutcome.DuplicateEmail => this.ProblemWithCode(
                StatusCodes.Status409Conflict,
                ProblemCodes.DuplicateCandidateEmail,
                title: "Candidate already exists",
                detail: result.Errors.FirstOrDefault()),
            _ => Problem(statusCode: StatusCodes.Status500InternalServerError),
        };
    }

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<CandidateResponse>>> List(
        Guid workspaceId,
        Guid jobId,
        [FromQuery] string? stage,
        CancellationToken cancellationToken)
    {
        var result = await candidateService.ListAsync(workspaceId, jobId, currentUser.UserId, stage, cancellationToken);

        return result.Outcome switch
        {
            ListCandidatesOutcome.Success => Ok(result.Candidates),
            ListCandidatesOutcome.NotFound => NotFound(),
            ListCandidatesOutcome.ValidationFailed => this.ValidationProblemWithCode(
                ProblemResultExtensions.ToModelState(nameof(stage), result.Errors)),
            _ => Problem(statusCode: StatusCodes.Status500InternalServerError),
        };
    }
}
