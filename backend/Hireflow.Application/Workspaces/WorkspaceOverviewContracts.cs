namespace Hireflow.Application.Workspaces;

/// <summary>Job counts by lifecycle status, always covering every predefined status.</summary>
public sealed record JobCountsResponse(int Draft, int Open, int Closed)
{
    public static readonly JobCountsResponse Empty = new(0, 0, 0);
}

/// <summary>Candidate counts by pipeline stage, always covering every predefined stage.</summary>
public sealed record CandidateStageCountsResponse(int Applied, int Screening, int Interview, int Offer, int Rejected)
{
    public static readonly CandidateStageCountsResponse Empty = new(0, 0, 0, 0, 0);
}

/// <summary>
/// One non-Closed job's current recruiting workload. Closed jobs are excluded from the
/// workload list, though they remain counted in <see cref="WorkspaceOverviewResponse.JobCounts" />.
/// </summary>
public sealed record JobWorkloadResponse(
    Guid JobId,
    string Title,
    string Status,
    DateTimeOffset UpdatedAt,
    int TotalCandidates,
    CandidateStageCountsResponse StageCounts);

/// <summary>
/// One recent recruiting activity, derived only from facts the schema records directly:
/// job creation, candidate addition, stage movement, or note addition. This is a
/// best-effort recent-activity projection, not a complete audit log — status changes and
/// candidate profile edits are not tracked and never appear here.
/// </summary>
public sealed record OverviewActivityResponse(
    Guid Id,
    string Kind,
    DateTimeOffset OccurredAt,
    Guid ActorUserId,
    string? ActorDisplayName,
    Guid? JobId,
    string? JobTitle,
    Guid? CandidateId,
    string? CandidateName,
    string? PreviousStage,
    string? NewStage);

public static class OverviewActivityKind
{
    public const string JobCreated = "JobCreated";
    public const string CandidateAdded = "CandidateAdded";
    public const string CandidateStageChanged = "CandidateStageChanged";
    public const string CandidateNoteAdded = "CandidateNoteAdded";
}

public sealed record WorkspaceOverviewResponse(
    Guid WorkspaceId,
    string Name,
    string Slug,
    string Role,
    JobCountsResponse JobCounts,
    int TotalCandidates,
    CandidateStageCountsResponse CandidateCounts,
    IReadOnlyList<JobWorkloadResponse> Workload,
    IReadOnlyList<OverviewActivityResponse> RecentActivity);

public enum GetWorkspaceOverviewOutcome
{
    Success,
    NotFound,
    ValidationFailed,
}

public sealed record GetWorkspaceOverviewResult(
    GetWorkspaceOverviewOutcome Outcome,
    WorkspaceOverviewResponse? Overview,
    IReadOnlyList<string> Errors)
{
    public static GetWorkspaceOverviewResult Success(WorkspaceOverviewResponse overview) =>
        new(GetWorkspaceOverviewOutcome.Success, overview, []);

    public static GetWorkspaceOverviewResult NotFound() => new(GetWorkspaceOverviewOutcome.NotFound, null, []);

    public static GetWorkspaceOverviewResult ValidationFailed(IReadOnlyList<string> errors) =>
        new(GetWorkspaceOverviewOutcome.ValidationFailed, null, errors);
}
