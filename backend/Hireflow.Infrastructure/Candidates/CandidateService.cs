using Hireflow.Application.Candidates;
using Hireflow.Domain.Candidates;
using Hireflow.Domain.Jobs;
using Hireflow.Domain.Workspaces;
using Hireflow.Infrastructure.Identity;
using Hireflow.Infrastructure.Persistence;
using Hireflow.Infrastructure.Workspaces;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Npgsql;

namespace Hireflow.Infrastructure.Candidates;

public sealed class CandidateService(
    HireflowDbContext dbContext,
    UserManager<HireflowUser> userManager,
    TimeProvider timeProvider,
    ILogger<CandidateService> logger)
    : ICandidateService
{
    public async Task<CreateCandidateResult> CreateAsync(
        Guid workspaceId,
        Guid jobId,
        Guid callerUserId,
        CreateCandidateRequest request,
        CancellationToken cancellationToken)
    {
        var callerRole = await WorkspaceAccessQueries.GetCallerRoleAsync(dbContext, workspaceId, callerUserId, cancellationToken);
        if (callerRole is null)
        {
            return CreateCandidateResult.NotFound();
        }

        if (callerRole is not (WorkspaceRole.Owner or WorkspaceRole.Recruiter))
        {
            return CreateCandidateResult.Forbidden();
        }

        var job = await dbContext.JobOpenings
            .Where(candidateJob => candidateJob.WorkspaceId == workspaceId && candidateJob.Id == jobId)
            .Select(candidateJob => new { candidateJob.Status })
            .SingleOrDefaultAsync(cancellationToken);
        if (job is null)
        {
            return CreateCandidateResult.NotFound();
        }

        if (job.Status != JobOpeningStatus.Open)
        {
            return CreateCandidateResult.JobNotOpen();
        }

        var name = request.Name.Trim();
        if (name.Length is 0 or > 200)
        {
            return CreateCandidateResult.ValidationFailed(["Name must be between 1 and 200 characters."]);
        }

        var email = request.Email.Trim();
        var normalizedEmail = NormalizeEmail(email);
        if (email.Length is 0 or > 256 || normalizedEmail is null)
        {
            return CreateCandidateResult.ValidationFailed(["Email must be a valid address of at most 256 characters."]);
        }

        var now = timeProvider.GetUtcNow();

        var candidate = new Candidate
        {
            Id = Guid.NewGuid(),
            WorkspaceId = workspaceId,
            JobOpeningId = jobId,
            Name = name,
            Email = email,
            NormalizedEmail = normalizedEmail,
            CreatedByUserId = callerUserId,
            CreatedAt = now,
            UpdatedAt = now,
        };

        dbContext.Candidates.Add(candidate);

        try
        {
            await dbContext.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException ex) when (IsUniqueViolation(ex))
        {
            dbContext.Entry(candidate).State = EntityState.Detached;
            logger.LogInformation(
                "Concurrent candidate create collided for job {JobId} in workspace {WorkspaceId}.", jobId, workspaceId);
            return CreateCandidateResult.DuplicateEmail();
        }

        logger.LogInformation(
            "Candidate {CandidateId} created for job {JobId} in workspace {WorkspaceId} by user {UserId}.",
            candidate.Id, jobId, workspaceId, callerUserId);

        return CreateCandidateResult.Success(ToResponse(candidate, CurrentVersion(candidate)));
    }

    public async Task<ListCandidatesResult> ListAsync(
        Guid workspaceId,
        Guid jobId,
        Guid callerUserId,
        string? stageFilter,
        CancellationToken cancellationToken)
    {
        var callerRole = await WorkspaceAccessQueries.GetCallerRoleAsync(dbContext, workspaceId, callerUserId, cancellationToken);
        if (callerRole is null)
        {
            return ListCandidatesResult.NotFound();
        }

        var jobExists = await dbContext.JobOpenings
            .AnyAsync(job => job.WorkspaceId == workspaceId && job.Id == jobId, cancellationToken);
        if (!jobExists)
        {
            return ListCandidatesResult.NotFound();
        }

        CandidateStage? stage = null;
        if (!string.IsNullOrWhiteSpace(stageFilter))
        {
            if (!Enum.TryParse<CandidateStage>(stageFilter, ignoreCase: true, out var parsedStage))
            {
                return ListCandidatesResult.ValidationFailed(["Stage filter must be Applied, Screening, Interview, Offer, or Rejected."]);
            }

            stage = parsedStage;
        }

        var query = dbContext.Candidates
            .Where(candidate => candidate.WorkspaceId == workspaceId && candidate.JobOpeningId == jobId);
        if (stage is not null)
        {
            query = query.Where(candidate => candidate.Stage == stage);
        }

        var candidates = await query
            .OrderByDescending(candidate => candidate.UpdatedAt)
            .ThenBy(candidate => candidate.Id)
            .Select(candidate => new CandidateResponse(
                candidate.Id,
                candidate.WorkspaceId,
                candidate.JobOpeningId,
                candidate.Name,
                candidate.Email,
                candidate.Stage.ToString(),
                candidate.CreatedByUserId,
                candidate.CreatedAt,
                candidate.UpdatedAt,
                EF.Property<uint>(candidate, "xmin").ToString()))
            .ToArrayAsync(cancellationToken);

        return ListCandidatesResult.Success(candidates);
    }

    public async Task<CandidateResponse?> GetAsync(Guid workspaceId, Guid callerUserId, Guid candidateId, CancellationToken cancellationToken)
    {
        var callerRole = await WorkspaceAccessQueries.GetCallerRoleAsync(dbContext, workspaceId, callerUserId, cancellationToken);
        if (callerRole is null)
        {
            return null;
        }

        return await dbContext.Candidates
            .Where(candidate => candidate.WorkspaceId == workspaceId && candidate.Id == candidateId)
            .Select(candidate => new CandidateResponse(
                candidate.Id,
                candidate.WorkspaceId,
                candidate.JobOpeningId,
                candidate.Name,
                candidate.Email,
                candidate.Stage.ToString(),
                candidate.CreatedByUserId,
                candidate.CreatedAt,
                candidate.UpdatedAt,
                EF.Property<uint>(candidate, "xmin").ToString()))
            .SingleOrDefaultAsync(cancellationToken);
    }

    public async Task<UpdateCandidateResult> UpdateAsync(
        Guid workspaceId,
        Guid callerUserId,
        Guid candidateId,
        UpdateCandidateRequest request,
        CancellationToken cancellationToken)
    {
        var callerRole = await WorkspaceAccessQueries.GetCallerRoleAsync(dbContext, workspaceId, callerUserId, cancellationToken);
        if (callerRole is null)
        {
            return UpdateCandidateResult.NotFound();
        }

        if (callerRole is not (WorkspaceRole.Owner or WorkspaceRole.Recruiter))
        {
            return UpdateCandidateResult.Forbidden();
        }

        var name = request.Name.Trim();
        if (name.Length is 0 or > 200)
        {
            return UpdateCandidateResult.ValidationFailed(["Name must be between 1 and 200 characters."]);
        }

        var email = request.Email.Trim();
        var normalizedEmail = NormalizeEmail(email);
        if (email.Length is 0 or > 256 || normalizedEmail is null)
        {
            return UpdateCandidateResult.ValidationFailed(["Email must be a valid address of at most 256 characters."]);
        }

        if (!uint.TryParse(request.Version, out var expectedVersion))
        {
            return UpdateCandidateResult.ValidationFailed(["Version is missing or invalid; reload the candidate and try again."]);
        }

        var candidate = await dbContext.Candidates
            .SingleOrDefaultAsync(existing => existing.WorkspaceId == workspaceId && existing.Id == candidateId, cancellationToken);
        if (candidate is null)
        {
            return UpdateCandidateResult.NotFound();
        }

        SetExpectedVersion(candidate, expectedVersion);
        candidate.Edit(name, email, normalizedEmail, timeProvider.GetUtcNow());

        try
        {
            await dbContext.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateConcurrencyException)
        {
            dbContext.Entry(candidate).State = EntityState.Detached;
            return UpdateCandidateResult.ConcurrencyConflict();
        }
        catch (DbUpdateException ex) when (IsUniqueViolation(ex))
        {
            dbContext.Entry(candidate).State = EntityState.Detached;
            return UpdateCandidateResult.DuplicateEmail();
        }

        logger.LogInformation(
            "Candidate {CandidateId} in workspace {WorkspaceId} edited by user {UserId}.", candidateId, workspaceId, callerUserId);

        return UpdateCandidateResult.Success(ToResponse(candidate, CurrentVersion(candidate)));
    }

    public async Task<MoveCandidateStageResult> MoveStageAsync(
        Guid workspaceId,
        Guid callerUserId,
        Guid candidateId,
        MoveCandidateStageRequest request,
        CancellationToken cancellationToken)
    {
        var callerRole = await WorkspaceAccessQueries.GetCallerRoleAsync(dbContext, workspaceId, callerUserId, cancellationToken);
        if (callerRole is null)
        {
            return MoveCandidateStageResult.NotFound();
        }

        if (callerRole is not (WorkspaceRole.Owner or WorkspaceRole.Recruiter))
        {
            return MoveCandidateStageResult.Forbidden();
        }

        if (!Enum.TryParse<CandidateStage>(request.Stage, ignoreCase: true, out var targetStage))
        {
            return MoveCandidateStageResult.ValidationFailed(["Stage must be Applied, Screening, Interview, Offer, or Rejected."]);
        }

        if (!uint.TryParse(request.Version, out var expectedVersion))
        {
            return MoveCandidateStageResult.ValidationFailed(["Version is missing or invalid; reload the candidate and try again."]);
        }

        var candidate = await dbContext.Candidates
            .SingleOrDefaultAsync(existing => existing.WorkspaceId == workspaceId && existing.Id == candidateId, cancellationToken);
        if (candidate is null)
        {
            return MoveCandidateStageResult.NotFound();
        }

        SetExpectedVersion(candidate, expectedVersion);

        var now = timeProvider.GetUtcNow();
        if (!candidate.TryMoveToStage(targetStage, now, out var previousStage))
        {
            return MoveCandidateStageResult.NoOpTransition();
        }

        dbContext.CandidateStageHistories.Add(new CandidateStageHistory
        {
            Id = Guid.NewGuid(),
            WorkspaceId = workspaceId,
            CandidateId = candidateId,
            PreviousStage = previousStage,
            NewStage = targetStage,
            ChangedByUserId = callerUserId,
            ChangedAt = now,
        });

        try
        {
            await dbContext.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateConcurrencyException)
        {
            dbContext.Entry(candidate).State = EntityState.Detached;
            return MoveCandidateStageResult.ConcurrencyConflict();
        }

        logger.LogInformation(
            "Candidate {CandidateId} in workspace {WorkspaceId} moved {PreviousStage} -> {NewStage} by user {UserId}.",
            candidateId, workspaceId, previousStage, targetStage, callerUserId);

        return MoveCandidateStageResult.Success(ToResponse(candidate, CurrentVersion(candidate)));
    }

    public async Task<GetCandidateHistoryResult> GetHistoryAsync(
        Guid workspaceId,
        Guid callerUserId,
        Guid candidateId,
        CancellationToken cancellationToken)
    {
        var callerRole = await WorkspaceAccessQueries.GetCallerRoleAsync(dbContext, workspaceId, callerUserId, cancellationToken);
        if (callerRole is null)
        {
            return GetCandidateHistoryResult.NotFound();
        }

        var candidateExists = await dbContext.Candidates
            .AnyAsync(candidate => candidate.WorkspaceId == workspaceId && candidate.Id == candidateId, cancellationToken);
        if (!candidateExists)
        {
            return GetCandidateHistoryResult.NotFound();
        }

        var history = await (
            from entry in dbContext.CandidateStageHistories
            where entry.WorkspaceId == workspaceId && entry.CandidateId == candidateId
            join user in dbContext.Users on entry.ChangedByUserId equals user.Id into changedByUsers
            from changedByUser in changedByUsers.DefaultIfEmpty()
            orderby entry.ChangedAt descending, entry.Id
            select new CandidateStageHistoryResponse(
                entry.Id,
                entry.CandidateId,
                entry.PreviousStage.ToString(),
                entry.NewStage.ToString(),
                entry.ChangedByUserId,
                changedByUser != null ? changedByUser.DisplayName : null,
                entry.ChangedAt))
            .ToArrayAsync(cancellationToken);

        return GetCandidateHistoryResult.Success(history);
    }

    private string? NormalizeEmail(string email)
    {
        if (string.IsNullOrWhiteSpace(email))
        {
            return null;
        }

        return userManager.NormalizeEmail(email) ?? email.ToUpperInvariant();
    }

    private void SetExpectedVersion(Candidate candidate, uint expectedVersion) =>
        dbContext.Entry(candidate).Property("xmin").OriginalValue = expectedVersion;

    private uint CurrentVersion(Candidate candidate) =>
        dbContext.Entry(candidate).Property<uint>("xmin").CurrentValue;

    private static bool IsUniqueViolation(DbUpdateException exception) =>
        exception.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation };

    private static CandidateResponse ToResponse(Candidate candidate, uint version) => new(
        candidate.Id,
        candidate.WorkspaceId,
        candidate.JobOpeningId,
        candidate.Name,
        candidate.Email,
        candidate.Stage.ToString(),
        candidate.CreatedByUserId,
        candidate.CreatedAt,
        candidate.UpdatedAt,
        version.ToString());
}
