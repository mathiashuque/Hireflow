using System.Net;
using System.Net.Http.Json;
using Hireflow.Application.Auth;
using Hireflow.Application.Candidates;
using Hireflow.Application.Jobs;
using Hireflow.Application.Workspaces;
using Microsoft.Extensions.Time.Testing;

namespace Hireflow.Tests.Integration;

[Collection(PostgresCollection.Name)]
public sealed class WorkspaceOverviewEndpointsTests(PostgresContainerFixture postgres) : IAsyncLifetime
{
    private FakeTimeProvider _timeProvider = null!;
    private HireflowApiFactory _factory = null!;

    public async Task InitializeAsync()
    {
        _timeProvider = new FakeTimeProvider(DateTimeOffset.Parse("2026-01-01T00:00:00Z"));
        _factory = new HireflowApiFactory(postgres.ConnectionString, _timeProvider);
        await _factory.MigrateDatabaseAsync();
    }

    public Task DisposeAsync()
    {
        _factory.Dispose();
        return Task.CompletedTask;
    }

    [Fact]
    public async Task Empty_workspace_returns_zeroed_metrics_and_empty_collections()
    {
        var (owner, ownerCookies) = await CreateAuthenticatedClientAsync("Owner");
        var workspaceId = await CreateWorkspaceAsync(owner, ownerCookies, "Acme");

        var overview = await GetOverviewAsync(owner, workspaceId);

        Assert.Equal(new JobCountsResponse(0, 0, 0), overview.JobCounts);
        Assert.Equal(0, overview.TotalCandidates);
        Assert.Equal(new CandidateStageCountsResponse(0, 0, 0, 0, 0), overview.CandidateCounts);
        Assert.Empty(overview.Workload);
        Assert.Empty(overview.RecentActivity);
    }

    [Fact]
    public async Task Job_and_candidate_counts_and_workload_are_exact_and_scoped_to_tenant()
    {
        var (owner, ownerCookies) = await CreateAuthenticatedClientAsync("Owner");
        var workspaceId = await CreateWorkspaceAsync(owner, ownerCookies, "Acme");

        var draftJob = await CreateJobAsync(owner, ownerCookies, workspaceId, "Draft Role");
        var openJobA = await CreateOpenJobAsync(owner, ownerCookies, workspaceId, "Backend Engineer");
        var openJobB = await CreateOpenJobAsync(owner, ownerCookies, workspaceId, "Frontend Engineer");
        var closedJobSeed = await CreateOpenJobAsync(owner, ownerCookies, workspaceId, "Old Role");
        var closedJob = await ChangeJobStatusAsync(owner, ownerCookies, workspaceId, closedJobSeed.Id, "Closed", closedJobSeed.Version);

        var candidate1 = await CreateCandidateAsync(owner, ownerCookies, workspaceId, openJobA.Id, "Alice Example", "alice@example.com");
        var candidate2 = await CreateCandidateAsync(owner, ownerCookies, workspaceId, openJobA.Id, "Bob Example", "bob@example.com");
        await MoveStageAsync(owner, ownerCookies, workspaceId, candidate2.Id, "Screening", candidate2.Version);
        var candidate3 = await CreateCandidateAsync(owner, ownerCookies, workspaceId, openJobB.Id, "Carol Example", "carol@example.com");
        await MoveStageAsync(owner, ownerCookies, workspaceId, candidate3.Id, "Offer", candidate3.Version);

        // Isolated second tenant that must never affect workspace A's overview.
        var (ownerB, ownerBCookies) = await CreateAuthenticatedClientAsync("Owner B");
        var otherWorkspaceId = await CreateWorkspaceAsync(ownerB, ownerBCookies, "Beta");
        var otherJob = await CreateOpenJobAsync(ownerB, ownerBCookies, otherWorkspaceId, "Unrelated Role");
        await CreateCandidateAsync(ownerB, ownerBCookies, otherWorkspaceId, otherJob.Id, "Dana Example", "dana@example.com");

        var overview = await GetOverviewAsync(owner, workspaceId);

        Assert.Equal(new JobCountsResponse(1, 2, 1), overview.JobCounts);
        Assert.Equal(3, overview.TotalCandidates);
        Assert.Equal(new CandidateStageCountsResponse(1, 1, 0, 1, 0), overview.CandidateCounts);

        // Closed job excluded from workload; Open before Draft.
        Assert.Equal(3, overview.Workload.Count);
        Assert.DoesNotContain(overview.Workload, job => job.JobId == closedJob.Id);
        Assert.Equal("Open", overview.Workload[0].Status);
        Assert.Equal("Open", overview.Workload[1].Status);
        Assert.Equal("Draft", overview.Workload[2].Status);
        Assert.Equal(draftJob.Id, overview.Workload[2].JobId);

        var jobAWorkload = overview.Workload.Single(job => job.JobId == openJobA.Id);
        Assert.Equal(2, jobAWorkload.TotalCandidates);
        Assert.Equal(new CandidateStageCountsResponse(1, 1, 0, 0, 0), jobAWorkload.StageCounts);

        var jobBWorkload = overview.Workload.Single(job => job.JobId == openJobB.Id);
        Assert.Equal(1, jobBWorkload.TotalCandidates);
        Assert.Equal(new CandidateStageCountsResponse(0, 0, 0, 1, 0), jobBWorkload.StageCounts);
    }

