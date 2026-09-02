namespace Hireflow.Domain.Candidates;

/// <summary>
/// An immutable, attributable record of one candidate stage move. Rows are append-only
/// audit facts: nothing in the product updates or deletes a history row, and initial
/// Applied creation is never backfilled as a history event — history begins with the
/// first actual movement after this feature.
/// </summary>
public sealed class CandidateStageHistory
{
    public required Guid Id { get; init; }

    public required Guid WorkspaceId { get; init; }

    public required Guid CandidateId { get; init; }

    public required CandidateStage PreviousStage { get; init; }

    public required CandidateStage NewStage { get; init; }

    /// <summary>The stable Identity user id of whoever moved the candidate, resolved only from the authenticated caller.</summary>
    public required Guid ChangedByUserId { get; init; }

    public required DateTimeOffset ChangedAt { get; init; }
}
