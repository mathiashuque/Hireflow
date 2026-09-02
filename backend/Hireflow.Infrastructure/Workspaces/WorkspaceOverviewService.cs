using Hireflow.Application.Workspaces;
using Hireflow.Domain.Candidates;
using Hireflow.Domain.Jobs;
using Hireflow.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Hireflow.Infrastructure.Workspaces;

public sealed class WorkspaceOverviewService(HireflowDbContext dbContext) : IWorkspaceOverviewService
{
    private const int DefaultActivityLimit = 20;
    private const int MaxActivityLimit = 50;

    public async Task<GetWorkspaceOverviewResult> GetAsync(
        Guid workspaceId,
        Guid callerUserId,
        int? activityLimit,
        CancellationToken cancellationToken)
    {
        var limit = activityLimit ?? DefaultActivityLimit;
        if (limit is < 1 or > MaxActivityLimit)
        {
            return GetWorkspaceOverviewResult.ValidationFailed(
                [$"activityLimit must be between 1 and {MaxActivityLimit}."]);
        }

        var membership = await dbContext.WorkspaceMembers
            .AsNoTracking()
            .Where(member => member.WorkspaceId == workspaceId && member.UserId == callerUserId)
            .Select(member => new { member.Role, WorkspaceName = member.Workspace!.Name, WorkspaceSlug = member.Workspace.Slug })
            .SingleOrDefaultAsync(cancellationToken);
        if (membership is null)
        {
            return GetWorkspaceOverviewResult.NotFound();
        }

        var jobCounts = await GetJobCountsAsync(workspaceId, cancellationToken);
        var candidateCounts = await GetCandidateStageCountsAsync(workspaceId, cancellationToken);
        var totalCandidates = candidateCounts.Applied + candidateCounts.Screening + candidateCounts.Interview
            + candidateCounts.Offer + candidateCounts.Rejected;

        var workload = await GetWorkloadAsync(workspaceId, cancellationToken);
        var recentActivity = await GetRecentActivityAsync(workspaceId, limit, cancellationToken);

        var overview = new WorkspaceOverviewResponse(
            workspaceId,
            membership.WorkspaceName,
            membership.WorkspaceSlug,
            membership.Role.ToString(),
            jobCounts,
            totalCandidates,
            candidateCounts,
            workload,
            recentActivity);

        return GetWorkspaceOverviewResult.Success(overview);
    }

    private async Task<JobCountsResponse> GetJobCountsAsync(Guid workspaceId, CancellationToken cancellationToken)
    {
        var counts = await dbContext.JobOpenings
            .AsNoTracking()
            .Where(job => job.WorkspaceId == workspaceId)
            .GroupBy(job => job.Status)
            .Select(group => new { Status = group.Key, Count = group.Count() })
            .ToArrayAsync(cancellationToken);

        return new JobCountsResponse(
            counts.FirstOrDefault(c => c.Status == JobOpeningStatus.Draft)?.Count ?? 0,
            counts.FirstOrDefault(c => c.Status == JobOpeningStatus.Open)?.Count ?? 0,
            counts.FirstOrDefault(c => c.Status == JobOpeningStatus.Closed)?.Count ?? 0);
    }

    private async Task<CandidateStageCountsResponse> GetCandidateStageCountsAsync(Guid workspaceId, CancellationToken cancellationToken)
    {
        var counts = await dbContext.Candidates
            .AsNoTracking()
            .Where(candidate => candidate.WorkspaceId == workspaceId)
            .GroupBy(candidate => candidate.Stage)
            .Select(group => new { Stage = group.Key, Count = group.Count() })
            .ToArrayAsync(cancellationToken);

        return ToStageCounts(counts.Select(c => (c.Stage, c.Count)));
    }

    private async Task<IReadOnlyList<JobWorkloadResponse>> GetWorkloadAsync(Guid workspaceId, CancellationToken cancellationToken)
    {
        var jobs = await dbContext.JobOpenings
            .AsNoTracking()
            .Where(job => job.WorkspaceId == workspaceId && job.Status != JobOpeningStatus.Closed)
            .Select(job => new { job.Id, job.Title, job.Status, job.UpdatedAt })
            .ToArrayAsync(cancellationToken);

        if (jobs.Length == 0)
        {
            return [];
        }

        var jobIds = jobs.Select(job => job.Id).ToArray();

        var stageCounts = await dbContext.Candidates
            .AsNoTracking()
            .Where(candidate => candidate.WorkspaceId == workspaceId && jobIds.Contains(candidate.JobOpeningId))
            .GroupBy(candidate => new { candidate.JobOpeningId, candidate.Stage })
            .Select(group => new { group.Key.JobOpeningId, group.Key.Stage, Count = group.Count() })
            .ToArrayAsync(cancellationToken);

        var stageCountsByJob = stageCounts
            .GroupBy(entry => entry.JobOpeningId)
            .ToDictionary(group => group.Key, group => ToStageCounts(group.Select(entry => (entry.Stage, entry.Count))));

        return jobs
            .Select(job =>
            {
                var jobStageCounts = stageCountsByJob.TryGetValue(job.Id, out var found) ? found : CandidateStageCountsResponse.Empty;
                var total = jobStageCounts.Applied + jobStageCounts.Screening + jobStageCounts.Interview
                    + jobStageCounts.Offer + jobStageCounts.Rejected;
                return new JobWorkloadResponse(job.Id, job.Title, job.Status.ToString(), job.UpdatedAt, total, jobStageCounts);
            })
            // Open before Draft, then most recently updated, then stable ID.
            .OrderBy(job => job.Status == "Open" ? 0 : 1)
            .ThenByDescending(job => job.UpdatedAt)
            .ThenBy(job => job.JobId)
            .ToArray();
    }

