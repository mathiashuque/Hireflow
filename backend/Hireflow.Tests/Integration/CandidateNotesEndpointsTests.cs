using System.Net;
using System.Net.Http.Json;
using Hireflow.Application.Auth;
using Hireflow.Application.Candidates;
using Hireflow.Application.Jobs;
using Hireflow.Application.Workspaces;
using Hireflow.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace Hireflow.Tests.Integration;

[Collection(PostgresCollection.Name)]
public sealed class CandidateNotesEndpointsTests(PostgresContainerFixture postgres) : IAsyncLifetime
{
    private HireflowApiFactory _factory = null!;

    public async Task InitializeAsync()
    {
        _factory = new HireflowApiFactory(postgres.ConnectionString);
        await _factory.MigrateDatabaseAsync();
    }

    public Task DisposeAsync()
    {
        _factory.Dispose();
        return Task.CompletedTask;
    }

    [Fact]
    public async Task Owner_recruiter_and_interviewer_can_each_add_and_read_notes()
    {
        var (owner, ownerCookies) = await CreateAuthenticatedClientAsync("Owner");
        var workspaceId = await CreateWorkspaceAsync(owner, ownerCookies, "Acme");
        var job = await CreateOpenJobAsync(owner, ownerCookies, workspaceId, "Backend Engineer");
        var candidate = await CreateCandidateAsync(owner, ownerCookies, workspaceId, job.Id, "Alice Example", "alice@example.com");
        var (recruiter, recruiterCookies, _) = await AddMemberAsync(owner, ownerCookies, workspaceId, "Recruiter1", "Recruiter");
        var (interviewer, interviewerCookies, _) = await AddMemberAsync(owner, ownerCookies, workspaceId, "Interviewer1", "Interviewer");

        var ownerNote = await AddNoteAsync(owner, ownerCookies, workspaceId, candidate.Id, "Strong technical interview.");
        Assert.Equal(HttpStatusCode.OK, ownerNote.Response.StatusCode);

        var recruiterNote = await AddNoteAsync(recruiter, recruiterCookies, workspaceId, candidate.Id, "Scheduling onsite next week.");
        Assert.Equal(HttpStatusCode.OK, recruiterNote.Response.StatusCode);

        var interviewerNote = await AddNoteAsync(interviewer, interviewerCookies, workspaceId, candidate.Id, "Great communication skills.");
        Assert.Equal(HttpStatusCode.OK, interviewerNote.Response.StatusCode);

        var notes = await GetNotesAsync(interviewer, workspaceId, candidate.Id);
        Assert.Equal(3, notes.Count);
        // Oldest first, then ID.
        Assert.Equal("Strong technical interview.", notes[0].Content);
        Assert.Equal("Scheduling onsite next week.", notes[1].Content);
        Assert.Equal("Great communication skills.", notes[2].Content);
        Assert.All(notes, note => Assert.False(string.IsNullOrWhiteSpace(note.AuthorDisplayName)));
    }

    [Fact]
    public async Task Note_content_is_trimmed_and_preserves_internal_newlines()
    {
        var (owner, ownerCookies) = await CreateAuthenticatedClientAsync("Owner");
        var workspaceId = await CreateWorkspaceAsync(owner, ownerCookies, "Acme");
        var job = await CreateOpenJobAsync(owner, ownerCookies, workspaceId, "Backend Engineer");
        var candidate = await CreateCandidateAsync(owner, ownerCookies, workspaceId, job.Id, "Alice Example", "alice@example.com");

        var result = await AddNoteAsync(owner, ownerCookies, workspaceId, candidate.Id, "  Line one\nLine two  ");
        Assert.Equal(HttpStatusCode.OK, result.Response.StatusCode);
        Assert.Equal("Line one\nLine two", result.Note!.Content);
    }

