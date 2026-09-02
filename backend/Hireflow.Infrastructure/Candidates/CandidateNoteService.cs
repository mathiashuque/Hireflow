using Hireflow.Application.Candidates;
using Hireflow.Domain.Candidates;
using Hireflow.Infrastructure.Persistence;
using Hireflow.Infrastructure.Workspaces;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Hireflow.Infrastructure.Candidates;

public sealed class CandidateNoteService(
    HireflowDbContext dbContext,
    TimeProvider timeProvider,
    ILogger<CandidateNoteService> logger)
    : ICandidateNoteService
{
    public async Task<CreateCandidateNoteResult> CreateAsync(
        Guid workspaceId,
        Guid callerUserId,
        Guid candidateId,
        CreateCandidateNoteRequest request,
        CancellationToken cancellationToken)
    {
        var callerRole = await WorkspaceAccessQueries.GetCallerRoleAsync(dbContext, workspaceId, callerUserId, cancellationToken);
        if (callerRole is null)
        {
            return CreateCandidateNoteResult.NotFound();
        }

        var content = request.Content.Trim();
        if (content.Length is 0 or > 4000)
        {
            return CreateCandidateNoteResult.ValidationFailed(["Note content must be between 1 and 4,000 characters."]);
        }

        var candidateExists = await dbContext.Candidates
            .AnyAsync(candidate => candidate.WorkspaceId == workspaceId && candidate.Id == candidateId, cancellationToken);
        if (!candidateExists)
        {
            return CreateCandidateNoteResult.NotFound();
        }

        var now = timeProvider.GetUtcNow();

        var note = new CandidateNote
        {
            Id = Guid.NewGuid(),
            WorkspaceId = workspaceId,
            CandidateId = candidateId,
            AuthorUserId = callerUserId,
            Content = content,
            CreatedAt = now,
        };

        dbContext.CandidateNotes.Add(note);
        await dbContext.SaveChangesAsync(cancellationToken);

        logger.LogInformation(
            "Note {NoteId} added to candidate {CandidateId} in workspace {WorkspaceId} by user {UserId}.",
            note.Id, candidateId, workspaceId, callerUserId);

        var authorDisplayName = await dbContext.Users
            .Where(user => user.Id == callerUserId)
            .Select(user => user.DisplayName)
            .SingleOrDefaultAsync(cancellationToken);

        return CreateCandidateNoteResult.Success(new CandidateNoteResponse(
            note.Id,
            note.CandidateId,
            note.Content,
            note.AuthorUserId,
            authorDisplayName,
            note.CreatedAt));
    }

    public async Task<ListCandidateNotesResult> ListAsync(
        Guid workspaceId,
        Guid callerUserId,
        Guid candidateId,
        CancellationToken cancellationToken)
    {
        var callerRole = await WorkspaceAccessQueries.GetCallerRoleAsync(dbContext, workspaceId, callerUserId, cancellationToken);
        if (callerRole is null)
        {
            return ListCandidateNotesResult.NotFound();
        }

        var candidateExists = await dbContext.Candidates
            .AnyAsync(candidate => candidate.WorkspaceId == workspaceId && candidate.Id == candidateId, cancellationToken);
        if (!candidateExists)
        {
            return ListCandidateNotesResult.NotFound();
        }

        var notes = await (
            from note in dbContext.CandidateNotes
            where note.WorkspaceId == workspaceId && note.CandidateId == candidateId
            join user in dbContext.Users on note.AuthorUserId equals user.Id into authors
            from author in authors.DefaultIfEmpty()
            orderby note.CreatedAt, note.Id
            select new CandidateNoteResponse(
                note.Id,
                note.CandidateId,
                note.Content,
                note.AuthorUserId,
                author != null ? author.DisplayName : null,
                note.CreatedAt))
            .ToArrayAsync(cancellationToken);

        return ListCandidateNotesResult.Success(notes);
    }
}