    [Fact]
    public async Task Workload_orders_open_before_draft_then_most_recently_updated_then_stable_id()
    {
        var (owner, ownerCookies) = await CreateAuthenticatedClientAsync("Owner");
        var workspaceId = await CreateWorkspaceAsync(owner, ownerCookies, "Acme");

        var draftOlder = await CreateJobAsync(owner, ownerCookies, workspaceId, "Draft Older");
        _timeProvider.Advance(TimeSpan.FromMinutes(1));
        var draftNewer = await CreateJobAsync(owner, ownerCookies, workspaceId, "Draft Newer");
        _timeProvider.Advance(TimeSpan.FromMinutes(1));
        var openOlder = await CreateOpenJobAsync(owner, ownerCookies, workspaceId, "Open Older");
        _timeProvider.Advance(TimeSpan.FromMinutes(1));
        var openNewer = await CreateOpenJobAsync(owner, ownerCookies, workspaceId, "Open Newer");

        var overview = await GetOverviewAsync(owner, workspaceId);

        Assert.Equal(
            new[] { openNewer.Id, openOlder.Id, draftNewer.Id, draftOlder.Id },
            overview.Workload.Select(job => job.JobId).ToArray());
    }

    [Fact]
    public async Task Recent_activity_covers_only_supported_event_kinds_newest_first()
    {
        var (owner, ownerCookies) = await CreateAuthenticatedClientAsync("Owner");
        var workspaceId = await CreateWorkspaceAsync(owner, ownerCookies, "Acme");

        var job = await CreateOpenJobAsync(owner, ownerCookies, workspaceId, "Backend Engineer");
        _timeProvider.Advance(TimeSpan.FromMinutes(1));
        var candidate = await CreateCandidateAsync(owner, ownerCookies, workspaceId, job.Id, "Alice Example", "alice@example.com");
        _timeProvider.Advance(TimeSpan.FromMinutes(1));
        var moved = await MoveStageAsync(owner, ownerCookies, workspaceId, candidate.Id, "Screening", candidate.Version);
        _timeProvider.Advance(TimeSpan.FromMinutes(1));
        await AddNoteAsync(owner, ownerCookies, workspaceId, candidate.Id, "Strong technical interview.");

        var overview = await GetOverviewAsync(owner, workspaceId);

        Assert.Equal(4, overview.RecentActivity.Count);
        Assert.Equal(
            new[]
            {
                OverviewActivityKind.CandidateNoteAdded,
                OverviewActivityKind.CandidateStageChanged,
                OverviewActivityKind.CandidateAdded,
                OverviewActivityKind.JobCreated,
            },
            overview.RecentActivity.Select(activity => activity.Kind).ToArray());

        var noteActivity = overview.RecentActivity[0];
        Assert.Equal(candidate.Id, noteActivity.CandidateId);
        Assert.Equal("Alice Example", noteActivity.CandidateName);
        Assert.Equal(job.Id, noteActivity.JobId);
        Assert.Null(noteActivity.PreviousStage);
        Assert.Null(noteActivity.NewStage);
        Assert.DoesNotContain("Strong technical interview.", overview.RecentActivity.Select(a => a.ToString()));

        var stageActivity = overview.RecentActivity[1];
        Assert.Equal("Applied", stageActivity.PreviousStage);
        Assert.Equal("Screening", stageActivity.NewStage);

        var candidateActivity = overview.RecentActivity[2];
        Assert.Equal(candidate.Id, candidateActivity.CandidateId);
        Assert.Equal(job.Id, candidateActivity.JobId);

        var jobActivity = overview.RecentActivity[3];
        Assert.Equal(job.Id, jobActivity.JobId);
        Assert.Equal("Backend Engineer", jobActivity.JobTitle);
        Assert.Null(jobActivity.CandidateId);

        Assert.All(overview.RecentActivity, activity => Assert.False(string.IsNullOrWhiteSpace(activity.ActorDisplayName)));
        Assert.Equal(HttpStatusCode.OK, moved.Response.StatusCode);
    }

