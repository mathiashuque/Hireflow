using System.Net;
using System.Net.Http.Json;
using Hireflow.Application.Auth;
using Hireflow.Application.Jobs;
using Hireflow.Application.Workspaces;
using Hireflow.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace Hireflow.Tests.Integration;

[Collection(PostgresCollection.Name)]
public sealed class JobOpeningsEndpointsTests(PostgresContainerFixture postgres) : IAsyncLifetime
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
    public async Task Owner_and_recruiter_can_create_a_draft_job_others_cannot()
    {
        var (owner, ownerCookies) = await CreateAuthenticatedClientAsync("Owner");
        var workspaceId = await CreateWorkspaceAsync(owner, ownerCookies, "Acme");
        var (recruiter, recruiterCookies, _) = await AddMemberAsync(owner, ownerCookies, workspaceId, "Recruiter1", "Recruiter");
        var (interviewer, interviewerCookies, _) = await AddMemberAsync(owner, ownerCookies, workspaceId, "Interviewer1", "Interviewer");

        var ownerCreate = await SendAsync(
            owner, ownerCookies, HttpMethod.Post, $"/api/workspaces/{workspaceId}/jobs",
            new CreateJobOpeningRequest { Title = "Backend Engineer" });
        Assert.Equal(HttpStatusCode.OK, ownerCreate.StatusCode);
        var ownerJob = await ownerCreate.Content.ReadFromJsonAsync<JobOpeningResponse>();
        Assert.Equal("Draft", ownerJob!.Status);
        Assert.Null(ownerJob.ClosedAt);
        Assert.False(string.IsNullOrWhiteSpace(ownerJob.Version));

        var recruiterCreate = await SendAsync(
            recruiter, recruiterCookies, HttpMethod.Post, $"/api/workspaces/{workspaceId}/jobs",
            new CreateJobOpeningRequest { Title = "Frontend Engineer" });
        Assert.Equal(HttpStatusCode.OK, recruiterCreate.StatusCode);

        var interviewerCreate = await SendAsync(
            interviewer, interviewerCookies, HttpMethod.Post, $"/api/workspaces/{workspaceId}/jobs",
            new CreateJobOpeningRequest { Title = "Should Not Exist" });
        Assert.Equal(HttpStatusCode.Forbidden, interviewerCreate.StatusCode);
    }

    [Fact]
    public async Task Nonmember_and_anonymous_cannot_create_and_receive_the_documented_status()
    {
        var (owner, ownerCookies) = await CreateAuthenticatedClientAsync("Owner");
        var workspaceId = await CreateWorkspaceAsync(owner, ownerCookies, "Acme");

        var (outsider, outsiderCookies) = await CreateAuthenticatedClientAsync("Outsider");
        var outsiderResponse = await SendAsync(
            outsider, outsiderCookies, HttpMethod.Post, $"/api/workspaces/{workspaceId}/jobs",
            new CreateJobOpeningRequest { Title = "Should Not Exist" });
        Assert.Equal(HttpStatusCode.NotFound, outsiderResponse.StatusCode);

        var anonymous = _factory.CreateDefaultClient(new CookieCapturingHandler());
        var anonymousResponse = await anonymous.PostAsJsonAsync(
            $"/api/workspaces/{workspaceId}/jobs", new CreateJobOpeningRequest { Title = "Should Not Exist" });
        Assert.Equal(HttpStatusCode.Unauthorized, anonymousResponse.StatusCode);
    }

    [Fact]
    public async Task Blank_title_is_rejected_and_nothing_is_created()
    {
        var (owner, ownerCookies) = await CreateAuthenticatedClientAsync("Owner");
        var workspaceId = await CreateWorkspaceAsync(owner, ownerCookies, "Acme");

        var response = await SendAsync(
            owner, ownerCookies, HttpMethod.Post, $"/api/workspaces/{workspaceId}/jobs",
            new CreateJobOpeningRequest { Title = "   " });
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);

        var listResponse = await owner.GetAsync($"/api/workspaces/{workspaceId}/jobs");
        var jobs = await listResponse.Content.ReadFromJsonAsync<List<JobOpeningResponse>>();
        Assert.Empty(jobs!);
    }

    [Fact]
    public async Task List_supports_status_filter_and_deterministic_order_and_rejects_invalid_filter()
    {
        var (owner, ownerCookies) = await CreateAuthenticatedClientAsync("Owner");
        var workspaceId = await CreateWorkspaceAsync(owner, ownerCookies, "Acme");

        var draftJob = await CreateJobAsync(owner, ownerCookies, workspaceId, "Draft Job");
        var openJob = await CreateJobAsync(owner, ownerCookies, workspaceId, "Open Job");
        await ChangeStatusAsync(owner, ownerCookies, workspaceId, openJob.Id, "Open", openJob.Version);

        var allResponse = await owner.GetAsync($"/api/workspaces/{workspaceId}/jobs");
        var all = await allResponse.Content.ReadFromJsonAsync<List<JobOpeningResponse>>();
        Assert.Equal(2, all!.Count);
        // Most recently updated first: the status change bumped openJob's UpdatedAt.
        Assert.Equal(openJob.Id, all[0].Id);
        Assert.Equal(draftJob.Id, all[1].Id);

        var draftOnlyResponse = await owner.GetAsync($"/api/workspaces/{workspaceId}/jobs?status=Draft");
        var draftOnly = await draftOnlyResponse.Content.ReadFromJsonAsync<List<JobOpeningResponse>>();
        var draftOnlyJob = Assert.Single(draftOnly!);
        Assert.Equal(draftJob.Id, draftOnlyJob.Id);

        var invalidFilterResponse = await owner.GetAsync($"/api/workspaces/{workspaceId}/jobs?status=NotAStatus");
        Assert.Equal(HttpStatusCode.BadRequest, invalidFilterResponse.StatusCode);
    }

    [Fact]
    public async Task Any_member_can_view_a_job_including_interviewer()
    {
        var (owner, ownerCookies) = await CreateAuthenticatedClientAsync("Owner");
        var workspaceId = await CreateWorkspaceAsync(owner, ownerCookies, "Acme");
        var job = await CreateJobAsync(owner, ownerCookies, workspaceId, "Backend Engineer");

        var (interviewer, interviewerCookies, _) = await AddMemberAsync(owner, ownerCookies, workspaceId, "Interviewer1", "Interviewer");
        var response = await interviewer.GetAsync($"/api/workspaces/{workspaceId}/jobs/{job.Id}");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        _ = interviewerCookies;
    }

    [Fact]
    public async Task Owner_and_recruiter_can_edit_title_and_description()
    {
        var (owner, ownerCookies) = await CreateAuthenticatedClientAsync("Owner");
        var workspaceId = await CreateWorkspaceAsync(owner, ownerCookies, "Acme");
        var job = await CreateJobAsync(owner, ownerCookies, workspaceId, "Backend Engineer");

        var updateResponse = await SendAsync(
            owner, ownerCookies, HttpMethod.Patch, $"/api/workspaces/{workspaceId}/jobs/{job.Id}",
            new UpdateJobOpeningRequest { Title = "Senior Backend Engineer", Description = "Now with more details.", Version = job.Version });
        Assert.Equal(HttpStatusCode.OK, updateResponse.StatusCode);
        var updated = await updateResponse.Content.ReadFromJsonAsync<JobOpeningResponse>();
        Assert.Equal("Senior Backend Engineer", updated!.Title);
        Assert.Equal("Now with more details.", updated.Description);
        Assert.NotEqual(job.Version, updated.Version);
    }

    [Fact]
    public async Task Interviewer_cannot_edit_or_change_status()
    {
        var (owner, ownerCookies) = await CreateAuthenticatedClientAsync("Owner");
        var workspaceId = await CreateWorkspaceAsync(owner, ownerCookies, "Acme");
        var job = await CreateJobAsync(owner, ownerCookies, workspaceId, "Backend Engineer");
        var (interviewer, interviewerCookies, _) = await AddMemberAsync(owner, ownerCookies, workspaceId, "Interviewer1", "Interviewer");

        var updateResponse = await SendAsync(
            interviewer, interviewerCookies, HttpMethod.Patch, $"/api/workspaces/{workspaceId}/jobs/{job.Id}",
            new UpdateJobOpeningRequest { Title = "Should Not Apply", Description = null, Version = job.Version });
        Assert.Equal(HttpStatusCode.Forbidden, updateResponse.StatusCode);

        var statusResponse = await SendAsync(
            interviewer, interviewerCookies, HttpMethod.Patch, $"/api/workspaces/{workspaceId}/jobs/{job.Id}/status",
            new ChangeJobOpeningStatusRequest { Status = "Open", Version = job.Version });
        Assert.Equal(HttpStatusCode.Forbidden, statusResponse.StatusCode);
    }

    [Fact]
    public async Task Full_lifecycle_transitions_keep_status_and_closed_at_consistent()
    {
        var (owner, ownerCookies) = await CreateAuthenticatedClientAsync("Owner");
        var workspaceId = await CreateWorkspaceAsync(owner, ownerCookies, "Acme");
        var job = await CreateJobAsync(owner, ownerCookies, workspaceId, "Backend Engineer");
        Assert.Equal("Draft", job.Status);
        Assert.Null(job.ClosedAt);

        var opened = await ChangeStatusAsync(owner, ownerCookies, workspaceId, job.Id, "Open", job.Version);
        Assert.Equal("Open", opened.Status);
        Assert.Null(opened.ClosedAt);

        var closed = await ChangeStatusAsync(owner, ownerCookies, workspaceId, job.Id, "Closed", opened.Version);
        Assert.Equal("Closed", closed.Status);
        Assert.NotNull(closed.ClosedAt);

        var reopened = await ChangeStatusAsync(owner, ownerCookies, workspaceId, job.Id, "Open", closed.Version);
        Assert.Equal("Open", reopened.Status);
        Assert.Null(reopened.ClosedAt);
    }

    [Fact]
    public async Task Invalid_and_no_op_transitions_are_rejected_without_mutating_the_job()
    {
        var (owner, ownerCookies) = await CreateAuthenticatedClientAsync("Owner");
        var workspaceId = await CreateWorkspaceAsync(owner, ownerCookies, "Acme");
        var job = await CreateJobAsync(owner, ownerCookies, workspaceId, "Backend Engineer");

        // Draft -> Closed is not a valid transition.
        var invalidResponse = await SendAsync(
            owner, ownerCookies, HttpMethod.Patch, $"/api/workspaces/{workspaceId}/jobs/{job.Id}/status",
            new ChangeJobOpeningStatusRequest { Status = "Closed", Version = job.Version });
        Assert.Equal(HttpStatusCode.Conflict, invalidResponse.StatusCode);

        var opened = await ChangeStatusAsync(owner, ownerCookies, workspaceId, job.Id, "Open", job.Version);

        // Open -> Open is a no-op and must be rejected, not silently accepted.
        var noOpResponse = await SendAsync(
            owner, ownerCookies, HttpMethod.Patch, $"/api/workspaces/{workspaceId}/jobs/{job.Id}/status",
            new ChangeJobOpeningStatusRequest { Status = "Open", Version = opened.Version });
        Assert.Equal(HttpStatusCode.Conflict, noOpResponse.StatusCode);

        var currentResponse = await owner.GetAsync($"/api/workspaces/{workspaceId}/jobs/{job.Id}");
        var current = await currentResponse.Content.ReadFromJsonAsync<JobOpeningResponse>();
        Assert.Equal("Open", current!.Status);
        Assert.Null(current.ClosedAt);
    }

    [Fact]
    public async Task Stale_version_is_rejected_and_the_first_writers_change_wins()
    {
        var (owner, ownerCookies) = await CreateAuthenticatedClientAsync("Owner");
        var workspaceId = await CreateWorkspaceAsync(owner, ownerCookies, "Acme");
        var job = await CreateJobAsync(owner, ownerCookies, workspaceId, "Backend Engineer");

        var firstEdit = await SendAsync(
            owner, ownerCookies, HttpMethod.Patch, $"/api/workspaces/{workspaceId}/jobs/{job.Id}",
            new UpdateJobOpeningRequest { Title = "First Editor Wins", Description = null, Version = job.Version });
        Assert.Equal(HttpStatusCode.OK, firstEdit.StatusCode);

        // A second editor using the same (now stale) version must be rejected.
        var staleEdit = await SendAsync(
            owner, ownerCookies, HttpMethod.Patch, $"/api/workspaces/{workspaceId}/jobs/{job.Id}",
            new UpdateJobOpeningRequest { Title = "Stale Editor Loses", Description = null, Version = job.Version });
        Assert.Equal(HttpStatusCode.Conflict, staleEdit.StatusCode);

        var currentResponse = await owner.GetAsync($"/api/workspaces/{workspaceId}/jobs/{job.Id}");
        var current = await currentResponse.Content.ReadFromJsonAsync<JobOpeningResponse>();
        Assert.Equal("First Editor Wins", current!.Title);

        // The database itself, not only the response code, reflects the first writer's change.
        using var scope = _factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<HireflowDbContext>();
        var persisted = await dbContext.JobOpenings.SingleAsync(j => j.Id == job.Id);
        Assert.Equal("First Editor Wins", persisted.Title);
    }

    [Fact]
    public async Task Stale_version_on_status_change_is_rejected()
    {
        var (owner, ownerCookies) = await CreateAuthenticatedClientAsync("Owner");
        var workspaceId = await CreateWorkspaceAsync(owner, ownerCookies, "Acme");
        var job = await CreateJobAsync(owner, ownerCookies, workspaceId, "Backend Engineer");

        var editResponse = await SendAsync(
            owner, ownerCookies, HttpMethod.Patch, $"/api/workspaces/{workspaceId}/jobs/{job.Id}",
            new UpdateJobOpeningRequest { Title = "Renamed", Description = null, Version = job.Version });
        editResponse.EnsureSuccessStatusCode();

        var staleStatusResponse = await SendAsync(
            owner, ownerCookies, HttpMethod.Patch, $"/api/workspaces/{workspaceId}/jobs/{job.Id}/status",
            new ChangeJobOpeningStatusRequest { Status = "Open", Version = job.Version });
        Assert.Equal(HttpStatusCode.Conflict, staleStatusResponse.StatusCode);

        var currentResponse = await owner.GetAsync($"/api/workspaces/{workspaceId}/jobs/{job.Id}");
        var current = await currentResponse.Content.ReadFromJsonAsync<JobOpeningResponse>();
        Assert.Equal("Draft", current!.Status);
    }

    [Fact]
    public async Task Cross_tenant_caller_cannot_view_edit_or_change_status_of_another_workspaces_job()
    {
        var (ownerA, ownerACookies) = await CreateAuthenticatedClientAsync("Owner A");
        var workspaceAId = await CreateWorkspaceAsync(ownerA, ownerACookies, "Workspace A");
        var jobA = await CreateJobAsync(ownerA, ownerACookies, workspaceAId, "Job A");

        var (ownerB, ownerBCookies) = await CreateAuthenticatedClientAsync("Owner B");
        var workspaceBId = await CreateWorkspaceAsync(ownerB, ownerBCookies, "Workspace B");

        var getResponse = await ownerB.GetAsync($"/api/workspaces/{workspaceAId}/jobs/{jobA.Id}");
        Assert.Equal(HttpStatusCode.NotFound, getResponse.StatusCode);

        var editResponse = await SendAsync(
            ownerB, ownerBCookies, HttpMethod.Patch, $"/api/workspaces/{workspaceAId}/jobs/{jobA.Id}",
            new UpdateJobOpeningRequest { Title = "Hijacked", Description = null, Version = jobA.Version });
        Assert.Equal(HttpStatusCode.NotFound, editResponse.StatusCode);

        // Same job id, but under Owner B's own (unrelated) workspace route.
        var wrongRouteResponse = await SendAsync(
            ownerB, ownerBCookies, HttpMethod.Patch, $"/api/workspaces/{workspaceBId}/jobs/{jobA.Id}",
            new UpdateJobOpeningRequest { Title = "Hijacked", Description = null, Version = jobA.Version });
        Assert.Equal(HttpStatusCode.NotFound, wrongRouteResponse.StatusCode);

        var statusResponse = await SendAsync(
            ownerB, ownerBCookies, HttpMethod.Patch, $"/api/workspaces/{workspaceAId}/jobs/{jobA.Id}/status",
            new ChangeJobOpeningStatusRequest { Status = "Open", Version = jobA.Version });
        Assert.Equal(HttpStatusCode.NotFound, statusResponse.StatusCode);

        var stillDraftResponse = await ownerA.GetAsync($"/api/workspaces/{workspaceAId}/jobs/{jobA.Id}");
        var stillDraft = await stillDraftResponse.Content.ReadFromJsonAsync<JobOpeningResponse>();
        Assert.Equal("Job A", stillDraft!.Title);
        Assert.Equal("Draft", stillDraft.Status);
    }

    [Fact]
    public async Task Anonymous_and_csrf_less_requests_are_rejected()
    {
        var (owner, ownerCookies) = await CreateAuthenticatedClientAsync("Owner");
        var workspaceId = await CreateWorkspaceAsync(owner, ownerCookies, "Acme");
        var job = await CreateJobAsync(owner, ownerCookies, workspaceId, "Backend Engineer");

        var anonymous = _factory.CreateDefaultClient(new CookieCapturingHandler());
        Assert.Equal(HttpStatusCode.Unauthorized, (await anonymous.GetAsync($"/api/workspaces/{workspaceId}/jobs")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await anonymous.GetAsync($"/api/workspaces/{workspaceId}/jobs/{job.Id}")).StatusCode);

        var noCsrfRequest = new HttpRequestMessage(HttpMethod.Patch, $"/api/workspaces/{workspaceId}/jobs/{job.Id}")
        {
            Content = JsonContent.Create(new UpdateJobOpeningRequest { Title = "No Csrf", Description = null, Version = job.Version }),
        };
        var noCsrfResponse = await owner.SendAsync(noCsrfRequest);
        Assert.Equal(HttpStatusCode.BadRequest, noCsrfResponse.StatusCode);
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
        // Uniquify the slug basis so many tests reusing a friendly name like "Acme"
        // don't exhaust the shared database's suffix-collision budget.
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
