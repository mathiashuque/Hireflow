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
public sealed class CandidatesEndpointsTests(PostgresContainerFixture postgres) : IAsyncLifetime
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
    public async Task Owner_and_recruiter_can_add_a_candidate_to_an_open_job_others_cannot()
    {
        var (owner, ownerCookies) = await CreateAuthenticatedClientAsync("Owner");
        var workspaceId = await CreateWorkspaceAsync(owner, ownerCookies, "Acme");
        var job = await CreateOpenJobAsync(owner, ownerCookies, workspaceId, "Backend Engineer");
        var (recruiter, recruiterCookies, _) = await AddMemberAsync(owner, ownerCookies, workspaceId, "Recruiter1", "Recruiter");
        var (interviewer, interviewerCookies, _) = await AddMemberAsync(owner, ownerCookies, workspaceId, "Interviewer1", "Interviewer");

        var ownerCreate = await SendAsync(
            owner, ownerCookies, HttpMethod.Post, $"/api/workspaces/{workspaceId}/jobs/{job.Id}/candidates",
            new CreateCandidateRequest { Name = "Alice Example", Email = "alice@example.com" });
        Assert.Equal(HttpStatusCode.OK, ownerCreate.StatusCode);
        var ownerCandidate = await ownerCreate.Content.ReadFromJsonAsync<CandidateResponse>();
        Assert.Equal("Applied", ownerCandidate!.Stage);
        Assert.Equal(workspaceId, ownerCandidate.WorkspaceId);
        Assert.Equal(job.Id, ownerCandidate.JobOpeningId);
        Assert.False(string.IsNullOrWhiteSpace(ownerCandidate.Version));

        var recruiterCreate = await SendAsync(
            recruiter, recruiterCookies, HttpMethod.Post, $"/api/workspaces/{workspaceId}/jobs/{job.Id}/candidates",
            new CreateCandidateRequest { Name = "Bob Example", Email = "bob@example.com" });
        Assert.Equal(HttpStatusCode.OK, recruiterCreate.StatusCode);

        var interviewerCreate = await SendAsync(
            interviewer, interviewerCookies, HttpMethod.Post, $"/api/workspaces/{workspaceId}/jobs/{job.Id}/candidates",
            new CreateCandidateRequest { Name = "Should Not Exist", Email = "nope@example.com" });
        Assert.Equal(HttpStatusCode.Forbidden, interviewerCreate.StatusCode);
    }

    [Fact]
    public async Task Anonymous_nonmember_and_csrf_less_requests_are_rejected()
    {
        var (owner, ownerCookies) = await CreateAuthenticatedClientAsync("Owner");
        var workspaceId = await CreateWorkspaceAsync(owner, ownerCookies, "Acme");
        var job = await CreateOpenJobAsync(owner, ownerCookies, workspaceId, "Backend Engineer");
        var candidate = await CreateCandidateAsync(owner, ownerCookies, workspaceId, job.Id, "Alice Example", "alice@example.com");

        var anonymous = _factory.CreateDefaultClient(new CookieCapturingHandler());
        Assert.Equal(
            HttpStatusCode.Unauthorized,
            (await anonymous.GetAsync($"/api/workspaces/{workspaceId}/jobs/{job.Id}/candidates")).StatusCode);
        Assert.Equal(
            HttpStatusCode.Unauthorized,
            (await anonymous.GetAsync($"/api/workspaces/{workspaceId}/candidates/{candidate.Id}")).StatusCode);

        var (outsider, outsiderCookies) = await CreateAuthenticatedClientAsync("Outsider");
        var outsiderResponse = await SendAsync(
            outsider, outsiderCookies, HttpMethod.Post, $"/api/workspaces/{workspaceId}/jobs/{job.Id}/candidates",
            new CreateCandidateRequest { Name = "Should Not Exist", Email = "nope@example.com" });
        Assert.Equal(HttpStatusCode.NotFound, outsiderResponse.StatusCode);

        var noCsrfRequest = new HttpRequestMessage(HttpMethod.Patch, $"/api/workspaces/{workspaceId}/candidates/{candidate.Id}")
        {
            Content = JsonContent.Create(new UpdateCandidateRequest { Name = "No Csrf", Email = "alice@example.com", Version = candidate.Version }),
        };
        var noCsrfResponse = await owner.SendAsync(noCsrfRequest);
        Assert.Equal(HttpStatusCode.BadRequest, noCsrfResponse.StatusCode);
    }

    [Fact]
    public async Task Create_returns_conflict_for_draft_or_closed_job_and_succeeds_once_open()
    {
        var (owner, ownerCookies) = await CreateAuthenticatedClientAsync("Owner");
        var workspaceId = await CreateWorkspaceAsync(owner, ownerCookies, "Acme");
        var draftJob = await CreateJobAsync(owner, ownerCookies, workspaceId, "Draft Job");

        var draftResponse = await SendAsync(
            owner, ownerCookies, HttpMethod.Post, $"/api/workspaces/{workspaceId}/jobs/{draftJob.Id}/candidates",
            new CreateCandidateRequest { Name = "Alice Example", Email = "alice@example.com" });
        Assert.Equal(HttpStatusCode.Conflict, draftResponse.StatusCode);

        var opened = await ChangeStatusAsync(owner, ownerCookies, workspaceId, draftJob.Id, "Open", draftJob.Version);
        var openResponse = await SendAsync(
            owner, ownerCookies, HttpMethod.Post, $"/api/workspaces/{workspaceId}/jobs/{opened.Id}/candidates",
            new CreateCandidateRequest { Name = "Alice Example", Email = "alice@example.com" });
        Assert.Equal(HttpStatusCode.OK, openResponse.StatusCode);

        var closed = await ChangeStatusAsync(owner, ownerCookies, workspaceId, opened.Id, "Closed", opened.Version);
        var closedResponse = await SendAsync(
            owner, ownerCookies, HttpMethod.Post, $"/api/workspaces/{workspaceId}/jobs/{closed.Id}/candidates",
            new CreateCandidateRequest { Name = "Bob Example", Email = "bob@example.com" });
        Assert.Equal(HttpStatusCode.Conflict, closedResponse.StatusCode);
    }

    [Fact]
    public async Task Duplicate_normalized_email_in_same_job_is_rejected_but_allowed_elsewhere()
    {
        var (owner, ownerCookies) = await CreateAuthenticatedClientAsync("Owner");
        var workspaceId = await CreateWorkspaceAsync(owner, ownerCookies, "Acme");
        var jobA = await CreateOpenJobAsync(owner, ownerCookies, workspaceId, "Job A");
        var jobB = await CreateOpenJobAsync(owner, ownerCookies, workspaceId, "Job B");

        await CreateCandidateAsync(owner, ownerCookies, workspaceId, jobA.Id, "Alice Example", "Alice@Example.com");

        // Same normalized email (different case/whitespace), same job: rejected.
        var duplicateResponse = await SendAsync(
            owner, ownerCookies, HttpMethod.Post, $"/api/workspaces/{workspaceId}/jobs/{jobA.Id}/candidates",
            new CreateCandidateRequest { Name = "Alice Again", Email = " alice@example.com " });
        Assert.Equal(HttpStatusCode.Conflict, duplicateResponse.StatusCode);

        // Same email, different job in the same workspace: allowed.
        var otherJobResponse = await SendAsync(
            owner, ownerCookies, HttpMethod.Post, $"/api/workspaces/{workspaceId}/jobs/{jobB.Id}/candidates",
            new CreateCandidateRequest { Name = "Alice Example", Email = "alice@example.com" });
        Assert.Equal(HttpStatusCode.OK, otherJobResponse.StatusCode);

        // Same email, different workspace entirely: allowed.
        var (ownerC, ownerCCookies) = await CreateAuthenticatedClientAsync("Owner C");
        var workspaceCId = await CreateWorkspaceAsync(ownerC, ownerCCookies, "Workspace C");
        var jobC = await CreateOpenJobAsync(ownerC, ownerCCookies, workspaceCId, "Job C");
        var otherWorkspaceResponse = await SendAsync(
            ownerC, ownerCCookies, HttpMethod.Post, $"/api/workspaces/{workspaceCId}/jobs/{jobC.Id}/candidates",
            new CreateCandidateRequest { Name = "Alice Example", Email = "alice@example.com" });
        Assert.Equal(HttpStatusCode.OK, otherWorkspaceResponse.StatusCode);

        var listResponse = await owner.GetAsync($"/api/workspaces/{workspaceId}/jobs/{jobA.Id}/candidates");
        var list = await listResponse.Content.ReadFromJsonAsync<List<CandidateResponse>>();
        Assert.Single(list!);
    }

    [Fact]
    public async Task Concurrent_duplicate_creates_result_in_exactly_one_persisted_candidate()
    {
        var (owner, ownerCookies) = await CreateAuthenticatedClientAsync("Owner");
        var workspaceId = await CreateWorkspaceAsync(owner, ownerCookies, "Acme");
        var job = await CreateOpenJobAsync(owner, ownerCookies, workspaceId, "Backend Engineer");

        var request = new CreateCandidateRequest { Name = "Alice Example", Email = "alice@example.com" };
        var tasks = Enumerable.Range(0, 8)
            .Select(_ => SendAsync(owner, ownerCookies, HttpMethod.Post, $"/api/workspaces/{workspaceId}/jobs/{job.Id}/candidates", request))
            .ToArray();
        var responses = await Task.WhenAll(tasks);

        Assert.Single(responses, response => response.StatusCode == HttpStatusCode.OK);
        Assert.Equal(responses.Length - 1, responses.Count(response => response.StatusCode == HttpStatusCode.Conflict));

        using var scope = _factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<HireflowDbContext>();
        var persistedCount = await dbContext.Candidates.CountAsync(c => c.JobOpeningId == job.Id);
        Assert.Equal(1, persistedCount);
    }

    [Fact]
    public async Task Any_member_can_list_and_view_candidates_including_interviewer()
    {
        var (owner, ownerCookies) = await CreateAuthenticatedClientAsync("Owner");
        var workspaceId = await CreateWorkspaceAsync(owner, ownerCookies, "Acme");
        var job = await CreateOpenJobAsync(owner, ownerCookies, workspaceId, "Backend Engineer");
        var candidate = await CreateCandidateAsync(owner, ownerCookies, workspaceId, job.Id, "Alice Example", "alice@example.com");
        var (interviewer, interviewerCookies, _) = await AddMemberAsync(owner, ownerCookies, workspaceId, "Interviewer1", "Interviewer");

        var listResponse = await interviewer.GetAsync($"/api/workspaces/{workspaceId}/jobs/{job.Id}/candidates");
        Assert.Equal(HttpStatusCode.OK, listResponse.StatusCode);
        var list = await listResponse.Content.ReadFromJsonAsync<List<CandidateResponse>>();
        Assert.Single(list!);

        var getResponse = await interviewer.GetAsync($"/api/workspaces/{workspaceId}/candidates/{candidate.Id}");
        Assert.Equal(HttpStatusCode.OK, getResponse.StatusCode);
        _ = interviewerCookies;
    }

    [Fact]
    public async Task List_supports_stage_filter_and_deterministic_order_and_rejects_invalid_filter()
    {
        var (owner, ownerCookies) = await CreateAuthenticatedClientAsync("Owner");
        var workspaceId = await CreateWorkspaceAsync(owner, ownerCookies, "Acme");
        var job = await CreateOpenJobAsync(owner, ownerCookies, workspaceId, "Backend Engineer");

        var first = await CreateCandidateAsync(owner, ownerCookies, workspaceId, job.Id, "Alice Example", "alice@example.com");
        var second = await CreateCandidateAsync(owner, ownerCookies, workspaceId, job.Id, "Bob Example", "bob@example.com");

        // Editing the first candidate bumps its UpdatedAt so it should sort first.
        await SendAsync(
            owner, ownerCookies, HttpMethod.Patch, $"/api/workspaces/{workspaceId}/candidates/{first.Id}",
            new UpdateCandidateRequest { Name = "Alice Updated", Email = first.Email, Version = first.Version });

        var listResponse = await owner.GetAsync($"/api/workspaces/{workspaceId}/jobs/{job.Id}/candidates");
        var list = await listResponse.Content.ReadFromJsonAsync<List<CandidateResponse>>();
        Assert.Equal(2, list!.Count);
        Assert.Equal(first.Id, list[0].Id);
        Assert.Equal(second.Id, list[1].Id);

        var appliedOnlyResponse = await owner.GetAsync($"/api/workspaces/{workspaceId}/jobs/{job.Id}/candidates?stage=Applied");
        var appliedOnly = await appliedOnlyResponse.Content.ReadFromJsonAsync<List<CandidateResponse>>();
        Assert.Equal(2, appliedOnly!.Count);

        var rejectedOnlyResponse = await owner.GetAsync($"/api/workspaces/{workspaceId}/jobs/{job.Id}/candidates?stage=Rejected");
        var rejectedOnly = await rejectedOnlyResponse.Content.ReadFromJsonAsync<List<CandidateResponse>>();
        Assert.Empty(rejectedOnly!);

        var invalidResponse = await owner.GetAsync($"/api/workspaces/{workspaceId}/jobs/{job.Id}/candidates?stage=NotAStage");
        Assert.Equal(HttpStatusCode.BadRequest, invalidResponse.StatusCode);
    }

    [Fact]
    public async Task Owner_and_recruiter_can_edit_name_and_email_even_after_job_closes()
    {
        var (owner, ownerCookies) = await CreateAuthenticatedClientAsync("Owner");
        var workspaceId = await CreateWorkspaceAsync(owner, ownerCookies, "Acme");
        var job = await CreateOpenJobAsync(owner, ownerCookies, workspaceId, "Backend Engineer");
        var candidate = await CreateCandidateAsync(owner, ownerCookies, workspaceId, job.Id, "Alice Example", "alice@example.com");

        await ChangeStatusAsync(owner, ownerCookies, workspaceId, job.Id, "Closed", job.Version);

        var editResponse = await SendAsync(
            owner, ownerCookies, HttpMethod.Patch, $"/api/workspaces/{workspaceId}/candidates/{candidate.Id}",
            new UpdateCandidateRequest { Name = "Alice Updated", Email = "alice.updated@example.com", Version = candidate.Version });
        Assert.Equal(HttpStatusCode.OK, editResponse.StatusCode);
        var updated = await editResponse.Content.ReadFromJsonAsync<CandidateResponse>();
        Assert.Equal("Alice Updated", updated!.Name);
        Assert.Equal("alice.updated@example.com", updated.Email);
        Assert.Equal("Applied", updated.Stage);
        Assert.NotEqual(candidate.Version, updated.Version);
    }

    [Fact]
    public async Task Interviewer_cannot_edit_candidate()
    {
        var (owner, ownerCookies) = await CreateAuthenticatedClientAsync("Owner");
        var workspaceId = await CreateWorkspaceAsync(owner, ownerCookies, "Acme");
        var job = await CreateOpenJobAsync(owner, ownerCookies, workspaceId, "Backend Engineer");
        var candidate = await CreateCandidateAsync(owner, ownerCookies, workspaceId, job.Id, "Alice Example", "alice@example.com");
        var (interviewer, interviewerCookies, _) = await AddMemberAsync(owner, ownerCookies, workspaceId, "Interviewer1", "Interviewer");

        var editResponse = await SendAsync(
            interviewer, interviewerCookies, HttpMethod.Patch, $"/api/workspaces/{workspaceId}/candidates/{candidate.Id}",
            new UpdateCandidateRequest { Name = "Should Not Apply", Email = candidate.Email, Version = candidate.Version });
        Assert.Equal(HttpStatusCode.Forbidden, editResponse.StatusCode);
    }

    [Fact]
    public async Task Stale_edit_is_rejected_and_the_first_writers_change_wins()
    {
        var (owner, ownerCookies) = await CreateAuthenticatedClientAsync("Owner");
        var workspaceId = await CreateWorkspaceAsync(owner, ownerCookies, "Acme");
        var job = await CreateOpenJobAsync(owner, ownerCookies, workspaceId, "Backend Engineer");
        var candidate = await CreateCandidateAsync(owner, ownerCookies, workspaceId, job.Id, "Alice Example", "alice@example.com");

        var firstEdit = await SendAsync(
            owner, ownerCookies, HttpMethod.Patch, $"/api/workspaces/{workspaceId}/candidates/{candidate.Id}",
            new UpdateCandidateRequest { Name = "First Editor Wins", Email = candidate.Email, Version = candidate.Version });
        Assert.Equal(HttpStatusCode.OK, firstEdit.StatusCode);

        var staleEdit = await SendAsync(
            owner, ownerCookies, HttpMethod.Patch, $"/api/workspaces/{workspaceId}/candidates/{candidate.Id}",
            new UpdateCandidateRequest { Name = "Stale Editor Loses", Email = candidate.Email, Version = candidate.Version });
        Assert.Equal(HttpStatusCode.Conflict, staleEdit.StatusCode);

        var currentResponse = await owner.GetAsync($"/api/workspaces/{workspaceId}/candidates/{candidate.Id}");
        var current = await currentResponse.Content.ReadFromJsonAsync<CandidateResponse>();
        Assert.Equal("First Editor Wins", current!.Name);

        using var scope = _factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<HireflowDbContext>();
        var persisted = await dbContext.Candidates.SingleAsync(c => c.Id == candidate.Id);
        Assert.Equal("First Editor Wins", persisted.Name);
    }

    [Fact]
    public async Task Edit_cannot_alter_stage_job_workspace_creator_or_created_at()
    {
        var (owner, ownerCookies) = await CreateAuthenticatedClientAsync("Owner");
        var workspaceId = await CreateWorkspaceAsync(owner, ownerCookies, "Acme");
        var job = await CreateOpenJobAsync(owner, ownerCookies, workspaceId, "Backend Engineer");
        var candidate = await CreateCandidateAsync(owner, ownerCookies, workspaceId, job.Id, "Alice Example", "alice@example.com");

        var editResponse = await SendAsync(
            owner, ownerCookies, HttpMethod.Patch, $"/api/workspaces/{workspaceId}/candidates/{candidate.Id}",
            new UpdateCandidateRequest { Name = "Alice Updated", Email = "alice.updated@example.com", Version = candidate.Version });
        editResponse.EnsureSuccessStatusCode();
        var updated = await editResponse.Content.ReadFromJsonAsync<CandidateResponse>();

        Assert.Equal("Applied", updated!.Stage);
        Assert.Equal(job.Id, updated.JobOpeningId);
        Assert.Equal(workspaceId, updated.WorkspaceId);
        Assert.Equal(candidate.CreatedByUserId, updated.CreatedByUserId);
        // JSON round-tripping DateTimeOffset can lose sub-microsecond precision; compare
        // with a small tolerance rather than requiring bit-for-bit equality.
        Assert.True((candidate.CreatedAt - updated.CreatedAt).Duration() < TimeSpan.FromMilliseconds(1));
    }

    [Fact]
    public async Task Duplicate_email_on_edit_is_rejected()
    {
        var (owner, ownerCookies) = await CreateAuthenticatedClientAsync("Owner");
        var workspaceId = await CreateWorkspaceAsync(owner, ownerCookies, "Acme");
        var job = await CreateOpenJobAsync(owner, ownerCookies, workspaceId, "Backend Engineer");
        var alice = await CreateCandidateAsync(owner, ownerCookies, workspaceId, job.Id, "Alice Example", "alice@example.com");
        var bob = await CreateCandidateAsync(owner, ownerCookies, workspaceId, job.Id, "Bob Example", "bob@example.com");

        var editResponse = await SendAsync(
            owner, ownerCookies, HttpMethod.Patch, $"/api/workspaces/{workspaceId}/candidates/{bob.Id}",
            new UpdateCandidateRequest { Name = "Bob Renamed", Email = alice.Email, Version = bob.Version });
        Assert.Equal(HttpStatusCode.Conflict, editResponse.StatusCode);
    }

    [Fact]
    public async Task Cross_tenant_caller_cannot_list_view_or_edit_another_workspaces_candidates()
    {
        var (ownerA, ownerACookies) = await CreateAuthenticatedClientAsync("Owner A");
        var workspaceAId = await CreateWorkspaceAsync(ownerA, ownerACookies, "Workspace A");
        var jobA = await CreateOpenJobAsync(ownerA, ownerACookies, workspaceAId, "Job A");
        var candidateA = await CreateCandidateAsync(ownerA, ownerACookies, workspaceAId, jobA.Id, "Alice Example", "alice@example.com");

        var (ownerB, ownerBCookies) = await CreateAuthenticatedClientAsync("Owner B");
        var workspaceBId = await CreateWorkspaceAsync(ownerB, ownerBCookies, "Workspace B");

        // Guessed job ID under caller's own workspace route.
        var listWrongWorkspaceResponse = await ownerB.GetAsync($"/api/workspaces/{workspaceBId}/jobs/{jobA.Id}/candidates");
        Assert.Equal(HttpStatusCode.NotFound, listWrongWorkspaceResponse.StatusCode);

        // Real job/workspace pair, but caller isn't a member.
        var listRealPairResponse = await ownerB.GetAsync($"/api/workspaces/{workspaceAId}/jobs/{jobA.Id}/candidates");
        Assert.Equal(HttpStatusCode.NotFound, listRealPairResponse.StatusCode);

        var getResponse = await ownerB.GetAsync($"/api/workspaces/{workspaceAId}/candidates/{candidateA.Id}");
        Assert.Equal(HttpStatusCode.NotFound, getResponse.StatusCode);

        // Candidate ID under the wrong (caller's own) workspace.
        var getWrongWorkspaceResponse = await ownerB.GetAsync($"/api/workspaces/{workspaceBId}/candidates/{candidateA.Id}");
        Assert.Equal(HttpStatusCode.NotFound, getWrongWorkspaceResponse.StatusCode);

        var editResponse = await SendAsync(
            ownerB, ownerBCookies, HttpMethod.Patch, $"/api/workspaces/{workspaceAId}/candidates/{candidateA.Id}",
            new UpdateCandidateRequest { Name = "Hijacked", Email = candidateA.Email, Version = candidateA.Version });
        Assert.Equal(HttpStatusCode.NotFound, editResponse.StatusCode);

        var createUnderWrongWorkspaceResponse = await SendAsync(
            ownerB, ownerBCookies, HttpMethod.Post, $"/api/workspaces/{workspaceBId}/jobs/{jobA.Id}/candidates",
            new CreateCandidateRequest { Name = "Hijacked", Email = "hijacked@example.com" });
        Assert.Equal(HttpStatusCode.NotFound, createUnderWrongWorkspaceResponse.StatusCode);

        var stillIntactResponse = await ownerA.GetAsync($"/api/workspaces/{workspaceAId}/candidates/{candidateA.Id}");
        var stillIntact = await stillIntactResponse.Content.ReadFromJsonAsync<CandidateResponse>();
        Assert.Equal("Alice Example", stillIntact!.Name);
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
        return await ChangeStatusAsync(owner, ownerCookies, workspaceId, job.Id, "Open", job.Version);
    }

    private async Task<JobOpeningResponse> CreateJobAsync(HttpClient owner, CookieCapturingHandler ownerCookies, Guid workspaceId, string title)
    {
        var response = await SendAsync(
            owner, ownerCookies, HttpMethod.Post, $"/api/workspaces/{workspaceId}/jobs", new CreateJobOpeningRequest { Title = title });
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<JobOpeningResponse>())!;
    }

    private async Task<JobOpeningResponse> ChangeStatusAsync(
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