    [Fact]
    public async Task Equal_timestamp_activities_tie_break_deterministically()
    {
        var (owner, ownerCookies) = await CreateAuthenticatedClientAsync("Owner");
        var workspaceId = await CreateWorkspaceAsync(owner, ownerCookies, "Acme");

        var jobA = await CreateOpenJobAsync(owner, ownerCookies, workspaceId, "Job A");
        var jobB = await CreateOpenJobAsync(owner, ownerCookies, workspaceId, "Job B");

        var firstOverview = await GetOverviewAsync(owner, workspaceId);
        var firstOrder = firstOverview.RecentActivity.Select(activity => activity.Id).ToArray();

        var secondOverview = await GetOverviewAsync(owner, workspaceId);
        var secondOrder = secondOverview.RecentActivity.Select(activity => activity.Id).ToArray();

        Assert.Equal(firstOrder, secondOrder);
        Assert.Contains(jobA.Id, firstOrder);
        Assert.Contains(jobB.Id, firstOrder);
    }

    [Fact]
    public async Task Activity_limit_defaults_and_validates()
    {
        var (owner, ownerCookies) = await CreateAuthenticatedClientAsync("Owner");
        var workspaceId = await CreateWorkspaceAsync(owner, ownerCookies, "Acme");

        for (var i = 0; i < 25; i++)
        {
            await CreateJobAsync(owner, ownerCookies, workspaceId, $"Job {i}");
            _timeProvider.Advance(TimeSpan.FromSeconds(1));
        }

        var defaultOverview = await GetOverviewAsync(owner, workspaceId);
        Assert.Equal(20, defaultOverview.RecentActivity.Count);

        var maxOverview = await GetOverviewAsync(owner, workspaceId, activityLimit: 50);
        Assert.Equal(25, maxOverview.RecentActivity.Count);

        var boundedOverview = await GetOverviewAsync(owner, workspaceId, activityLimit: 3);
        Assert.Equal(3, boundedOverview.RecentActivity.Count);

        Assert.Equal(HttpStatusCode.BadRequest, (await owner.GetAsync($"/api/workspaces/{workspaceId}/overview?activityLimit=0")).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await owner.GetAsync($"/api/workspaces/{workspaceId}/overview?activityLimit=-1")).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await owner.GetAsync($"/api/workspaces/{workspaceId}/overview?activityLimit=51")).StatusCode);
    }

    [Fact]
    public async Task Owner_recruiter_and_interviewer_can_all_read_the_same_overview()
    {
        var (owner, ownerCookies) = await CreateAuthenticatedClientAsync("Owner");
        var workspaceId = await CreateWorkspaceAsync(owner, ownerCookies, "Acme");
        await CreateOpenJobAsync(owner, ownerCookies, workspaceId, "Backend Engineer");
        var (recruiter, recruiterCookies, _) = await AddMemberAsync(owner, ownerCookies, workspaceId, "Recruiter1", "Recruiter");
        var (interviewer, _, _) = await AddMemberAsync(owner, ownerCookies, workspaceId, "Interviewer1", "Interviewer");

        var ownerOverview = await GetOverviewAsync(owner, workspaceId);
        var recruiterOverview = await GetOverviewAsync(recruiter, workspaceId);
        var interviewerOverview = await GetOverviewAsync(interviewer, workspaceId);

        Assert.Equal(ownerOverview.JobCounts, recruiterOverview.JobCounts);
        Assert.Equal(ownerOverview.JobCounts, interviewerOverview.JobCounts);
        Assert.Equal("Owner", ownerOverview.Role);
        Assert.Equal("Recruiter", recruiterOverview.Role);
        Assert.Equal("Interviewer", interviewerOverview.Role);
    }

    [Fact]
    public async Task Anonymous_gets_unauthorized_and_nonmember_or_former_member_gets_non_enumerating_not_found()
    {
        var (owner, ownerCookies) = await CreateAuthenticatedClientAsync("Owner");
        var workspaceId = await CreateWorkspaceAsync(owner, ownerCookies, "Acme");
        var (interviewer, _, interviewerId) = await AddMemberAsync(owner, ownerCookies, workspaceId, "Interviewer1", "Interviewer");

        var anonymous = _factory.CreateDefaultClient(new CookieCapturingHandler());
        Assert.Equal(HttpStatusCode.Unauthorized, (await anonymous.GetAsync($"/api/workspaces/{workspaceId}/overview")).StatusCode);

        var (outsider, _) = await CreateAuthenticatedClientAsync("Outsider");
        Assert.Equal(HttpStatusCode.NotFound, (await outsider.GetAsync($"/api/workspaces/{workspaceId}/overview")).StatusCode);

        var interviewerClient = interviewer;
        Assert.Equal(HttpStatusCode.OK, (await interviewerClient.GetAsync($"/api/workspaces/{workspaceId}/overview")).StatusCode);

        await RemoveMemberAsync(owner, ownerCookies, workspaceId, interviewerId);
        Assert.Equal(HttpStatusCode.NotFound, (await interviewerClient.GetAsync($"/api/workspaces/{workspaceId}/overview")).StatusCode);

        Assert.Equal(HttpStatusCode.NotFound, (await outsider.GetAsync($"/api/workspaces/{Guid.NewGuid()}/overview")).StatusCode);
    }

    private async Task<WorkspaceOverviewResponse> GetOverviewAsync(HttpClient client, Guid workspaceId, int? activityLimit = null)
    {
        var query = activityLimit is null ? "" : $"?activityLimit={activityLimit}";
        var response = await client.GetAsync($"/api/workspaces/{workspaceId}/overview{query}");
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<WorkspaceOverviewResponse>())!;
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

    private async Task AddNoteAsync(HttpClient client, CookieCapturingHandler cookies, Guid workspaceId, Guid candidateId, string content)
    {
        var response = await SendAsync(
            client, cookies, HttpMethod.Post, $"/api/workspaces/{workspaceId}/candidates/{candidateId}/notes",
            new CreateCandidateNoteRequest { Content = content });
        response.EnsureSuccessStatusCode();
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
