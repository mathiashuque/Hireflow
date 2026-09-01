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
public sealed class CandidateStageMovementEndpointsTests(PostgresContainerFixture postgres) : IAsyncLifetime
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
    public async Task Owner_and_recruiter_can_move_any_stage_to_any_different_stage_including_backward_and_out_of_rejected()
    {
        var (owner, ownerCookies) = await CreateAuthenticatedClientAsync("Owner");
        var workspaceId = await CreateWorkspaceAsync(owner, ownerCookies, "Acme");
        var job = await CreateOpenJobAsync(owner, ownerCookies, workspaceId, "Backend Engineer");
        var candidate = await CreateCandidateAsync(owner, ownerCookies, workspaceId, job.Id, "Alice Example", "alice@example.com");
        var (recruiter, recruiterCookies, _) = await AddMemberAsync(owner, ownerCookies, workspaceId, "Recruiter1", "Recruiter");

        var toScreening = await MoveStageAsync(owner, ownerCookies, workspaceId, candidate.Id, "Screening", candidate.Version);
        Assert.Equal(HttpStatusCode.OK, toScreening.Response.StatusCode);
        Assert.Equal("Screening", toScreening.Candidate!.Stage);

        var toRejected = await MoveStageAsync(recruiter, recruiterCookies, workspaceId, candidate.Id, "Rejected", toScreening.Candidate.Version);
        Assert.Equal(HttpStatusCode.OK, toRejected.Response.StatusCode);
        Assert.Equal("Rejected", toRejected.Candidate!.Stage);

        // Recovery out of Rejected, backward to Applied.
        var recovered = await MoveStageAsync(owner, ownerCookies, workspaceId, candidate.Id, "Applied", toRejected.Candidate.Version);
        Assert.Equal(HttpStatusCode.OK, recovered.Response.StatusCode);
        Assert.Equal("Applied", recovered.Candidate!.Stage);

        var history = await GetHistoryAsync(owner, workspaceId, candidate.Id);
        Assert.Equal(3, history.Count);
        // Newest first.
        Assert.Equal(("Rejected", "Applied"), (history[0].PreviousStage, history[0].NewStage));
        Assert.Equal(("Screening", "Rejected"), (history[1].PreviousStage, history[1].NewStage));
        Assert.Equal(("Applied", "Screening"), (history[2].PreviousStage, history[2].NewStage));
        Assert.All(history, entry => Assert.False(string.IsNullOrWhiteSpace(entry.ChangedByDisplayName)));
    }

    [Fact]
    public async Task No_op_move_returns_conflict_and_appends_no_history()
    {
        var (owner, ownerCookies) = await CreateAuthenticatedClientAsync("Owner");
        var workspaceId = await CreateWorkspaceAsync(owner, ownerCookies, "Acme");
        var job = await CreateOpenJobAsync(owner, ownerCookies, workspaceId, "Backend Engineer");
        var candidate = await CreateCandidateAsync(owner, ownerCookies, workspaceId, job.Id, "Alice Example", "alice@example.com");

        var noOp = await MoveStageAsync(owner, ownerCookies, workspaceId, candidate.Id, "Applied", candidate.Version);
        Assert.Equal(HttpStatusCode.Conflict, noOp.Response.StatusCode);

        var history = await GetHistoryAsync(owner, workspaceId, candidate.Id);
        Assert.Empty(history);
    }

    [Fact]
    public async Task Unknown_stage_is_a_validation_error()
    {
        var (owner, ownerCookies) = await CreateAuthenticatedClientAsync("Owner");
        var workspaceId = await CreateWorkspaceAsync(owner, ownerCookies, "Acme");
        var job = await CreateOpenJobAsync(owner, ownerCookies, workspaceId, "Backend Engineer");
        var candidate = await CreateCandidateAsync(owner, ownerCookies, workspaceId, job.Id, "Alice Example", "alice@example.com");

        var response = await MoveStageAsync(owner, ownerCookies, workspaceId, candidate.Id, "NotAStage", candidate.Version);
        Assert.Equal(HttpStatusCode.BadRequest, response.Response.StatusCode);
    }

    [Fact]
    public async Task Stage_move_succeeds_regardless_of_job_status()
    {
        var (owner, ownerCookies) = await CreateAuthenticatedClientAsync("Owner");
        var workspaceId = await CreateWorkspaceAsync(owner, ownerCookies, "Acme");
        var job = await CreateOpenJobAsync(owner, ownerCookies, workspaceId, "Backend Engineer");
        var candidate = await CreateCandidateAsync(owner, ownerCookies, workspaceId, job.Id, "Alice Example", "alice@example.com");

        await ChangeJobStatusAsync(owner, ownerCookies, workspaceId, job.Id, "Closed", job.Version);

        var moved = await MoveStageAsync(owner, ownerCookies, workspaceId, candidate.Id, "Screening", candidate.Version);
        Assert.Equal(HttpStatusCode.OK, moved.Response.StatusCode);
        Assert.Equal("Screening", moved.Candidate!.Stage);
    }

    [Fact]
    public async Task Interviewer_can_view_board_and_history_but_gets_forbidden_on_move()
    {
        var (owner, ownerCookies) = await CreateAuthenticatedClientAsync("Owner");
        var workspaceId = await CreateWorkspaceAsync(owner, ownerCookies, "Acme");
        var job = await CreateOpenJobAsync(owner, ownerCookies, workspaceId, "Backend Engineer");
        var candidate = await CreateCandidateAsync(owner, ownerCookies, workspaceId, job.Id, "Alice Example", "alice@example.com");
        var (interviewer, interviewerCookies, _) = await AddMemberAsync(owner, ownerCookies, workspaceId, "Interviewer1", "Interviewer");

        var listResponse = await interviewer.GetAsync($"/api/workspaces/{workspaceId}/jobs/{job.Id}/candidates");
        Assert.Equal(HttpStatusCode.OK, listResponse.StatusCode);

        var historyResponse = await interviewer.GetAsync($"/api/workspaces/{workspaceId}/candidates/{candidate.Id}/history");
        Assert.Equal(HttpStatusCode.OK, historyResponse.StatusCode);

        var moveResponse = await MoveStageAsync(interviewer, interviewerCookies, workspaceId, candidate.Id, "Screening", candidate.Version);
        Assert.Equal(HttpStatusCode.Forbidden, moveResponse.Response.StatusCode);

        var stillApplied = await owner.GetAsync($"/api/workspaces/{workspaceId}/candidates/{candidate.Id}");
        var candidateNow = await stillApplied.Content.ReadFromJsonAsync<CandidateResponse>();
        Assert.Equal("Applied", candidateNow!.Stage);
    }

    [Fact]
    public async Task Anonymous_and_nonmember_and_csrf_less_requests_are_rejected_without_mutation()
    {
        var (owner, ownerCookies) = await CreateAuthenticatedClientAsync("Owner");
        var workspaceId = await CreateWorkspaceAsync(owner, ownerCookies, "Acme");
        var job = await CreateOpenJobAsync(owner, ownerCookies, workspaceId, "Backend Engineer");
        var candidate = await CreateCandidateAsync(owner, ownerCookies, workspaceId, job.Id, "Alice Example", "alice@example.com");

        var anonymous = _factory.CreateDefaultClient(new CookieCapturingHandler());
        Assert.Equal(
            HttpStatusCode.Unauthorized,
            (await anonymous.GetAsync($"/api/workspaces/{workspaceId}/candidates/{candidate.Id}/history")).StatusCode);

        var (outsider, outsiderCookies) = await CreateAuthenticatedClientAsync("Outsider");
        var outsiderMove = await MoveStageAsync(outsider, outsiderCookies, workspaceId, candidate.Id, "Screening", candidate.Version);
        Assert.Equal(HttpStatusCode.NotFound, outsiderMove.Response.StatusCode);

        var noCsrfRequest = new HttpRequestMessage(HttpMethod.Patch, $"/api/workspaces/{workspaceId}/candidates/{candidate.Id}/stage")
        {
            Content = JsonContent.Create(new MoveCandidateStageRequest { Stage = "Screening", Version = candidate.Version }),
        };
        var noCsrfResponse = await owner.SendAsync(noCsrfRequest);
        Assert.Equal(HttpStatusCode.BadRequest, noCsrfResponse.StatusCode);

        var history = await GetHistoryAsync(owner, workspaceId, candidate.Id);
        Assert.Empty(history);
    }

    [Fact]
    public async Task Guessed_cross_tenant_candidate_id_reveals_nothing()
    {
        var (ownerA, ownerACookies) = await CreateAuthenticatedClientAsync("Owner A");
        var workspaceAId = await CreateWorkspaceAsync(ownerA, ownerACookies, "Workspace A");
        var jobA = await CreateOpenJobAsync(ownerA, ownerACookies, workspaceAId, "Job A");
        var candidateA = await CreateCandidateAsync(ownerA, ownerACookies, workspaceAId, jobA.Id, "Alice Example", "alice@example.com");

        var (ownerB, ownerBCookies) = await CreateAuthenticatedClientAsync("Owner B");
        var workspaceBId = await CreateWorkspaceAsync(ownerB, ownerBCookies, "Workspace B");

        var historyResponse = await ownerB.GetAsync($"/api/workspaces/{workspaceAId}/candidates/{candidateA.Id}/history");
        Assert.Equal(HttpStatusCode.NotFound, historyResponse.StatusCode);

        var historyWrongWorkspaceResponse = await ownerB.GetAsync($"/api/workspaces/{workspaceBId}/candidates/{candidateA.Id}/history");
        Assert.Equal(HttpStatusCode.NotFound, historyWrongWorkspaceResponse.StatusCode);

        var moveResponse = await MoveStageAsync(ownerB, ownerBCookies, workspaceAId, candidateA.Id, "Screening", candidateA.Version);
        Assert.Equal(HttpStatusCode.NotFound, moveResponse.Response.StatusCode);

        var stillIntact = await ownerA.GetAsync($"/api/workspaces/{workspaceAId}/candidates/{candidateA.Id}");
        var candidateNow = await stillIntact.Content.ReadFromJsonAsync<CandidateResponse>();
        Assert.Equal("Applied", candidateNow!.Stage);
    }

    [Fact]
    public async Task Stale_version_move_is_rejected_and_appends_no_history()
    {
        var (owner, ownerCookies) = await CreateAuthenticatedClientAsync("Owner");
        var workspaceId = await CreateWorkspaceAsync(owner, ownerCookies, "Acme");
        var job = await CreateOpenJobAsync(owner, ownerCookies, workspaceId, "Backend Engineer");
        var candidate = await CreateCandidateAsync(owner, ownerCookies, workspaceId, job.Id, "Alice Example", "alice@example.com");

        var first = await MoveStageAsync(owner, ownerCookies, workspaceId, candidate.Id, "Screening", candidate.Version);
        Assert.Equal(HttpStatusCode.OK, first.Response.StatusCode);

        // Reuse the now-stale original version.
        var stale = await MoveStageAsync(owner, ownerCookies, workspaceId, candidate.Id, "Interview", candidate.Version);
        Assert.Equal(HttpStatusCode.Conflict, stale.Response.StatusCode);

        var history = await GetHistoryAsync(owner, workspaceId, candidate.Id);
        Assert.Single(history);
        Assert.Equal("Screening", history[0].NewStage);
    }

    [Fact]
    public async Task Concurrent_moves_from_the_same_version_yield_exactly_one_winner_and_one_history_row()
    {
        var (owner, ownerCookies) = await CreateAuthenticatedClientAsync("Owner");
        var workspaceId = await CreateWorkspaceAsync(owner, ownerCookies, "Acme");
        var job = await CreateOpenJobAsync(owner, ownerCookies, workspaceId, "Backend Engineer");
        var candidate = await CreateCandidateAsync(owner, ownerCookies, workspaceId, job.Id, "Alice Example", "alice@example.com");

        var tasks = new[]
        {
            MoveStageAsync(owner, ownerCookies, workspaceId, candidate.Id, "Screening", candidate.Version),
            MoveStageAsync(owner, ownerCookies, workspaceId, candidate.Id, "Rejected", candidate.Version),
        };
        var results = await Task.WhenAll(tasks);

        Assert.Single(results, result => result.Response.StatusCode == HttpStatusCode.OK);
        Assert.Single(results, result => result.Response.StatusCode == HttpStatusCode.Conflict);

        using var scope = _factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<HireflowDbContext>();
        var historyCount = await dbContext.CandidateStageHistories.CountAsync(h => h.CandidateId == candidate.Id);
        Assert.Equal(1, historyCount);
    }

    [Fact]
    public async Task Edit_versus_move_race_from_the_same_version_yields_exactly_one_winner()
    {
        var (owner, ownerCookies) = await CreateAuthenticatedClientAsync("Owner");
        var workspaceId = await CreateWorkspaceAsync(owner, ownerCookies, "Acme");
        var job = await CreateOpenJobAsync(owner, ownerCookies, workspaceId, "Backend Engineer");
        var candidate = await CreateCandidateAsync(owner, ownerCookies, workspaceId, job.Id, "Alice Example", "alice@example.com");

        var editTask = SendAsync(
            owner, ownerCookies, HttpMethod.Patch, $"/api/workspaces/{workspaceId}/candidates/{candidate.Id}",
            new UpdateCandidateRequest { Name = "Edited Name", Email = candidate.Email, Version = candidate.Version });
        var moveTask = SendAsync(
            owner, ownerCookies, HttpMethod.Patch, $"/api/workspaces/{workspaceId}/candidates/{candidate.Id}/stage",
            new MoveCandidateStageRequest { Stage = "Screening", Version = candidate.Version });

        var responses = await Task.WhenAll(editTask, moveTask);

        Assert.Single(responses, response => response.StatusCode == HttpStatusCode.OK);
        Assert.Single(responses, response => response.StatusCode == HttpStatusCode.Conflict);

        using var scope = _factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<HireflowDbContext>();
        var historyCount = await dbContext.CandidateStageHistories.CountAsync(h => h.CandidateId == candidate.Id);
        Assert.True(historyCount is 0 or 1);

        var persisted = await dbContext.Candidates.SingleAsync(c => c.Id == candidate.Id);
        if (historyCount == 1)
        {
            Assert.Equal("Screening", persisted.Stage.ToString());
            Assert.Equal("Alice Example", persisted.Name);
        }
        else
        {
            Assert.Equal("Applied", persisted.Stage.ToString());
            Assert.Equal("Edited Name", persisted.Name);
        }
    }

    private async Task<List<CandidateStageHistoryResponse>> GetHistoryAsync(HttpClient client, Guid workspaceId, Guid candidateId)
    {
        var response = await client.GetAsync($"/api/workspaces/{workspaceId}/candidates/{candidateId}/history");
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<List<CandidateStageHistoryResponse>>())!;
    }

    private async Task<(HttpResponseMessage Response, CandidateResponse? Candidate)> MoveStageAsync(
        HttpClient client, CookieCapturingHandler cookies, Guid workspaceId, Guid candidateId, string stage, string version)
    {
        var response = await SendAsync(
            client, cookies, HttpMethod.Patch, $"/api/workspaces/{workspaceId}/candidates/{candidateId}/stage",
            new MoveCandidateStageRequest { Stage = stage, Version = version });
        var candidate = response.IsSuccessStatusCode ? await response.Content.ReadFromJsonAsync<CandidateResponse>() : null;
        return (response, candidate);
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