    private async Task<IReadOnlyList<OverviewActivityResponse>> GetRecentActivityAsync(
        Guid workspaceId, int limit, CancellationToken cancellationToken)
    {
        var jobCreated = await (
            from job in dbContext.JobOpenings.AsNoTracking()
            where job.WorkspaceId == workspaceId
            join user in dbContext.Users on job.CreatedByUserId equals user.Id into creators
            from creator in creators.DefaultIfEmpty()
            orderby job.CreatedAt descending, job.Id descending
            select new OverviewActivityResponse(
                job.Id,
                OverviewActivityKind.JobCreated,
                job.CreatedAt,
                job.CreatedByUserId,
                creator != null ? creator.DisplayName : null,
                job.Id,
                job.Title,
                null,
                null,
                null,
                null))
            .Take(limit)
            .ToArrayAsync(cancellationToken);

        var candidateAdded = await (
            from candidate in dbContext.Candidates.AsNoTracking()
            where candidate.WorkspaceId == workspaceId
            join job in dbContext.JobOpenings.AsNoTracking() on
                new { candidate.WorkspaceId, JobId = candidate.JobOpeningId } equals new { job.WorkspaceId, JobId = job.Id }
            join user in dbContext.Users on candidate.CreatedByUserId equals user.Id into creators
            from creator in creators.DefaultIfEmpty()
            orderby candidate.CreatedAt descending, candidate.Id descending
            select new OverviewActivityResponse(
                candidate.Id,
                OverviewActivityKind.CandidateAdded,
                candidate.CreatedAt,
                candidate.CreatedByUserId,
                creator != null ? creator.DisplayName : null,
                job.Id,
                job.Title,
                candidate.Id,
                candidate.Name,
                null,
                null))
            .Take(limit)
            .ToArrayAsync(cancellationToken);

        var stageChanged = await (
            from history in dbContext.CandidateStageHistories.AsNoTracking()
            where history.WorkspaceId == workspaceId
            join candidate in dbContext.Candidates.AsNoTracking() on
                new { history.WorkspaceId, history.CandidateId } equals new { candidate.WorkspaceId, CandidateId = candidate.Id }
            join job in dbContext.JobOpenings.AsNoTracking() on
                new { candidate.WorkspaceId, JobId = candidate.JobOpeningId } equals new { job.WorkspaceId, JobId = job.Id }
            join user in dbContext.Users on history.ChangedByUserId equals user.Id into changedByUsers
            from changedByUser in changedByUsers.DefaultIfEmpty()
            orderby history.ChangedAt descending, history.Id descending
            select new OverviewActivityResponse(
                history.Id,
                OverviewActivityKind.CandidateStageChanged,
                history.ChangedAt,
                history.ChangedByUserId,
                changedByUser != null ? changedByUser.DisplayName : null,
                job.Id,
                job.Title,
                candidate.Id,
                candidate.Name,
                history.PreviousStage.ToString(),
                history.NewStage.ToString()))
            .Take(limit)
            .ToArrayAsync(cancellationToken);

        var noteAdded = await (
            from note in dbContext.CandidateNotes.AsNoTracking()
            where note.WorkspaceId == workspaceId
            join candidate in dbContext.Candidates.AsNoTracking() on
                new { note.WorkspaceId, note.CandidateId } equals new { candidate.WorkspaceId, CandidateId = candidate.Id }
            join job in dbContext.JobOpenings.AsNoTracking() on
                new { candidate.WorkspaceId, JobId = candidate.JobOpeningId } equals new { job.WorkspaceId, JobId = job.Id }
            join user in dbContext.Users on note.AuthorUserId equals user.Id into authors
            from author in authors.DefaultIfEmpty()
            orderby note.CreatedAt descending, note.Id descending
            select new OverviewActivityResponse(
                note.Id,
                OverviewActivityKind.CandidateNoteAdded,
                note.CreatedAt,
                note.AuthorUserId,
                author != null ? author.DisplayName : null,
                job.Id,
                job.Title,
                candidate.Id,
                candidate.Name,
                null,
                null))
            .Take(limit)
            .ToArrayAsync(cancellationToken);

        return jobCreated
            .Concat(candidateAdded)
            .Concat(stageChanged)
            .Concat(noteAdded)
            .OrderByDescending(activity => activity.OccurredAt)
            .ThenBy(activity => activity.Kind, StringComparer.Ordinal)
            .ThenBy(activity => activity.Id)
            .Take(limit)
            .ToArray();
    }

    private static CandidateStageCountsResponse ToStageCounts(IEnumerable<(CandidateStage Stage, int Count)> counts)
    {
        var byStage = counts.ToDictionary(entry => entry.Stage, entry => entry.Count);
        return new CandidateStageCountsResponse(
            byStage.GetValueOrDefault(CandidateStage.Applied),
            byStage.GetValueOrDefault(CandidateStage.Screening),
            byStage.GetValueOrDefault(CandidateStage.Interview),
            byStage.GetValueOrDefault(CandidateStage.Offer),
            byStage.GetValueOrDefault(CandidateStage.Rejected));
    }
}
