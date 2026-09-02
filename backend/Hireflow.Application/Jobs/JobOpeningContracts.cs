using System.ComponentModel.DataAnnotations;

namespace Hireflow.Application.Jobs;

/// <summary>Request body for <c>POST /api/workspaces/{workspaceId}/jobs</c>.</summary>
public sealed class CreateJobOpeningRequest
{
    [Required]
    [MaxLength(200)]
    public required string Title { get; init; }

    [MaxLength(4000)]
    public string? Description { get; init; }
}

/// <summary>Request body for <c>PATCH /api/workspaces/{workspaceId}/jobs/{jobId}</c>.</summary>
public sealed class UpdateJobOpeningRequest
{
    [Required]
    [MaxLength(200)]
    public required string Title { get; init; }

    [MaxLength(4000)]
    public string? Description { get; init; }

    /// <summary>The concurrency token last seen by the client, echoed back from a prior response.</summary>
    [Required]
    public required string Version { get; init; }
}

/// <summary>Request body for <c>PATCH /api/workspaces/{workspaceId}/jobs/{jobId}/status</c>.</summary>
public sealed class ChangeJobOpeningStatusRequest
{
    /// <summary><c>"Open"</c> or <c>"Closed"</c>; Draft is never a status-change target.</summary>
    [Required]
    public required string Status { get; init; }

    [Required]
    public required string Version { get; init; }
}

public sealed record JobOpeningResponse(
    Guid Id,
    Guid WorkspaceId,
    string Title,
    string? Description,
    string Status,
    Guid CreatedByUserId,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt,
    DateTimeOffset? ClosedAt,
    string Version);

public enum CreateJobOpeningOutcome
{
    Success,
    NotFound,
    Forbidden,
    ValidationFailed,
}

public sealed record CreateJobOpeningResult(CreateJobOpeningOutcome Outcome, JobOpeningResponse? Job, IReadOnlyList<string> Errors)
{
    public static CreateJobOpeningResult Success(JobOpeningResponse job) => new(CreateJobOpeningOutcome.Success, job, []);

    public static CreateJobOpeningResult NotFound() => new(CreateJobOpeningOutcome.NotFound, null, []);

    public static CreateJobOpeningResult Forbidden() => new(CreateJobOpeningOutcome.Forbidden, null, []);

    public static CreateJobOpeningResult ValidationFailed(IReadOnlyList<string> errors) =>
        new(CreateJobOpeningOutcome.ValidationFailed, null, errors);
}

public enum ListJobOpeningsOutcome
{
    Success,
    NotFound,
    ValidationFailed,
}

public sealed record ListJobOpeningsResult(ListJobOpeningsOutcome Outcome, IReadOnlyList<JobOpeningResponse>? Jobs, IReadOnlyList<string> Errors)
{
    public static ListJobOpeningsResult Success(IReadOnlyList<JobOpeningResponse> jobs) => new(ListJobOpeningsOutcome.Success, jobs, []);

    public static ListJobOpeningsResult NotFound() => new(ListJobOpeningsOutcome.NotFound, null, []);

    public static ListJobOpeningsResult ValidationFailed(IReadOnlyList<string> errors) =>
        new(ListJobOpeningsOutcome.ValidationFailed, null, errors);
}

public enum UpdateJobOpeningOutcome
{
    Success,
    NotFound,
    Forbidden,
    ValidationFailed,

    /// <summary>The submitted <c>Version</c> no longer matches the persisted row.</summary>
    ConcurrencyConflict,
}

public sealed record UpdateJobOpeningResult(UpdateJobOpeningOutcome Outcome, JobOpeningResponse? Job, IReadOnlyList<string> Errors)
{
    public static UpdateJobOpeningResult Success(JobOpeningResponse job) => new(UpdateJobOpeningOutcome.Success, job, []);

    public static UpdateJobOpeningResult NotFound() => new(UpdateJobOpeningOutcome.NotFound, null, []);

    public static UpdateJobOpeningResult Forbidden() => new(UpdateJobOpeningOutcome.Forbidden, null, []);

    public static UpdateJobOpeningResult ValidationFailed(IReadOnlyList<string> errors) =>
        new(UpdateJobOpeningOutcome.ValidationFailed, null, errors);

    public static UpdateJobOpeningResult ConcurrencyConflict() =>
        new(UpdateJobOpeningOutcome.ConcurrencyConflict, null, ["This job was changed by someone else. Refresh and try again."]);
}

public enum ChangeJobOpeningStatusOutcome
{
    Success,
    NotFound,
    Forbidden,
    ValidationFailed,

    /// <summary>The requested status is not reachable from the job's current status.</summary>
    InvalidTransition,

    ConcurrencyConflict,
}

public sealed record ChangeJobOpeningStatusResult(ChangeJobOpeningStatusOutcome Outcome, JobOpeningResponse? Job, IReadOnlyList<string> Errors)
{
    public static ChangeJobOpeningStatusResult Success(JobOpeningResponse job) => new(ChangeJobOpeningStatusOutcome.Success, job, []);

    public static ChangeJobOpeningStatusResult NotFound() => new(ChangeJobOpeningStatusOutcome.NotFound, null, []);

    public static ChangeJobOpeningStatusResult Forbidden() => new(ChangeJobOpeningStatusOutcome.Forbidden, null, []);

    public static ChangeJobOpeningStatusResult ValidationFailed(IReadOnlyList<string> errors) =>
        new(ChangeJobOpeningStatusOutcome.ValidationFailed, null, errors);

    public static ChangeJobOpeningStatusResult InvalidTransition() =>
        new(ChangeJobOpeningStatusOutcome.InvalidTransition, null, ["That status change isn't valid from the job's current status."]);

    public static ChangeJobOpeningStatusResult ConcurrencyConflict() =>
        new(ChangeJobOpeningStatusOutcome.ConcurrencyConflict, null, ["This job was changed by someone else. Refresh and try again."]);
}