    [Fact]
    public async Task Blank_and_overlong_content_is_rejected_without_insertion()
    {
        var (owner, ownerCookies) = await CreateAuthenticatedClientAsync("Owner");
        var workspaceId = await CreateWorkspaceAsync(owner, ownerCookies, "Acme");
        var job = await CreateOpenJobAsync(owner, ownerCookies, workspaceId, "Backend Engineer");
        var candidate = await CreateCandidateAsync(owner, ownerCookies, workspaceId, job.Id, "Alice Example", "alice@example.com");

        var blank = await AddNoteAsync(owner, ownerCookies, workspaceId, candidate.Id, "   ");
        Assert.Equal(HttpStatusCode.BadRequest, blank.Response.StatusCode);

        var overlong = await AddNoteAsync(owner, ownerCookies, workspaceId, candidate.Id, new string('a', 4001));
        Assert.Equal(HttpStatusCode.BadRequest, overlong.Response.StatusCode);

        var notes = await GetNotesAsync(owner, workspaceId, candidate.Id);
        Assert.Empty(notes);
    }

    [Fact]
    public async Task Html_like_content_is_stored_and_returned_as_inert_plain_text()
    {
        var (owner, ownerCookies) = await CreateAuthenticatedClientAsync("Owner");
        var workspaceId = await CreateWorkspaceAsync(owner, ownerCookies, "Acme");
        var job = await CreateOpenJobAsync(owner, ownerCookies, workspaceId, "Backend Engineer");
        var candidate = await CreateCandidateAsync(owner, ownerCookies, workspaceId, job.Id, "Alice Example", "alice@example.com");

        const string htmlLike = "<script>alert('x')</script>";
        var result = await AddNoteAsync(owner, ownerCookies, workspaceId, candidate.Id, htmlLike);
        Assert.Equal(HttpStatusCode.OK, result.Response.StatusCode);
        Assert.Equal(htmlLike, result.Note!.Content);

        var notes = await GetNotesAsync(owner, workspaceId, candidate.Id);
        Assert.Equal(htmlLike, notes[0].Content);
    }

    [Fact]
    public async Task Anonymous_requests_are_unauthorized_and_nonmembers_get_non_enumerating_not_found()
    {
        var (owner, ownerCookies) = await CreateAuthenticatedClientAsync("Owner");
        var workspaceId = await CreateWorkspaceAsync(owner, ownerCookies, "Acme");
        var job = await CreateOpenJobAsync(owner, ownerCookies, workspaceId, "Backend Engineer");
        var candidate = await CreateCandidateAsync(owner, ownerCookies, workspaceId, job.Id, "Alice Example", "alice@example.com");

        var anonymous = _factory.CreateDefaultClient(new CookieCapturingHandler());
        Assert.Equal(
            HttpStatusCode.Unauthorized,
            (await anonymous.GetAsync($"/api/workspaces/{workspaceId}/candidates/{candidate.Id}/notes")).StatusCode);

        var (outsider, outsiderCookies) = await CreateAuthenticatedClientAsync("Outsider");
        var outsiderRead = await outsider.GetAsync($"/api/workspaces/{workspaceId}/candidates/{candidate.Id}/notes");
        Assert.Equal(HttpStatusCode.NotFound, outsiderRead.StatusCode);

        var outsiderWrite = await AddNoteAsync(outsider, outsiderCookies, workspaceId, candidate.Id, "Sneaky note");
        Assert.Equal(HttpStatusCode.NotFound, outsiderWrite.Response.StatusCode);

        var notes = await GetNotesAsync(owner, workspaceId, candidate.Id);
        Assert.Empty(notes);
    }

    [Fact]
    public async Task Missing_csrf_token_is_rejected_without_insertion()
    {
        var (owner, ownerCookies) = await CreateAuthenticatedClientAsync("Owner");
        var workspaceId = await CreateWorkspaceAsync(owner, ownerCookies, "Acme");
        var job = await CreateOpenJobAsync(owner, ownerCookies, workspaceId, "Backend Engineer");
        var candidate = await CreateCandidateAsync(owner, ownerCookies, workspaceId, job.Id, "Alice Example", "alice@example.com");

        var noCsrfRequest = new HttpRequestMessage(HttpMethod.Post, $"/api/workspaces/{workspaceId}/candidates/{candidate.Id}/notes")
        {
            Content = JsonContent.Create(new CreateCandidateNoteRequest { Content = "Note" }),
        };
        var noCsrfResponse = await owner.SendAsync(noCsrfRequest);
        Assert.Equal(HttpStatusCode.BadRequest, noCsrfResponse.StatusCode);

        var notes = await GetNotesAsync(owner, workspaceId, candidate.Id);
        Assert.Empty(notes);
    }

