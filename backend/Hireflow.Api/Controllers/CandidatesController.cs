using Hireflow.Api.Authentication;
using Hireflow.Application.Candidates;
using Hireflow.Application.Common;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.ModelBinding;

namespace Hireflow.Api.Controllers;

/// <summary>Candidate detail and edit, addressed directly by workspace-scoped ID.</summary>
[ApiController]
[Route("api/workspaces/{workspaceId:guid}/candidates")]
[Authorize]
public sealed class CandidatesController(ICandidateService candidateService, ICurrentUser currentUser)
    : ControllerBase
{
    [HttpGet("{candidateId:guid}")]
    public async Task<ActionResult<CandidateResponse>> GetById(Guid workspaceId, Guid candidateId, CancellationToken cancellationToken)
    {
        var candidate = await candidateService.GetAsync(workspaceId, currentUser.UserId, candidateId, cancellationToken);

        // A guessed candidate ID under the wrong workspace, or a candidate that doesn't
        // exist, is the same 404 as a nonexistent/inaccessible workspace.
        return candidate is null ? NotFound() : Ok(candidate);
    }

    [HttpPatch("{candidateId:guid}")]
    [ValidateCsrfToken]
    public async Task<ActionResult<CandidateResponse>> Update(
        Guid workspaceId,
        Guid candidateId,
        [FromBody] UpdateCandidateRequest request,
        CancellationToken cancellationToken)
    {
        var result = await candidateService.UpdateAsync(workspaceId, currentUser.UserId, candidateId, request, cancellationToken);

        return result.Outcome switch
        {
            UpdateCandidateOutcome.Success => Ok(result.Candidate),
            UpdateCandidateOutcome.NotFound => NotFound(),
            UpdateCandidateOutcome.Forbidden => Forbid(),
            UpdateCandidateOutcome.ValidationFailed => ValidationProblem(ToModelState(nameof(request.Name), result.Errors)),
            UpdateCandidateOutcome.ConcurrencyConflict => Problem(
                title: "Candidate changed since you loaded it",
                detail: result.Errors.FirstOrDefault(),
                statusCode: StatusCodes.Status409Conflict),
            UpdateCandidateOutcome.DuplicateEmail => Problem(
                title: "Candidate already exists",
                detail: result.Errors.FirstOrDefault(),
                statusCode: StatusCodes.Status409Conflict),
            _ => Problem(statusCode: StatusCodes.Status500InternalServerError),
        };
    }

    [HttpPatch("{candidateId:guid}/stage")]
    [ValidateCsrfToken]
    public async Task<ActionResult<CandidateResponse>> MoveStage(
        Guid workspaceId,
        Guid candidateId,
        [FromBody] MoveCandidateStageRequest request,
        CancellationToken cancellationToken)
    {
        var result = await candidateService.MoveStageAsync(workspaceId, currentUser.UserId, candidateId, request, cancellationToken);

        return result.Outcome switch
        {
            MoveCandidateStageOutcome.Success => Ok(result.Candidate),
            MoveCandidateStageOutcome.NotFound => NotFound(),
            MoveCandidateStageOutcome.Forbidden => Forbid(),
            MoveCandidateStageOutcome.ValidationFailed => ValidationProblem(ToModelState(nameof(request.Stage), result.Errors)),
            MoveCandidateStageOutcome.NoOpTransition => Problem(
                title: "Candidate is already in this stage",
                detail: result.Errors.FirstOrDefault(),
                statusCode: StatusCodes.Status409Conflict),
            MoveCandidateStageOutcome.ConcurrencyConflict => Problem(
                title: "Candidate changed since you loaded it",
                detail: result.Errors.FirstOrDefault(),
                statusCode: StatusCodes.Status409Conflict),
            _ => Problem(statusCode: StatusCodes.Status500InternalServerError),
        };
    }

    [HttpGet("{candidateId:guid}/history")]
    public async Task<ActionResult<IReadOnlyList<CandidateStageHistoryResponse>>> GetHistory(
        Guid workspaceId,
        Guid candidateId,
        CancellationToken cancellationToken)
    {
        var result = await candidateService.GetHistoryAsync(workspaceId, currentUser.UserId, candidateId, cancellationToken);

        return result.Outcome switch
        {
            GetCandidateHistoryOutcome.Success => Ok(result.History),
            GetCandidateHistoryOutcome.NotFound => NotFound(),
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
