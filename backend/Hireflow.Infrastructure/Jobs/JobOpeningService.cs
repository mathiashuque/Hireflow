using Hireflow.Application.Jobs;
using Hireflow.Domain.Jobs;
using Hireflow.Domain.Workspaces;
using Hireflow.Infrastructure.Persistence;
using Hireflow.Infrastructure.Workspaces;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Hireflow.Infrastructure.Jobs;

public sealed class JobOpeningService(HireflowDbContext dbContext, TimeProvider timeProvider, ILogger<JobOpeningService> logger)
    : IJobOpeningService
{
    public async Task<CreateJobOpeningResult> CreateAsync(
        Guid workspaceId,
        Guid callerUserId,
        CreateJobOpeningRequest request,
        CancellationToken cancellationToken)
    {
        var callerRole = await WorkspaceAccessQueries.GetCallerRoleAsync(dbContext, workspaceId, callerUserId, cancellationToken);
        if (callerRole is null)
        {
            return CreateJobOpeningResult.NotFound();
        }

        if (callerRole is not (WorkspaceRole.Owner or WorkspaceRole.Recruiter))
        {
            return CreateJobOpeningResult.Forbidden();
        }

        var title = request.Title.Trim();
        if (title.Length is 0 or > 200)
        {
            return CreateJobOpeningResult.ValidationFailed(["Title must be between 1 and 200 characters."]);
        }

        var description = NormalizeDescription(request.Description);
        var now = timeProvider.GetUtcNow();

        var job = new JobOpening
        {
            Id = Guid.NewGuid(),
            WorkspaceId = workspaceId,
            Title = title,
            Description = description,
            CreatedByUserId = callerUserId,
            CreatedAt = now,
            UpdatedAt = now,
        };

        dbContext.JobOpenings.Add(job);
        await dbContext.SaveChangesAsync(cancellationToken);

        logger.LogInformation("Job opening {JobId} created in workspace {WorkspaceId} by user {UserId}.", job.Id, workspaceId, callerUserId);

        return CreateJobOpeningResult.Success(ToResponse(job, CurrentVersion(job)));
    }

    public async Task<ListJobOpeningsResult> ListAsync(
        Guid workspaceId,
        Guid callerUserId,
        string? statusFilter,
        CancellationToken cancellationToken)
    {
        var callerRole = await WorkspaceAccessQueries.GetCallerRoleAsync(dbContext, workspaceId, callerUserId, cancellationToken);
        if (callerRole is null)
        {
            return ListJobOpeningsResult.NotFound();
        }

        JobOpeningStatus? status = null;
        if (!string.IsNullOrWhiteSpace(statusFilter))
        {
            if (!Enum.TryParse<JobOpeningStatus>(statusFilter, ignoreCase: true, out var parsedStatus))
            {
                return ListJobOpeningsResult.ValidationFailed(["Status filter must be Draft, Open, or Closed."]);
            }

            status = parsedStatus;
        }

        var query = dbContext.JobOpenings.Where(job => job.WorkspaceId == workspaceId);
        if (status is not null)
        {
            query = query.Where(job => job.Status == status);
        }

        var jobs = await query
            .OrderByDescending(job => job.UpdatedAt)
            .ThenBy(job => job.Id)
            .Select(job => new JobOpeningResponse(
                job.Id,
                job.WorkspaceId,
                job.Title,
                job.Description,
                job.Status.ToString(),
                job.CreatedByUserId,
                job.CreatedAt,
                job.UpdatedAt,
                job.ClosedAt,
                EF.Property<uint>(job, "xmin").ToString()))
            .ToArrayAsync(cancellationToken);

        return ListJobOpeningsResult.Success(jobs);
    }

    public async Task<JobOpeningResponse?> GetAsync(Guid workspaceId, Guid callerUserId, Guid jobId, CancellationToken cancellationToken)
    {
        var callerRole = await WorkspaceAccessQueries.GetCallerRoleAsync(dbContext, workspaceId, callerUserId, cancellationToken);
        if (callerRole is null)
        {
            return null;
        }

        return await dbContext.JobOpenings
            .Where(job => job.WorkspaceId == workspaceId && job.Id == jobId)
            .Select(job => new JobOpeningResponse(
                job.Id,
                job.WorkspaceId,
                job.Title,
                job.Description,
                job.Status.ToString(),
                job.CreatedByUserId,
                job.CreatedAt,
                job.UpdatedAt,
                job.ClosedAt,
                EF.Property<uint>(job, "xmin").ToString()))
            .SingleOrDefaultAsync(cancellationToken);
    }

    public async Task<UpdateJobOpeningResult> UpdateAsync(
        Guid workspaceId,
        Guid callerUserId,
        Guid jobId,
        UpdateJobOpeningRequest request,
        CancellationToken cancellationToken)
    {
        var callerRole = await WorkspaceAccessQueries.GetCallerRoleAsync(dbContext, workspaceId, callerUserId, cancellationToken);
        if (callerRole is null)
        {
            return UpdateJobOpeningResult.NotFound();
        }

        if (callerRole is not (WorkspaceRole.Owner or WorkspaceRole.Recruiter))
        {
            return UpdateJobOpeningResult.Forbidden();
        }

        var title = request.Title.Trim();
        if (title.Length is 0 or > 200)
        {
            return UpdateJobOpeningResult.ValidationFailed(["Title must be between 1 and 200 characters."]);
        }

        if (!uint.TryParse(request.Version, out var expectedVersion))
        {
            return UpdateJobOpeningResult.ValidationFailed(["Version is missing or invalid; reload the job and try again."]);
        }

        var job = await dbContext.JobOpenings
            .SingleOrDefaultAsync(candidate => candidate.WorkspaceId == workspaceId && candidate.Id == jobId, cancellationToken);
        if (job is null)
        {
            return UpdateJobOpeningResult.NotFound();
        }

        SetExpectedVersion(job, expectedVersion);
        job.Edit(title, NormalizeDescription(request.Description), timeProvider.GetUtcNow());

        try
        {
            await dbContext.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateConcurrencyException)
        {
            dbContext.Entry(job).State = EntityState.Detached;
            return UpdateJobOpeningResult.ConcurrencyConflict();
        }

        logger.LogInformation("Job opening {JobId} in workspace {WorkspaceId} edited by user {UserId}.", jobId, workspaceId, callerUserId);

        return UpdateJobOpeningResult.Success(ToResponse(job, CurrentVersion(job)));
    }

    public async Task<ChangeJobOpeningStatusResult> ChangeStatusAsync(
        Guid workspaceId,
        Guid callerUserId,
        Guid jobId,
        ChangeJobOpeningStatusRequest request,
        CancellationToken cancellationToken)
    {
        var callerRole = await WorkspaceAccessQueries.GetCallerRoleAsync(dbContext, workspaceId, callerUserId, cancellationToken);
        if (callerRole is null)
        {
            return ChangeJobOpeningStatusResult.NotFound();
        }

        if (callerRole is not (WorkspaceRole.Owner or WorkspaceRole.Recruiter))
        {
            return ChangeJobOpeningStatusResult.Forbidden();
        }

        if (!Enum.TryParse<JobOpeningStatus>(request.Status, ignoreCase: true, out var targetStatus)
            || targetStatus is not (JobOpeningStatus.Open or JobOpeningStatus.Closed))
        {
            return ChangeJobOpeningStatusResult.ValidationFailed(["Status must be Open or Closed."]);
        }

        if (!uint.TryParse(request.Version, out var expectedVersion))
        {
            return ChangeJobOpeningStatusResult.ValidationFailed(["Version is missing or invalid; reload the job and try again."]);
        }

        var job = await dbContext.JobOpenings
            .SingleOrDefaultAsync(candidate => candidate.WorkspaceId == workspaceId && candidate.Id == jobId, cancellationToken);
        if (job is null)
        {
            return ChangeJobOpeningStatusResult.NotFound();
        }

        if (!job.TryTransitionTo(targetStatus, timeProvider.GetUtcNow()))
        {
            return ChangeJobOpeningStatusResult.InvalidTransition();
        }

        SetExpectedVersion(job, expectedVersion);

        try
        {
            await dbContext.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateConcurrencyException)
        {
            dbContext.Entry(job).State = EntityState.Detached;
            return ChangeJobOpeningStatusResult.ConcurrencyConflict();
        }

        logger.LogInformation(
            "Job opening {JobId} in workspace {WorkspaceId} moved to {Status} by user {UserId}.",
            jobId, workspaceId, targetStatus, callerUserId);

        return ChangeJobOpeningStatusResult.Success(ToResponse(job, CurrentVersion(job)));
    }

    private void SetExpectedVersion(JobOpening job, uint expectedVersion) =>
        dbContext.Entry(job).Property("xmin").OriginalValue = expectedVersion;

    private uint CurrentVersion(JobOpening job) =>
        dbContext.Entry(job).Property<uint>("xmin").CurrentValue;

    private static string? NormalizeDescription(string? description)
    {
        var trimmed = description?.Trim();
        return string.IsNullOrEmpty(trimmed) ? null : trimmed;
    }

    private static JobOpeningResponse ToResponse(JobOpening job, uint version) => new(
        job.Id,
        job.WorkspaceId,
        job.Title,
        job.Description,
        job.Status.ToString(),
        job.CreatedByUserId,
        job.CreatedAt,
        job.UpdatedAt,
        job.ClosedAt,
        version.ToString());
}
