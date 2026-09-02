using Hireflow.Api.Authentication;
using Hireflow.Api.Errors;
using Hireflow.Application.Candidates;
using Hireflow.Application.Common;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Hireflow.Api.Controllers;

/// <summary>Candidate detail and edit, addressed directly by workspace-scoped ID.</summary>
[ApiController]
[Route("api/workspaces/{workspaceId:guid}/candidates")]
[Authorize]
public sealed class CandidatesController(
    ICandidateService candidateService,
    ICandidateNoteService candidateNoteService,
    ICurrentUser currentUser)
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
            UpdateCandidateOutcome.ValidationFailed => this.ValidationProblemWithCode(
                ProblemResultExtensions.ToModelState(nameof(request.Name), result.Errors)),
            UpdateCandidateOutcome.ConcurrencyConflict => this.ProblemWithCode(
                StatusCodes.Status409Conflict,
                ProblemCodes.StaleVersion,
                title: "Candidate changed since you loaded it",
                detail: result.Errors.FirstOrDefault()),
            UpdateCandidateOutcome.DuplicateEmail => this.ProblemWithCode(
                StatusCodes.Status409Conflict,
                ProblemCodes.DuplicateCandidateEmail,
                title: "Candidate already exists",
                detail: result.Errors.FirstOrDefault()),
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
            MoveCandidateStageOutcome.ValidationFailed => this.ValidationProblemWithCode(
                ProblemResultExtensions.ToModelState(nameof(request.Stage), result.Errors)),
            MoveCandidateStageOutcome.NoOpTransition => this.ProblemWithCode(
                StatusCodes.Status409Conflict,
                ProblemCodes.NoOpStageMove,
                title: "Candidate is already in this stage",
                detail: result.Errors.FirstOrDefault()),
            MoveCandidateStageOutcome.ConcurrencyConflict => this.ProblemWithCode(
                StatusCodes.Status409Conflict,
                ProblemCodes.StaleVersion,
                title: "Candidate changed since you loaded it",
                detail: result.Errors.FirstOrDefault()),
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

    [HttpPost("{candidateId:guid}/notes")]
    [ValidateCsrfToken]
    public async Task<ActionResult<CandidateNoteResponse>> AddNote(
        Guid workspaceId,
        Guid candidateId,
        [FromBody] CreateCandidateNoteRequest request,
        CancellationToken cancellationToken)
    {
        var result = await candidateNoteService.CreateAsync(workspaceId, currentUser.UserId, candidateId, request, cancellationToken);

        return result.Outcome switch
        {
            CreateCandidateNoteOutcome.Success => Ok(result.Note),
            CreateCandidateNoteOutcome.NotFound => NotFound(),
            CreateCandidateNoteOutcome.ValidationFailed => this.ValidationProblemWithCode(
                ProblemResultExtensions.ToModelState(nameof(request.Content), result.Errors)),
            _ => Problem(statusCode: StatusCodes.Status500InternalServerError),
        };
    }

    [HttpGet("{candidateId:guid}/notes")]
    public async Task<ActionResult<IReadOnlyList<CandidateNoteResponse>>> GetNotes(
        Guid workspaceId,
        Guid candidateId,
        CancellationToken cancellationToken)
    {
        var result = await candidateNoteService.ListAsync(workspaceId, currentUser.UserId, candidateId, cancellationToken);

        return result.Outcome switch
        {
            ListCandidateNotesOutcome.Success => Ok(result.Notes),
            ListCandidateNotesOutcome.NotFound => NotFound(),
            _ => Problem(statusCode: StatusCodes.Status500InternalServerError),
        };
    }
}
