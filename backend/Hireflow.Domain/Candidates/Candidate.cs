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
    /// The single safe extension point for future stage-movement logic. Not exposed
    /// through any endpoint in this slice; validation of allowed transitions belongs
    /// here once stage movement is implemented, matching <c>JobOpening.TryTransitionTo</c>.
    /// </summary>
    public void MoveToStage(CandidateStage target, DateTimeOffset now)
    {
        Stage = target;
        UpdatedAt = now;
    }
}