    [Fact]
    public async Task Guessed_cross_tenant_candidate_id_reveals_nothing()
    {
        var (ownerA, ownerACookies) = await CreateAuthenticatedClientAsync("Owner A");
        var workspaceAId = await CreateWorkspaceAsync(ownerA, ownerACookies, "Workspace A");
        var jobA = await CreateOpenJobAsync(ownerA, ownerACookies, workspaceAId, "Job A");
        var candidateA = await CreateCandidateAsync(ownerA, ownerACookies, workspaceAId, jobA.Id, "Alice Example", "alice@example.com");
        await AddNoteAsync(ownerA, ownerACookies, workspaceAId, candidateA.Id, "Workspace A's confidential note");

        var (ownerB, ownerBCookies) = await CreateAuthenticatedClientAsync("Owner B");
        var workspaceBId = await CreateWorkspaceAsync(ownerB, ownerBCookies, "Workspace B");

        var readWrongWorkspace = await ownerB.GetAsync($"/api/workspaces/{workspaceAId}/candidates/{candidateA.Id}/notes");
        Assert.Equal(HttpStatusCode.NotFound, readWrongWorkspace.StatusCode);

        var readGuessedInOwnWorkspace = await ownerB.GetAsync($"/api/workspaces/{workspaceBId}/candidates/{candidateA.Id}/notes");
        Assert.Equal(HttpStatusCode.NotFound, readGuessedInOwnWorkspace.StatusCode);

        var writeAttempt = await AddNoteAsync(ownerB, ownerBCookies, workspaceAId, candidateA.Id, "Sneaky note");
        Assert.Equal(HttpStatusCode.NotFound, writeAttempt.Response.StatusCode);

        var notes = await GetNotesAsync(ownerA, workspaceAId, candidateA.Id);
        Assert.Single(notes);
    }

    [Fact]
    public async Task Removing_a_member_preserves_their_prior_note_but_blocks_further_access()
    {
        var (owner, ownerCookies) = await CreateAuthenticatedClientAsync("Owner");
        var workspaceId = await CreateWorkspaceAsync(owner, ownerCookies, "Acme");
        var job = await CreateOpenJobAsync(owner, ownerCookies, workspaceId, "Backend Engineer");
        var candidate = await CreateCandidateAsync(owner, ownerCookies, workspaceId, job.Id, "Alice Example", "alice@example.com");
        var (interviewer, interviewerCookies, interviewerId) =
            await AddMemberAsync(owner, ownerCookies, workspaceId, "Interviewer1", "Interviewer");

        var note = await AddNoteAsync(interviewer, interviewerCookies, workspaceId, candidate.Id, "Great candidate.");
        Assert.Equal(HttpStatusCode.OK, note.Response.StatusCode);

        await RemoveMemberAsync(owner, ownerCookies, workspaceId, interviewerId);

        var notesAfterRemoval = await GetNotesAsync(owner, workspaceId, candidate.Id);
        Assert.Single(notesAfterRemoval);
        Assert.Equal("Great candidate.", notesAfterRemoval[0].Content);
        Assert.Equal(interviewerId, notesAfterRemoval[0].AuthorUserId);

        var formerMemberRead = await interviewer.GetAsync($"/api/workspaces/{workspaceId}/candidates/{candidate.Id}/notes");
        Assert.Equal(HttpStatusCode.NotFound, formerMemberRead.StatusCode);

        var formerMemberWrite = await AddNoteAsync(interviewer, interviewerCookies, workspaceId, candidate.Id, "Should fail");
        Assert.Equal(HttpStatusCode.NotFound, formerMemberWrite.Response.StatusCode);
    }

