namespace Hireflow.Domain.Candidates;

/// <summary>
/// A tenant-owned candidate applying to a specific job. Every query and update must
/// scope by both <see cref="WorkspaceId" /> and <see cref="Id" />; a candidate ID
/// alone never authorizes access. <see cref="JobOpeningId" /> must always belong to
/// the same <see cref="WorkspaceId" />, which is additionally enforced by a
/// database-level composite foreign key.
/// </summary>
public sealed class Candidate
{
    public required Guid Id { get; init; }

    public required Guid WorkspaceId { get; init; }

    public required Guid JobOpeningId { get; init; }

    public required string Name { get; set; }

    /// <summary>The candidate's email as entered, for display.</summary>
    public required string Email { get; set; }

    /// <summary>The email normalized the same way Identity normalizes account emails, used for per-job uniqueness.</summary>
    public required string NormalizedEmail { get; set; }

    public CandidateStage Stage { get; private set; } = CandidateStage.Applied;

    public required Guid CreatedByUserId { get; init; }

    public required DateTimeOffset CreatedAt { get; init; }

    public DateTimeOffset UpdatedAt { get; set; }

    /// <summary>
    /// Applies name/email edits without touching <see cref="Stage" />, keeping stage
    /// movement (a separate later slice) out of the ordinary edit path.
    /// </summary>
    public void Edit(string name, string email, string normalizedEmail, DateTimeOffset now)
    {
        Name = name;
        Email = email;
        NormalizedEmail = normalizedEmail;
        UpdatedAt = now;
    }

    /// <summary>
    /// Attempts to move to <paramref name="target" />. Any predefined stage may move to
    /// any other predefined stage (including backward, and recovery out of Rejected);
    /// only a no-op move to the current stage is rejected without mutating anything, so
    /// <see cref="Stage" /> and <see cref="UpdatedAt" /> never fall out of sync and no
    /// history row is appended for a request that changed nothing.
    /// </summary>
    public bool TryMoveToStage(CandidateStage target, DateTimeOffset now, out CandidateStage previousStage)
    {
        previousStage = Stage;
        if (target == Stage)
        {
            return false;
        }

        Stage = target;
        UpdatedAt = now;
        return true;
    }
}
