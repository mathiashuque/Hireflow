namespace Hireflow.Application.Workspaces;

/// <summary>
/// Orchestrates the read-only recruiting overview behind
/// <c>GET /api/workspaces/{workspaceId}/overview</c>. Any current Owner, Recruiter, or
/// Interviewer may read it; every underlying aggregate is scoped by the caller's
/// membership and the route's WorkspaceId before any recruiting data is materialized.
/// </summary>
public interface IWorkspaceOverviewService
{
    /// <summary><paramref name="activityLimit" /> defaults to 20 when omitted and must be between 1 and 50.</summary>
    Task<GetWorkspaceOverviewResult> GetAsync(
        Guid workspaceId,
        Guid callerUserId,
        int? activityLimit,
        CancellationToken cancellationToken);
}