    [Fact]
    public async Task Adding_notes_does_not_change_candidate_version_stage_updated_at_or_stage_history()
    {
        var (owner, ownerCookies) = await CreateAuthenticatedClientAsync("Owner");
        var workspaceId = await CreateWorkspaceAsync(owner, ownerCookies, "Acme");
        var job = await CreateOpenJobAsync(owner, ownerCookies, workspaceId, "Backend Engineer");
        var candidate = await CreateCandidateAsync(owner, ownerCookies, workspaceId, job.Id, "Alice Example", "alice@example.com");

        var tasks = new[]
        {
            AddNoteAsync(owner, ownerCookies, workspaceId, candidate.Id, "Note one"),
            AddNoteAsync(owner, ownerCookies, workspaceId, candidate.Id, "Note two"),
            AddNoteAsync(owner, ownerCookies, workspaceId, candidate.Id, "Note three"),
        };
        var results = await Task.WhenAll(tasks);
        Assert.All(results, result => Assert.Equal(HttpStatusCode.OK, result.Response.StatusCode));

        var candidateAfterResponse = await owner.GetAsync($"/api/workspaces/{workspaceId}/candidates/{candidate.Id}");
        var candidateAfter = await candidateAfterResponse.Content.ReadFromJsonAsync<CandidateResponse>();

        Assert.Equal(candidate.Version, candidateAfter!.Version);
        Assert.Equal(candidate.Stage, candidateAfter.Stage);
        Assert.Equal(candidate.UpdatedAt, candidateAfter.UpdatedAt, TimeSpan.FromMilliseconds(1));

        var history = await owner.GetAsync($"/api/workspaces/{workspaceId}/candidates/{candidate.Id}/history");
        var historyEntries = await history.Content.ReadFromJsonAsync<List<CandidateStageHistoryResponse>>();
        Assert.Empty(historyEntries!);

        var notes = await GetNotesAsync(owner, workspaceId, candidate.Id);
        Assert.Equal(3, notes.Count);
    }

