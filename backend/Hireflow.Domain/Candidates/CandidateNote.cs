namespace Hireflow.Domain.Candidates;

/// <summary>
/// An immutable, attributable internal note on a candidate. Rows are append-only human
/// feedback: nothing in the product edits or deletes a note, and notes never change
/// Candidate's stage, UpdatedAt, or concurrency version.
/// </summary>
public sealed class CandidateNote
{
    public required Guid Id { get; init; }

    public required Guid WorkspaceId { get; init; }

    public required Guid CandidateId { get; init; }

    /// <summary>The stable Identity user id of whoever wrote the note, resolved only from the authenticated caller.</summary>
    public required Guid AuthorUserId { get; init; }

    public required string Content { get; init; }

    public required DateTimeOffset CreatedAt { get; init; }
}
