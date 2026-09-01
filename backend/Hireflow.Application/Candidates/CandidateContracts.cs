using System.ComponentModel.DataAnnotations;

namespace Hireflow.Application.Candidates;

/// <summary>Request body for <c>POST /api/workspaces/{workspaceId}/jobs/{jobId}/candidates</c>.</summary>
public sealed class CreateCandidateRequest
{
    [Required]
    [MaxLength(200)]
    public required string Name { get; init; }

    [Required]
    [MaxLength(256)]
    [EmailAddress]
    public required string Email { get; init; }
}

/// <summary>Request body for <c>PATCH /api/workspaces/{workspaceId}/candidates/{candidateId}</c>.</summary>
public sealed class UpdateCandidateRequest
{
    [Required]
    [MaxLength(200)]
    public required string Name { get; init; }

    [Required]
    [MaxLength(256)]
    [EmailAddress]
    public required string Email { get; init; }

    /// <summary>The concurrency token last seen by the client, echoed back from a prior response.</summary>
    [Required]
    public required string Version { get; init; }
}

public sealed record CandidateResponse(
    Guid Id,
    Guid WorkspaceId,
    Guid JobOpeningId,
    string Name,
    string Email,
    string Stage,
    Guid CreatedByUserId,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt,
    string Version);

public enum CreateCandidateOutcome
{
    Success,
    NotFound,
    Forbidden,
    ValidationFailed,

    /// <summary>The target job exists in this workspace but is not Open.</summary>
    JobNotOpen,

    /// <summary>A candidate with the same normalized email already exists for this job.</summary>
    DuplicateEmail,
}

public sealed record CreateCandidateResult(CreateCandidateOutcome Outcome, CandidateResponse? Candidate, IReadOnlyList<string> Errors)
{
    public static CreateCandidateResult Success(CandidateResponse candidate) => new(CreateCandidateOutcome.Success, candidate, []);

    public static CreateCandidateResult NotFound() => new(CreateCandidateOutcome.NotFound, null, []);

    public static CreateCandidateResult Forbidden() => new(CreateCandidateOutcome.Forbidden, null, []);

    public static CreateCandidateResult ValidationFailed(IReadOnlyList<string> errors) =>
        new(CreateCandidateOutcome.ValidationFailed, null, errors);

    public static CreateCandidateResult JobNotOpen() =>
        new(CreateCandidateOutcome.JobNotOpen, null, ["Candidates can only be added to an Open job."]);

    public static CreateCandidateResult DuplicateEmail() =>
        new(CreateCandidateOutcome.DuplicateEmail, null, ["A candidate with this email already exists for this job."]);
}

public enum ListCandidatesOutcome
{
    Success,
    NotFound,
    ValidationFailed,
}

public sealed record ListCandidatesResult(ListCandidatesOutcome Outcome, IReadOnlyList<CandidateResponse>? Candidates, IReadOnlyList<string> Errors)
{
    public static ListCandidatesResult Success(IReadOnlyList<CandidateResponse> candidates) =>
        new(ListCandidatesOutcome.Success, candidates, []);

    public static ListCandidatesResult NotFound() => new(ListCandidatesOutcome.NotFound, null, []);

    public static ListCandidatesResult ValidationFailed(IReadOnlyList<string> errors) =>
        new(ListCandidatesOutcome.ValidationFailed, null, errors);
}

public enum UpdateCandidateOutcome
{
    Success,
    NotFound,
    Forbidden,
    ValidationFailed,

    /// <summary>The submitted <c>Version</c> no longer matches the persisted row.</summary>
    ConcurrencyConflict,

    /// <summary>A different candidate in the same job already uses this normalized email.</summary>
    DuplicateEmail,
}

public sealed record UpdateCandidateResult(UpdateCandidateOutcome Outcome, CandidateResponse? Candidate, IReadOnlyList<string> Errors)
{
    public static UpdateCandidateResult Success(CandidateResponse candidate) => new(UpdateCandidateOutcome.Success, candidate, []);

    public static UpdateCandidateResult NotFound() => new(UpdateCandidateOutcome.NotFound, null, []);

    public static UpdateCandidateResult Forbidden() => new(UpdateCandidateOutcome.Forbidden, null, []);

    public static UpdateCandidateResult ValidationFailed(IReadOnlyList<string> errors) =>
        new(UpdateCandidateOutcome.ValidationFailed, null, errors);

    public static UpdateCandidateResult ConcurrencyConflict() =>
        new(UpdateCandidateOutcome.ConcurrencyConflict, null, ["This candidate was changed by someone else. Refresh and try again."]);

    public static UpdateCandidateResult DuplicateEmail() =>
        new(UpdateCandidateOutcome.DuplicateEmail, null, ["A candidate with this email already exists for this job."]);
}
