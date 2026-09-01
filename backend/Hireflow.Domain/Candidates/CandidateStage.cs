namespace Hireflow.Domain.Candidates;

/// <summary>
/// A candidate's current position in the (currently predefined) hiring pipeline.
/// Persisted as its name rather than its ordinal so reordering or inserting values
/// never changes stored meaning.
/// </summary>
public enum CandidateStage
{
    Applied,
    Screening,
    Interview,
    Offer,
    Rejected,
}
