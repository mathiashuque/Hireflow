namespace Hireflow.Domain.Jobs;

/// <summary>
/// A job opening's lifecycle stage. Persisted as its name rather than its ordinal so
/// reordering or inserting values never changes stored meaning.
/// </summary>
public enum JobOpeningStatus
{
    Draft,
    Open,
    Closed,
}
