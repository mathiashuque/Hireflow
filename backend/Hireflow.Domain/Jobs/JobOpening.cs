namespace Hireflow.Domain.Jobs;

/// <summary>
/// A tenant-owned job opening. Every query and update must scope by both
/// <see cref="WorkspaceId" /> and <see cref="Id" />; a job ID alone never authorizes
/// access.
/// </summary>
public sealed class JobOpening
{
    public required Guid Id { get; init; }

    public required Guid WorkspaceId { get; init; }

    public required string Title { get; set; }

    public string? Description { get; set; }

    public JobOpeningStatus Status { get; private set; } = JobOpeningStatus.Draft;

    public required Guid CreatedByUserId { get; init; }

    public required DateTimeOffset CreatedAt { get; init; }

    public DateTimeOffset UpdatedAt { get; set; }

    public DateTimeOffset? ClosedAt { get; private set; }

    /// <summary>
    /// Applies title/description edits without touching lifecycle state, keeping
    /// <see cref="Status" /> and <see cref="ClosedAt" /> untouched by unrelated updates.
    /// </summary>
    public void Edit(string title, string? description, DateTimeOffset now)
    {
        Title = title;
        Description = description;
        UpdatedAt = now;
    }

    /// <summary>
    /// Attempts to move to <paramref name="target" />. Only Draft/Closed → Open and
    /// Open → Closed are valid; every other request (including a no-op) is rejected
    /// without mutating anything, so <see cref="Status" /> and <see cref="ClosedAt" />
    /// never fall out of sync.
    /// </summary>
    public bool TryTransitionTo(JobOpeningStatus target, DateTimeOffset now)
    {
        switch (target)
        {
            case JobOpeningStatus.Open when Status is JobOpeningStatus.Draft or JobOpeningStatus.Closed:
                Status = JobOpeningStatus.Open;
                ClosedAt = null;
                UpdatedAt = now;
                return true;

            case JobOpeningStatus.Closed when Status is JobOpeningStatus.Open:
                Status = JobOpeningStatus.Closed;
                ClosedAt = now;
                UpdatedAt = now;
                return true;

            default:
                return false;
        }
    }
}
