namespace Hireflow.Application.Jobs;

/// <summary>
/// Orchestrates job opening use cases behind <c>/api/workspaces/{workspaceId}/jobs</c>.
/// Every read and write is scoped by both workspace membership and, for a specific
/// job, its ID within that workspace — a job ID alone is never authorizing.
/// </summary>
public interface IJobOpeningService
{
    Task<CreateJobOpeningResult> CreateAsync(
        Guid workspaceId,
        Guid callerUserId,
        CreateJobOpeningRequest request,
        CancellationToken cancellationToken);

    /// <summary><paramref name="statusFilter" /> is optional; an unrecognized value yields <see cref="ListJobOpeningsOutcome.ValidationFailed" />.</summary>
    Task<ListJobOpeningsResult> ListAsync(
        Guid workspaceId,
        Guid callerUserId,
        string? statusFilter,
        CancellationToken cancellationToken);

    /// <summary><c>null</c> if the workspace doesn't exist, the caller isn't a member, or the job isn't in this workspace.</summary>
    Task<JobOpeningResponse?> GetAsync(Guid workspaceId, Guid callerUserId, Guid jobId, CancellationToken cancellationToken);

    Task<UpdateJobOpeningResult> UpdateAsync(
        Guid workspaceId,
        Guid callerUserId,
        Guid jobId,
        UpdateJobOpeningRequest request,
        CancellationToken cancellationToken);

    Task<ChangeJobOpeningStatusResult> ChangeStatusAsync(
        Guid workspaceId,
        Guid callerUserId,
        Guid jobId,
        ChangeJobOpeningStatusRequest request,
        CancellationToken cancellationToken);
}
