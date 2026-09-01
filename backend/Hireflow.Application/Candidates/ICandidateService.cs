namespace Hireflow.Application.Candidates;

/// <summary>
/// Orchestrates candidate use cases behind <c>/api/workspaces/{workspaceId}/jobs/{jobId}/candidates</c>
/// and <c>/api/workspaces/{workspaceId}/candidates/{candidateId}</c>. Every read and
/// write is scoped by workspace membership plus, for a specific job or candidate, its
/// ID within that workspace — a job or candidate ID alone is never authorizing.
/// </summary>
public interface ICandidateService
{
    /// <summary>Adds a candidate to <paramref name="jobId" />, which must be Open in this workspace.</summary>
    Task<CreateCandidateResult> CreateAsync(
        Guid workspaceId,
        Guid jobId,
        Guid callerUserId,
        CreateCandidateRequest request,
        CancellationToken cancellationToken);

    /// <summary><paramref name="stageFilter" /> is optional; an unrecognized value yields <see cref="ListCandidatesOutcome.ValidationFailed" />.</summary>
    Task<ListCandidatesResult> ListAsync(
        Guid workspaceId,
        Guid jobId,
        Guid callerUserId,
        string? stageFilter,
        CancellationToken cancellationToken);

    /// <summary><c>null</c> if the workspace doesn't exist, the caller isn't a member, or the candidate isn't in this workspace.</summary>
    Task<CandidateResponse?> GetAsync(Guid workspaceId, Guid callerUserId, Guid candidateId, CancellationToken cancellationToken);

    Task<UpdateCandidateResult> UpdateAsync(
        Guid workspaceId,
        Guid callerUserId,
        Guid candidateId,
        UpdateCandidateRequest request,
        CancellationToken cancellationToken);
}