    private async Task<List<CandidateNoteResponse>> GetNotesAsync(HttpClient client, Guid workspaceId, Guid candidateId)
    {
        var response = await client.GetAsync($"/api/workspaces/{workspaceId}/candidates/{candidateId}/notes");
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<List<CandidateNoteResponse>>())!;
    }

    private async Task<(HttpResponseMessage Response, CandidateNoteResponse? Note)> AddNoteAsync(
        HttpClient client, CookieCapturingHandler cookies, Guid workspaceId, Guid candidateId, string content)
    {
        var response = await SendAsync(
            client, cookies, HttpMethod.Post, $"/api/workspaces/{workspaceId}/candidates/{candidateId}/notes",
            new CreateCandidateNoteRequest { Content = content });
        var note = response.IsSuccessStatusCode ? await response.Content.ReadFromJsonAsync<CandidateNoteResponse>() : null;
        return (response, note);
    }

    private async Task<CandidateResponse> CreateCandidateAsync(
        HttpClient owner, CookieCapturingHandler ownerCookies, Guid workspaceId, Guid jobId, string name, string email)
    {
        var response = await SendAsync(
            owner, ownerCookies, HttpMethod.Post, $"/api/workspaces/{workspaceId}/jobs/{jobId}/candidates",
            new CreateCandidateRequest { Name = name, Email = email });
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<CandidateResponse>())!;
    }

    private async Task<JobOpeningResponse> CreateOpenJobAsync(HttpClient owner, CookieCapturingHandler ownerCookies, Guid workspaceId, string title)
    {
        var job = await CreateJobAsync(owner, ownerCookies, workspaceId, title);
        return await ChangeJobStatusAsync(owner, ownerCookies, workspaceId, job.Id, "Open", job.Version);
    }

    private async Task<JobOpeningResponse> CreateJobAsync(HttpClient owner, CookieCapturingHandler ownerCookies, Guid workspaceId, string title)
    {
        var response = await SendAsync(
            owner, ownerCookies, HttpMethod.Post, $"/api/workspaces/{workspaceId}/jobs", new CreateJobOpeningRequest { Title = title });
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<JobOpeningResponse>())!;
    }

    private async Task<JobOpeningResponse> ChangeJobStatusAsync(
        HttpClient owner, CookieCapturingHandler ownerCookies, Guid workspaceId, Guid jobId, string status, string version)
    {
        var response = await SendAsync(
            owner, ownerCookies, HttpMethod.Patch, $"/api/workspaces/{workspaceId}/jobs/{jobId}/status",
            new ChangeJobOpeningStatusRequest { Status = status, Version = version });
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<JobOpeningResponse>())!;
    }

    private async Task<(HttpClient Client, CookieCapturingHandler Cookies, Guid UserId)> AddMemberAsync(
        HttpClient owner, CookieCapturingHandler ownerCookies, Guid workspaceId, string displayName, string role)
    {
        var email = $"{displayName.ToLowerInvariant().Replace(" ", "-")}-{Guid.NewGuid():N}@example.com";

        var inviteResponse = await SendAsync(
            owner, ownerCookies, HttpMethod.Post, $"/api/workspaces/{workspaceId}/invitations",
            new CreateInvitationRequest { Email = email, Role = role });
        inviteResponse.EnsureSuccessStatusCode();
        var invitation = await inviteResponse.Content.ReadFromJsonAsync<InvitationCreatedResponse>();

        var (client, cookies) = await CreateAuthenticatedClientAsync(displayName, email);
        var acceptResponse = await SendAsync(client, cookies, HttpMethod.Post, $"/api/invitations/{invitation!.Token}/accept", body: null);
        acceptResponse.EnsureSuccessStatusCode();

        var meResponse = await client.GetAsync("/api/auth/me");
        var me = await meResponse.Content.ReadFromJsonAsync<AuthenticatedUserResponse>();
        return (client, cookies, me!.Id);
    }

    private async Task RemoveMemberAsync(HttpClient owner, CookieCapturingHandler ownerCookies, Guid workspaceId, Guid memberUserId)
    {
        var response = await SendAsync(
            owner, ownerCookies, HttpMethod.Delete, $"/api/workspaces/{workspaceId}/members/{memberUserId}", body: null);
        response.EnsureSuccessStatusCode();
    }

    private async Task<Guid> CreateWorkspaceAsync(HttpClient client, CookieCapturingHandler cookies, string name)
    {
        var uniqueName = $"{name} {Guid.NewGuid():N}";
        var response = await SendAsync(client, cookies, HttpMethod.Post, "/api/workspaces", new CreateWorkspaceRequest { Name = uniqueName });
        response.EnsureSuccessStatusCode();
        var workspace = await response.Content.ReadFromJsonAsync<WorkspaceDetailResponse>();
        return workspace!.Id;
    }

    private async Task<(HttpClient Client, CookieCapturingHandler Cookies)> CreateAuthenticatedClientAsync(
        string displayName,
        string? email = null)
    {
        var cookies = new CookieCapturingHandler();
        var client = _factory.CreateDefaultClient(cookies);

        var registerResponse = await SendAsync(
            client,
            cookies,
            HttpMethod.Post,
            "/api/auth/register",
            new RegisterRequest
            {
                Email = email ?? $"user-{Guid.NewGuid():N}@example.com",
                Password = "Sup3rSecret!",
                DisplayName = displayName,
            });
        registerResponse.EnsureSuccessStatusCode();

        return (client, cookies);
    }

    private static async Task<HttpResponseMessage> SendAsync(
        HttpClient client,
        CookieCapturingHandler cookies,
        HttpMethod method,
        string url,
        object? body)
    {
        var csrfResponse = await client.GetAsync("/api/auth/csrf");
        csrfResponse.EnsureSuccessStatusCode();

        var request = new HttpRequestMessage(method, url);
        if (body is not null)
        {
            request.Content = JsonContent.Create(body);
        }

        if (cookies.Cookies.TryGetValue("XSRF-TOKEN", out var token))
        {
            request.Headers.Add("X-XSRF-TOKEN", token);
        }

        return await client.SendAsync(request);
    }
}
