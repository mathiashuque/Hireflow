using System.Net;
using System.Net.Http.Json;
using Hireflow.Application.Auth;
using Hireflow.Application.Workspaces;
using Microsoft.AspNetCore.Mvc;

namespace Hireflow.Tests.Integration;

[Collection(PostgresCollection.Name)]
public sealed class WorkspacesEndpointsTests(PostgresContainerFixture postgres) : IAsyncLifetime
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
    public async Task Create_makes_the_caller_the_sole_owner()
    {
        var (client, cookies) = await CreateAuthenticatedClientAsync("Ada Lovelace");

        var response = await SendAsync(
            client,
            cookies,
            HttpMethod.Post,
            "/api/workspaces",
            new CreateWorkspaceRequest { Name = "Analytical Engines" });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var workspace = await response.Content.ReadFromJsonAsync<WorkspaceDetailResponse>();
        Assert.NotNull(workspace);
        Assert.Equal("Analytical Engines", workspace!.Name);
        Assert.Equal("analytical-engines", workspace.Slug);
        Assert.Equal("Owner", workspace.Role);
    }

    [Fact]
    public async Task Slug_collision_gets_a_distinct_suffixed_slug_instead_of_overwriting()
    {
        var (client, cookies) = await CreateAuthenticatedClientAsync("Grace Hopper");

        var first = await SendAsync(
            client, cookies, HttpMethod.Post, "/api/workspaces",
            new CreateWorkspaceRequest { Name = "Compilers Inc", Slug = "compilers" });
        var second = await SendAsync(
            client, cookies, HttpMethod.Post, "/api/workspaces",
            new CreateWorkspaceRequest { Name = "Compilers Co", Slug = "compilers" });

        Assert.Equal(HttpStatusCode.OK, first.StatusCode);
        Assert.Equal(HttpStatusCode.OK, second.StatusCode);

        var firstWorkspace = await first.Content.ReadFromJsonAsync<WorkspaceDetailResponse>();
        var secondWorkspace = await second.Content.ReadFromJsonAsync<WorkspaceDetailResponse>();

        Assert.Equal("compilers", firstWorkspace!.Slug);
        Assert.NotEqual(firstWorkspace.Slug, secondWorkspace!.Slug);
        Assert.StartsWith("compilers", secondWorkspace.Slug);
    }

    [Fact]
    public async Task Blank_name_is_rejected_with_a_validation_problem()
    {
        var (client, cookies) = await CreateAuthenticatedClientAsync("Blank Namer");

        var response = await SendAsync(
            client, cookies, HttpMethod.Post, "/api/workspaces",
            new CreateWorkspaceRequest { Name = "   " });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task List_returns_only_the_callers_workspaces_with_roles_and_deterministic_order()
    {
        var (client, cookies) = await CreateAuthenticatedClientAsync("Owner One");

        await SendAsync(client, cookies, HttpMethod.Post, "/api/workspaces", new CreateWorkspaceRequest { Name = "Zebra Co" });
        await SendAsync(client, cookies, HttpMethod.Post, "/api/workspaces", new CreateWorkspaceRequest { Name = "Alpha Co" });

        // A second account's workspace must never appear in this account's list.
        await CreateAuthenticatedClientAsync("Owner Two", "Unrelated Co");

        var listResponse = await client.GetAsync("/api/workspaces");
        Assert.Equal(HttpStatusCode.OK, listResponse.StatusCode);

        var workspaces = await listResponse.Content.ReadFromJsonAsync<List<WorkspaceSummaryResponse>>();
        Assert.NotNull(workspaces);
        Assert.Equal(2, workspaces!.Count);
        Assert.Equal(["Alpha Co", "Zebra Co"], workspaces.Select(w => w.Name));
        Assert.All(workspaces, w => Assert.Equal("Owner", w.Role));
    }

    [Fact]
    public async Task Member_can_read_workspace_detail_and_members()
    {
        var (client, cookies) = await CreateAuthenticatedClientAsync("Katherine Johnson");

        var createResponse = await SendAsync(
            client, cookies, HttpMethod.Post, "/api/workspaces",
            new CreateWorkspaceRequest { Name = "Flight Dynamics" });
        var workspace = await createResponse.Content.ReadFromJsonAsync<WorkspaceDetailResponse>();

        var detailResponse = await client.GetAsync($"/api/workspaces/{workspace!.Id}");
        Assert.Equal(HttpStatusCode.OK, detailResponse.StatusCode);
        var detail = await detailResponse.Content.ReadFromJsonAsync<WorkspaceDetailResponse>();
        Assert.Equal(workspace.Id, detail!.Id);
        Assert.Equal("Owner", detail.Role);

        var membersResponse = await client.GetAsync($"/api/workspaces/{workspace.Id}/members");
        Assert.Equal(HttpStatusCode.OK, membersResponse.StatusCode);
        var members = await membersResponse.Content.ReadFromJsonAsync<List<WorkspaceMemberResponse>>();
        Assert.NotNull(members);
        var owner = Assert.Single(members!);
        Assert.Equal("Katherine Johnson", owner.DisplayName);
        Assert.Equal("Owner", owner.Role);
    }

    [Fact]
    public async Task Nonmember_gets_the_same_not_found_response_as_a_nonexistent_workspace()
    {
        var (ownerClient, ownerCookies) = await CreateAuthenticatedClientAsync("Workspace Owner");
        var createResponse = await SendAsync(
            ownerClient, ownerCookies, HttpMethod.Post, "/api/workspaces",
            new CreateWorkspaceRequest { Name = "Private Org" });
        var workspace = await createResponse.Content.ReadFromJsonAsync<WorkspaceDetailResponse>();

        var (intruderClient, _) = await CreateAuthenticatedClientAsync("Curious Outsider");

        var realWorkspaceResponse = await intruderClient.GetAsync($"/api/workspaces/{workspace!.Id}");
        var madeUpWorkspaceResponse = await intruderClient.GetAsync($"/api/workspaces/{Guid.NewGuid()}");

        Assert.Equal(HttpStatusCode.NotFound, realWorkspaceResponse.StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, madeUpWorkspaceResponse.StatusCode);

        var realProblem = await realWorkspaceResponse.Content.ReadFromJsonAsync<ProblemDetails>();
        var madeUpProblem = await madeUpWorkspaceResponse.Content.ReadFromJsonAsync<ProblemDetails>();
        Assert.Equal(realProblem!.Status, madeUpProblem!.Status);
        Assert.Equal(realProblem.Title, madeUpProblem.Title);

        var realMembersResponse = await intruderClient.GetAsync($"/api/workspaces/{workspace.Id}/members");
        Assert.Equal(HttpStatusCode.NotFound, realMembersResponse.StatusCode);
    }

    [Fact]
    public async Task Two_workspaces_cannot_read_each_others_data_by_guessing_ids()
    {
        var (clientA, cookiesA) = await CreateAuthenticatedClientAsync("User A");
        var createA = await SendAsync(
            clientA, cookiesA, HttpMethod.Post, "/api/workspaces", new CreateWorkspaceRequest { Name = "Workspace A" });
        var workspaceA = await createA.Content.ReadFromJsonAsync<WorkspaceDetailResponse>();

        var (clientB, cookiesB) = await CreateAuthenticatedClientAsync("User B");
        var createB = await SendAsync(
            clientB, cookiesB, HttpMethod.Post, "/api/workspaces", new CreateWorkspaceRequest { Name = "Workspace B" });
        var workspaceB = await createB.Content.ReadFromJsonAsync<WorkspaceDetailResponse>();

        Assert.Equal(HttpStatusCode.NotFound, (await clientA.GetAsync($"/api/workspaces/{workspaceB!.Id}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await clientA.GetAsync($"/api/workspaces/{workspaceB.Id}/members")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await clientB.GetAsync($"/api/workspaces/{workspaceA!.Id}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await clientB.GetAsync($"/api/workspaces/{workspaceA.Id}/members")).StatusCode);

        var listA = await (await clientA.GetAsync("/api/workspaces")).Content.ReadFromJsonAsync<List<WorkspaceSummaryResponse>>();
        var listB = await (await clientB.GetAsync("/api/workspaces")).Content.ReadFromJsonAsync<List<WorkspaceSummaryResponse>>();
        Assert.DoesNotContain(listA!, w => w.Id == workspaceB.Id);
        Assert.DoesNotContain(listB!, w => w.Id == workspaceA.Id);
    }

    [Fact]
    public async Task Anonymous_requests_are_rejected_for_every_workspace_endpoint()
    {
        var client = _factory.CreateDefaultClient(new CookieCapturingHandler());
        var workspaceId = Guid.NewGuid();

        Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync("/api/workspaces")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync($"/api/workspaces/{workspaceId}")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync($"/api/workspaces/{workspaceId}/members")).StatusCode);

        var createResponse = await client.PostAsJsonAsync(
            "/api/workspaces", new CreateWorkspaceRequest { Name = "Should Not Exist" });
        Assert.Equal(HttpStatusCode.Unauthorized, createResponse.StatusCode);
    }

    [Fact]
    public async Task Create_without_csrf_proof_is_rejected()
    {
        var (client, _) = await CreateAuthenticatedClientAsync("No Csrf");

        var request = new HttpRequestMessage(HttpMethod.Post, "/api/workspaces")
        {
            Content = JsonContent.Create(new CreateWorkspaceRequest { Name = "Should Not Exist" }),
        };

        var response = await client.SendAsync(request);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    private async Task<(HttpClient Client, CookieCapturingHandler Cookies)> CreateAuthenticatedClientAsync(
        string displayName,
        string? workspaceName = null)
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
                Email = $"user-{Guid.NewGuid():N}@example.com",
                Password = "Sup3rSecret!",
                DisplayName = displayName,
            });
        registerResponse.EnsureSuccessStatusCode();

        if (workspaceName is not null)
        {
            var createResponse = await SendAsync(
                client, cookies, HttpMethod.Post, "/api/workspaces", new CreateWorkspaceRequest { Name = workspaceName });
            createResponse.EnsureSuccessStatusCode();
        }

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
