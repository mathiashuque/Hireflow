namespace Hireflow.Application.Candidates;

/// <summary>
/// Orchestrates internal candidate note use cases behind
/// <c>/api/workspaces/{workspaceId}/candidates/{candidateId}/notes</c>. Unlike candidate
/// editing and stage movement, every current workspace role — including Interviewer —
/// may add and read notes. Notes are append-only and never affect a candidate's stage,
/// UpdatedAt, or concurrency version.
/// </summary>
public interface ICandidateNoteService
{
    Task<CreateCandidateNoteResult> CreateAsync(
        Guid workspaceId,
        Guid callerUserId,
        Guid candidateId,
        CreateCandidateNoteRequest request,
        CancellationToken cancellationToken);

    /// <summary>Notes are oldest-first, then stable ID, reading as a discussion timeline.</summary>
    Task<ListCandidateNotesResult> ListAsync(
        Guid workspaceId,
        Guid callerUserId,
        Guid candidateId,
        CancellationToken cancellationToken);
}
