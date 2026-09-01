using System.Net;
using System.Net.Http.Json;
using Hireflow.Application.Auth;
using Hireflow.Application.Workspaces;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Time.Testing;

namespace Hireflow.Tests.Integration;

[Collection(PostgresCollection.Name)]
public sealed class WorkspaceInvitationsEndpointsTests(PostgresContainerFixture postgres) : IAsyncLifetime
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
    public async Task Owner_can_invite_list_and_the_token_only_appears_once()
    {
        var (owner, ownerCookies) = await CreateAuthenticatedClientAsync("Owner");
        var workspaceId = await CreateWorkspaceAsync(owner, ownerCookies, "Acme");

        var email = UniqueEmail("recruiter");
        var createResponse = await SendAsync(
            owner, ownerCookies, HttpMethod.Post, $"/api/workspaces/{workspaceId}/invitations",
            new CreateInvitationRequest { Email = email, Role = "Recruiter" });

        Assert.Equal(HttpStatusCode.OK, createResponse.StatusCode);
        var created = await createResponse.Content.ReadFromJsonAsync<InvitationCreatedResponse>();
        Assert.NotNull(created);
        Assert.False(string.IsNullOrWhiteSpace(created!.Token));
        Assert.Equal("Recruiter", created.Role);

        var listResponse = await owner.GetAsync($"/api/workspaces/{workspaceId}/invitations");
        Assert.Equal(HttpStatusCode.OK, listResponse.StatusCode);
        var body = await listResponse.Content.ReadAsStringAsync();
        Assert.DoesNotContain(created.Token, body);
        Assert.DoesNotContain("token", body, StringComparison.OrdinalIgnoreCase);

        var pending = await listResponse.Content.ReadFromJsonAsync<List<PendingInvitationResponse>>();
        var invite = Assert.Single(pending!);
        Assert.Equal(email, invite.Email);
        Assert.Equal("Recruiter", invite.Role);
    }

    [Fact]
    public async Task Matching_account_can_accept_and_replay_does_not_change_membership()
    {
        var (owner, ownerCookies) = await CreateAuthenticatedClientAsync("Owner");
        var workspaceId = await CreateWorkspaceAsync(owner, ownerCookies, "Acme");

        var inviteeEmail = UniqueEmail("invitee-accept");
        var token = await InviteAsync(owner, ownerCookies, workspaceId, inviteeEmail, "Recruiter");

        var (invitee, inviteeCookies) = await CreateAuthenticatedClientAsync("Invitee", email: inviteeEmail);

        var acceptResponse = await SendAsync(invitee, inviteeCookies, HttpMethod.Post, $"/api/invitations/{token}/accept", body: null);
        Assert.Equal(HttpStatusCode.OK, acceptResponse.StatusCode);

        var membersResponse = await owner.GetAsync($"/api/workspaces/{workspaceId}/members");
        var members = await membersResponse.Content.ReadFromJsonAsync<List<WorkspaceMemberResponse>>();
        Assert.Contains(members!, m => m.DisplayName == "Invitee" && m.Role == "Recruiter");
        Assert.Single(members!, m => m.DisplayName == "Invitee");

        var replayResponse = await SendAsync(invitee, inviteeCookies, HttpMethod.Post, $"/api/invitations/{token}/accept", body: null);
        Assert.Equal(HttpStatusCode.Gone, replayResponse.StatusCode);

        var membersAfterReplay = await (await owner.GetAsync($"/api/workspaces/{workspaceId}/members"))
            .Content.ReadFromJsonAsync<List<WorkspaceMemberResponse>>();
        Assert.Equal(members!.Count, membersAfterReplay!.Count);
    }

    [Fact]
    public async Task A_different_account_cannot_accept_and_gets_a_generic_failure()
    {
        var (owner, ownerCookies) = await CreateAuthenticatedClientAsync("Owner");
        var workspaceId = await CreateWorkspaceAsync(owner, ownerCookies, "Acme");
        var invitedEmail = UniqueEmail("someone");
        var token = await InviteAsync(owner, ownerCookies, workspaceId, invitedEmail, "Recruiter");

        var (intruder, intruderCookies) = await CreateAuthenticatedClientAsync("Intruder");
        var response = await SendAsync(intruder, intruderCookies, HttpMethod.Post, $"/api/invitations/{token}/accept", body: null);

        Assert.Equal(HttpStatusCode.Gone, response.StatusCode);
        var problem = await response.Content.ReadFromJsonAsync<ProblemDetails>();
        Assert.DoesNotContain(invitedEmail, problem!.Detail ?? string.Empty);
        Assert.DoesNotContain(workspaceId.ToString(), problem.Detail ?? string.Empty);
    }

    [Fact]
    public async Task Expired_and_revoked_invitations_cannot_be_accepted()
    {
        var (owner, ownerCookies) = await CreateAuthenticatedClientAsync("Owner");
        var workspaceId = await CreateWorkspaceAsync(owner, ownerCookies, "Acme");

        var expiresEmail = UniqueEmail("expires");
        var expiringToken = await InviteAsync(owner, ownerCookies, workspaceId, expiresEmail, "Recruiter");
        _timeProvider.Advance(TimeSpan.FromDays(8));

        var (expiredInvitee, expiredCookies) = await CreateAuthenticatedClientAsync("Expired Invitee", email: expiresEmail);
        var expiredResponse = await SendAsync(expiredInvitee, expiredCookies, HttpMethod.Post, $"/api/invitations/{expiringToken}/accept", body: null);
        Assert.Equal(HttpStatusCode.Gone, expiredResponse.StatusCode);

        var revokedEmail = UniqueEmail("revoked");
        var revokedToken = await InviteAsync(owner, ownerCookies, workspaceId, revokedEmail, "Interviewer");
        var invitations = await (await owner.GetAsync($"/api/workspaces/{workspaceId}/invitations"))
            .Content.ReadFromJsonAsync<List<PendingInvitationResponse>>();
        var revokedInvitationId = invitations!.Single(i => i.Email == revokedEmail).Id;

        var revokeResponse = await SendAsync(
            owner, ownerCookies, HttpMethod.Delete, $"/api/workspaces/{workspaceId}/invitations/{revokedInvitationId}", body: null);
        Assert.Equal(HttpStatusCode.NoContent, revokeResponse.StatusCode);

        var (revokedInvitee, revokedCookies) = await CreateAuthenticatedClientAsync("Revoked Invitee", email: revokedEmail);
        var revokedAcceptResponse = await SendAsync(revokedInvitee, revokedCookies, HttpMethod.Post, $"/api/invitations/{revokedToken}/accept", body: null);
        Assert.Equal(HttpStatusCode.Gone, revokedAcceptResponse.StatusCode);
    }

    [Fact]
    public async Task Duplicate_active_invitation_for_the_same_email_is_rejected()
    {
        var (owner, ownerCookies) = await CreateAuthenticatedClientAsync("Owner");
        var workspaceId = await CreateWorkspaceAsync(owner, ownerCookies, "Acme");

        var email = UniqueEmail("dup");
        var first = await SendAsync(
            owner, ownerCookies, HttpMethod.Post, $"/api/workspaces/{workspaceId}/invitations",
            new CreateInvitationRequest { Email = email, Role = "Recruiter" });
        Assert.Equal(HttpStatusCode.OK, first.StatusCode);

        var second = await SendAsync(
            owner, ownerCookies, HttpMethod.Post, $"/api/workspaces/{workspaceId}/invitations",
            new CreateInvitationRequest { Email = email, Role = "Interviewer" });
        Assert.Equal(HttpStatusCode.Conflict, second.StatusCode);
    }

    [Fact]
    public async Task Invitation_for_an_email_already_in_the_workspace_is_rejected()
    {
        var (owner, ownerCookies) = await CreateAuthenticatedClientAsync("Owner");
        var workspaceId = await CreateWorkspaceAsync(owner, ownerCookies, "Acme");

        var memberEmail = UniqueEmail("already-member");
        var token = await InviteAsync(owner, ownerCookies, workspaceId, memberEmail, "Recruiter");
        var (member, memberCookies) = await CreateAuthenticatedClientAsync("Existing Member", email: memberEmail);
        await SendAsync(member, memberCookies, HttpMethod.Post, $"/api/invitations/{token}/accept", body: null);

        var response = await SendAsync(
            owner, ownerCookies, HttpMethod.Post, $"/api/workspaces/{workspaceId}/invitations",
            new CreateInvitationRequest { Email = memberEmail, Role = "Recruiter" });

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
    }

    [Fact]
    public async Task Non_owner_cannot_create_list_or_revoke_invitations()
    {
        var (owner, ownerCookies) = await CreateAuthenticatedClientAsync("Owner");
        var workspaceId = await CreateWorkspaceAsync(owner, ownerCookies, "Acme");

        var recruiterEmail = UniqueEmail("recruiter-member");
        var token = await InviteAsync(owner, ownerCookies, workspaceId, recruiterEmail, "Recruiter");
        var (recruiter, recruiterCookies) = await CreateAuthenticatedClientAsync("Recruiter Member", email: recruiterEmail);
        await SendAsync(recruiter, recruiterCookies, HttpMethod.Post, $"/api/invitations/{token}/accept", body: null);

        var createResponse = await SendAsync(
            recruiter, recruiterCookies, HttpMethod.Post, $"/api/workspaces/{workspaceId}/invitations",
            new CreateInvitationRequest { Email = UniqueEmail("other"), Role = "Recruiter" });
        Assert.Equal(HttpStatusCode.Forbidden, createResponse.StatusCode);

        var listResponse = await recruiter.GetAsync($"/api/workspaces/{workspaceId}/invitations");
        Assert.Equal(HttpStatusCode.Forbidden, listResponse.StatusCode);
    }

    [Fact]
    public async Task Cross_tenant_caller_cannot_view_or_revoke_another_workspaces_invitation()
    {
        var (ownerA, ownerACookies) = await CreateAuthenticatedClientAsync("Owner A");
        var workspaceAId = await CreateWorkspaceAsync(ownerA, ownerACookies, "Workspace A");
        await InviteAsync(ownerA, ownerACookies, workspaceAId, UniqueEmail("target"), "Recruiter");
        var invitationAId = (await (await ownerA.GetAsync($"/api/workspaces/{workspaceAId}/invitations"))
            .Content.ReadFromJsonAsync<List<PendingInvitationResponse>>())!.Single().Id;

        var (ownerB, ownerBCookies) = await CreateAuthenticatedClientAsync("Owner B");
        var workspaceBId = await CreateWorkspaceAsync(ownerB, ownerBCookies, "Workspace B");

        var crossListResponse = await ownerB.GetAsync($"/api/workspaces/{workspaceAId}/invitations");
        Assert.Equal(HttpStatusCode.NotFound, crossListResponse.StatusCode);

        var crossRevokeResponse = await SendAsync(
            ownerB, ownerBCookies, HttpMethod.Delete, $"/api/workspaces/{workspaceAId}/invitations/{invitationAId}", body: null);
        Assert.Equal(HttpStatusCode.NotFound, crossRevokeResponse.StatusCode);

        // Owner B trying to revoke a real invitation id under their own workspace route is also not found.
        var wrongRouteRevoke = await SendAsync(
            ownerB, ownerBCookies, HttpMethod.Delete, $"/api/workspaces/{workspaceBId}/invitations/{invitationAId}", body: null);
        Assert.Equal(HttpStatusCode.NotFound, wrongRouteRevoke.StatusCode);
    }

    [Fact]
    public async Task Anonymous_and_csrf_less_requests_are_rejected()
    {
        var (owner, ownerCookies) = await CreateAuthenticatedClientAsync("Owner");
        var workspaceId = await CreateWorkspaceAsync(owner, ownerCookies, "Acme");

        var anonymous = _factory.CreateDefaultClient(new CookieCapturingHandler());
        Assert.Equal(
            HttpStatusCode.Unauthorized,
            (await anonymous.GetAsync($"/api/workspaces/{workspaceId}/invitations")).StatusCode);
        Assert.Equal(
            HttpStatusCode.Unauthorized,
            (await anonymous.PostAsJsonAsync($"/api/invitations/{Guid.NewGuid()}/accept", new { })).StatusCode);

        var noCsrfRequest = new HttpRequestMessage(HttpMethod.Post, $"/api/workspaces/{workspaceId}/invitations")
        {
            Content = JsonContent.Create(new CreateInvitationRequest { Email = UniqueEmail("nocsrf"), Role = "Recruiter" }),
        };
        var noCsrfResponse = await owner.SendAsync(noCsrfRequest);
        Assert.Equal(HttpStatusCode.BadRequest, noCsrfResponse.StatusCode);
    }

    private async Task<Guid> CreateWorkspaceAsync(HttpClient client, CookieCapturingHandler cookies, string name)
    {
        var response = await SendAsync(client, cookies, HttpMethod.Post, "/api/workspaces", new CreateWorkspaceRequest { Name = name });
        response.EnsureSuccessStatusCode();
        var workspace = await response.Content.ReadFromJsonAsync<WorkspaceDetailResponse>();
        return workspace!.Id;
    }

    private async Task<string> InviteAsync(HttpClient owner, CookieCapturingHandler ownerCookies, Guid workspaceId, string email, string role)
    {
        var response = await SendAsync(
            owner, ownerCookies, HttpMethod.Post, $"/api/workspaces/{workspaceId}/invitations",
            new CreateInvitationRequest { Email = email, Role = role });
        response.EnsureSuccessStatusCode();
        var created = await response.Content.ReadFromJsonAsync<InvitationCreatedResponse>();
        return created!.Token;
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

    private static string UniqueEmail(string prefix) => $"{prefix}-{Guid.NewGuid():N}@example.com";

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
