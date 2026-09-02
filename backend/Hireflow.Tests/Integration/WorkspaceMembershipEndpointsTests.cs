using System.Net;
using System.Net.Http.Json;
using Hireflow.Application.Auth;
using Hireflow.Application.Workspaces;

namespace Hireflow.Tests.Integration;

[Collection(PostgresCollection.Name)]
public sealed class WorkspaceMembershipEndpointsTests(PostgresContainerFixture postgres) : IAsyncLifetime
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
    public async Task Owner_can_promote_and_demote_a_member()
    {
        var (owner, ownerCookies) = await CreateAuthenticatedClientAsync("Owner");
        var workspaceId = await CreateWorkspaceAsync(owner, ownerCookies, "Acme");
        var (_, memberId) = await AddMemberAsync(owner, ownerCookies, workspaceId, "Member", "Recruiter");

        var promoteResponse = await SendAsync(
            owner, ownerCookies, HttpMethod.Patch, $"/api/workspaces/{workspaceId}/members/{memberId}/role",
            new ChangeMemberRoleRequest { Role = "Owner" });
        Assert.Equal(HttpStatusCode.NoContent, promoteResponse.StatusCode);

        var members = await GetMembersAsync(owner, workspaceId);
        Assert.Equal("Owner", members.Single(m => m.UserId == memberId).Role);

        var demoteResponse = await SendAsync(
            owner, ownerCookies, HttpMethod.Patch, $"/api/workspaces/{workspaceId}/members/{memberId}/role",
            new ChangeMemberRoleRequest { Role = "Interviewer" });
        Assert.Equal(HttpStatusCode.NoContent, demoteResponse.StatusCode);

        members = await GetMembersAsync(owner, workspaceId);
        Assert.Equal("Interviewer", members.Single(m => m.UserId == memberId).Role);
    }

    [Fact]
    public async Task Owner_can_remove_a_member_without_deleting_their_account()
    {
        var (owner, ownerCookies) = await CreateAuthenticatedClientAsync("Owner");
        var workspaceId = await CreateWorkspaceAsync(owner, ownerCookies, "Acme");
        var (member, memberId) = await AddMemberAsync(owner, ownerCookies, workspaceId, "Member", "Recruiter");

        var removeResponse = await SendAsync(
            owner, ownerCookies, HttpMethod.Delete, $"/api/workspaces/{workspaceId}/members/{memberId}", body: null);
        Assert.Equal(HttpStatusCode.NoContent, removeResponse.StatusCode);

        var members = await GetMembersAsync(owner, workspaceId);
        Assert.DoesNotContain(members, m => m.UserId == memberId);

        // The removed member's account is untouched: they can still authenticate.
        var meResponse = await member.GetAsync("/api/auth/me");
        Assert.Equal(HttpStatusCode.OK, meResponse.StatusCode);
    }

    [Fact]
    public async Task Non_owner_receives_forbidden_for_role_changes_and_removal()
    {
        var (owner, ownerCookies) = await CreateAuthenticatedClientAsync("Owner");
        var workspaceId = await CreateWorkspaceAsync(owner, ownerCookies, "Acme");
        var (recruiter, recruiterCookies, _) = await AddMemberWithCookiesAsync(owner, ownerCookies, workspaceId, "Recruiter1", "Recruiter");
        var (_, otherId) = await AddMemberAsync(owner, ownerCookies, workspaceId, "Other", "Interviewer");

        var roleResponse = await SendAsync(
            recruiter, recruiterCookies, HttpMethod.Patch, $"/api/workspaces/{workspaceId}/members/{otherId}/role",
            new ChangeMemberRoleRequest { Role = "Recruiter" });
        Assert.Equal(HttpStatusCode.Forbidden, roleResponse.StatusCode);

        var removeResponse = await SendAsync(
            recruiter, recruiterCookies, HttpMethod.Delete, $"/api/workspaces/{workspaceId}/members/{otherId}", body: null);
        Assert.Equal(HttpStatusCode.Forbidden, removeResponse.StatusCode);
    }

    [Fact]
    public async Task Sole_owner_cannot_demote_or_remove_themselves()
    {
        var (owner, ownerCookies) = await CreateAuthenticatedClientAsync("Owner");
        var workspaceId = await CreateWorkspaceAsync(owner, ownerCookies, "Acme");
        var ownerId = await GetOwnUserIdAsync(owner);

        var demoteResponse = await SendAsync(
            owner, ownerCookies, HttpMethod.Patch, $"/api/workspaces/{workspaceId}/members/{ownerId}/role",
            new ChangeMemberRoleRequest { Role = "Recruiter" });
        Assert.Equal(HttpStatusCode.Conflict, demoteResponse.StatusCode);

        var removeResponse = await SendAsync(
            owner, ownerCookies, HttpMethod.Delete, $"/api/workspaces/{workspaceId}/members/{ownerId}", body: null);
        Assert.Equal(HttpStatusCode.Conflict, removeResponse.StatusCode);

        var members = await GetMembersAsync(owner, workspaceId);
        Assert.Contains(members, m => m.UserId == ownerId && m.Role == "Owner");
    }

    [Fact]
    public async Task With_a_second_owner_self_removal_succeeds_and_the_workspace_keeps_an_owner()
    {
        var (ownerA, ownerACookies) = await CreateAuthenticatedClientAsync("Owner A");
        var workspaceId = await CreateWorkspaceAsync(ownerA, ownerACookies, "Acme");
        var (ownerB, ownerBId) = await AddMemberAsync(ownerA, ownerACookies, workspaceId, "Owner B", "Recruiter");

        var promoteResponse = await SendAsync(
            ownerA, ownerACookies, HttpMethod.Patch, $"/api/workspaces/{workspaceId}/members/{ownerBId}/role",
            new ChangeMemberRoleRequest { Role = "Owner" });
        Assert.Equal(HttpStatusCode.NoContent, promoteResponse.StatusCode);

        var ownerAId = await GetOwnUserIdAsync(ownerA);
        var selfRemoveResponse = await SendAsync(
            ownerA, ownerACookies, HttpMethod.Delete, $"/api/workspaces/{workspaceId}/members/{ownerAId}", body: null);
        Assert.Equal(HttpStatusCode.NoContent, selfRemoveResponse.StatusCode);

        // ownerA is no longer a member and can no longer read this workspace; ownerB
        // (now sole Owner) is the one who can confirm the resulting member list.
        var members = await GetMembersAsync(ownerB, workspaceId);
        Assert.DoesNotContain(members, m => m.UserId == ownerAId);
        Assert.Contains(members, m => m.UserId == ownerBId && m.Role == "Owner");
    }

    [Fact]
    public async Task Cross_tenant_caller_cannot_change_role_or_remove_a_member_by_guessing_ids()
    {
        var (ownerA, ownerACookies) = await CreateAuthenticatedClientAsync("Owner A");
        var workspaceAId = await CreateWorkspaceAsync(ownerA, ownerACookies, "Workspace A");
        var (_, memberAId) = await AddMemberAsync(ownerA, ownerACookies, workspaceAId, "Member A", "Recruiter");

        var (ownerB, ownerBCookies) = await CreateAuthenticatedClientAsync("Owner B");
        await CreateWorkspaceAsync(ownerB, ownerBCookies, "Workspace B");

        var roleResponse = await SendAsync(
            ownerB, ownerBCookies, HttpMethod.Patch, $"/api/workspaces/{workspaceAId}/members/{memberAId}/role",
            new ChangeMemberRoleRequest { Role = "Owner" });
        Assert.Equal(HttpStatusCode.NotFound, roleResponse.StatusCode);

        var removeResponse = await SendAsync(
            ownerB, ownerBCookies, HttpMethod.Delete, $"/api/workspaces/{workspaceAId}/members/{memberAId}", body: null);
        Assert.Equal(HttpStatusCode.NotFound, removeResponse.StatusCode);

        var membersA = await GetMembersAsync(ownerA, workspaceAId);
        Assert.Contains(membersA, m => m.UserId == memberAId);
    }

    [Fact]
    public async Task Concurrent_last_owner_demotion_requests_leave_exactly_one_owner()
    {
        var (owner, ownerCookies) = await CreateAuthenticatedClientAsync("Owner");
        var workspaceId = await CreateWorkspaceAsync(owner, ownerCookies, "Acme");
        var ownerId = await GetOwnUserIdAsync(owner);

        var results = await Task.WhenAll(Enumerable.Range(0, 5).Select(_ => SendAsync(
            owner, ownerCookies, HttpMethod.Patch, $"/api/workspaces/{workspaceId}/members/{ownerId}/role",
            new ChangeMemberRoleRequest { Role = "Recruiter" })));

        Assert.All(results, r => Assert.Equal(HttpStatusCode.Conflict, r.StatusCode));

        var members = await GetMembersAsync(owner, workspaceId);
        Assert.Single(members, m => m.Role == "Owner");
    }

    private async Task<(HttpClient Client, CookieCapturingHandler Cookies, Guid UserId)> AddMemberWithCookiesAsync(
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

        var userId = await GetOwnUserIdAsync(client);
        return (client, cookies, userId);
    }

    private async Task<(HttpClient Client, Guid UserId)> AddMemberAsync(
        HttpClient owner, CookieCapturingHandler ownerCookies, Guid workspaceId, string displayName, string role)
    {
        var (client, _, userId) = await AddMemberWithCookiesAsync(owner, ownerCookies, workspaceId, displayName, role);
        return (client, userId);
    }

    private static async Task<Guid> GetOwnUserIdAsync(HttpClient client)
    {
        var response = await client.GetAsync("/api/auth/me");
        response.EnsureSuccessStatusCode();
        var me = await response.Content.ReadFromJsonAsync<AuthenticatedUserResponse>();
        return me!.Id;
    }

    private static async Task<List<WorkspaceMemberResponse>> GetMembersAsync(HttpClient client, Guid workspaceId)
    {
        var response = await client.GetAsync($"/api/workspaces/{workspaceId}/members");
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<List<WorkspaceMemberResponse>>())!;
    }

    private async Task<Guid> CreateWorkspaceAsync(HttpClient client, CookieCapturingHandler cookies, string name)
    {
        var response = await SendAsync(client, cookies, HttpMethod.Post, "/api/workspaces", new CreateWorkspaceRequest { Name = name });
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
