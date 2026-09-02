using System.Net;
using System.Net.Http.Json;
using Hireflow.Application.Auth;
using Hireflow.Infrastructure.Persistence;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace Hireflow.Tests.Integration;

[Collection(PostgresCollection.Name)]
public sealed class AuthEndpointsTests(PostgresContainerFixture postgres) : IAsyncLifetime
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
    public async Task Register_then_me_returns_the_same_account()
    {
        var client = CreateClient(out var cookies);
        var email = UniqueEmail();

        var registerResponse = await SendAsync(
            client,
            cookies,
            HttpMethod.Post,
            "/api/auth/register",
            new RegisterRequest { Email = email, Password = "Sup3rSecret!", DisplayName = "Ada Lovelace" });

        Assert.Equal(HttpStatusCode.OK, registerResponse.StatusCode);
        var registered = await registerResponse.Content.ReadFromJsonAsync<AuthenticatedUserResponse>();
        Assert.NotNull(registered);
        Assert.Equal(email, registered!.Email);
        Assert.Equal("Ada Lovelace", registered.DisplayName);

        var meResponse = await client.GetAsync("/api/auth/me");
        Assert.Equal(HttpStatusCode.OK, meResponse.StatusCode);
        var me = await meResponse.Content.ReadFromJsonAsync<AuthenticatedUserResponse>();
        Assert.Equal(registered.Id, me!.Id);
        Assert.Equal(registered.Email, me.Email);
        Assert.Equal(registered.DisplayName, me.DisplayName);
    }

    [Fact]
    public async Task Logout_then_me_is_unauthorized_then_login_succeeds()
    {
        var client = CreateClient(out var cookies);
        var email = UniqueEmail();
        const string password = "Sup3rSecret!";

        await SendAsync(
            client,
            cookies,
            HttpMethod.Post,
            "/api/auth/register",
            new RegisterRequest { Email = email, Password = password, DisplayName = "Grace Hopper" });

        var logoutResponse = await SendAsync(client, cookies, HttpMethod.Post, "/api/auth/logout", body: null);
        Assert.Equal(HttpStatusCode.NoContent, logoutResponse.StatusCode);

        var meAfterLogout = await client.GetAsync("/api/auth/me");
        Assert.Equal(HttpStatusCode.Unauthorized, meAfterLogout.StatusCode);
        AssertNotAnHtmlRedirect(meAfterLogout);

        var loginResponse = await SendAsync(
            client,
            cookies,
            HttpMethod.Post,
            "/api/auth/login",
            new LoginRequest { Email = email, Password = password });

        Assert.Equal(HttpStatusCode.OK, loginResponse.StatusCode);

        var meAfterLogin = await client.GetAsync("/api/auth/me");
        Assert.Equal(HttpStatusCode.OK, meAfterLogin.StatusCode);
    }

    [Fact]
    public async Task Duplicate_registration_is_rejected_and_does_not_create_a_second_account()
    {
        var client = CreateClient(out var cookies);
        var email = UniqueEmail();

        var first = await SendAsync(
            client,
            cookies,
            HttpMethod.Post,
            "/api/auth/register",
            new RegisterRequest { Email = email, Password = "Sup3rSecret!", DisplayName = "Original" });
        Assert.Equal(HttpStatusCode.OK, first.StatusCode);

        var second = await SendAsync(
            client,
            cookies,
            HttpMethod.Post,
            "/api/auth/register",
            new RegisterRequest { Email = email, Password = "AnotherSecret1!", DisplayName = "Impostor" });
        Assert.Equal(HttpStatusCode.Conflict, second.StatusCode);

        using var scope = _factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<HireflowDbContext>();
        var normalizedEmail = email.ToUpperInvariant();
        var matchingAccounts = await dbContext.Users.CountAsync(user => user.NormalizedEmail == normalizedEmail);
        Assert.Equal(1, matchingAccounts);
    }

    [Fact]
    public async Task Login_with_invalid_credentials_returns_a_generic_unauthorized_response()
    {
        var client = CreateClient(out var cookies);
        var email = UniqueEmail();

        await SendAsync(
            client,
            cookies,
            HttpMethod.Post,
            "/api/auth/register",
            new RegisterRequest { Email = email, Password = "Sup3rSecret!", DisplayName = "Real User" });
        await SendAsync(client, cookies, HttpMethod.Post, "/api/auth/logout", body: null);

        var wrongPasswordResponse = await SendAsync(
            client,
            cookies,
            HttpMethod.Post,
            "/api/auth/login",
            new LoginRequest { Email = email, Password = "totally-wrong" });
        var unknownEmailResponse = await SendAsync(
            client,
            cookies,
            HttpMethod.Post,
            "/api/auth/login",
            new LoginRequest { Email = UniqueEmail(), Password = "totally-wrong" });

        Assert.Equal(HttpStatusCode.Unauthorized, wrongPasswordResponse.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, unknownEmailResponse.StatusCode);

        // Compare the meaningful fields rather than the raw body: ProblemDetails
        // includes a per-request traceId, which legitimately differs every call.
        var wrongPasswordProblem = await wrongPasswordResponse.Content.ReadFromJsonAsync<ProblemDetails>();
        var unknownEmailProblem = await unknownEmailResponse.Content.ReadFromJsonAsync<ProblemDetails>();
        Assert.Equal(wrongPasswordProblem!.Title, unknownEmailProblem!.Title);
        Assert.Equal(wrongPasswordProblem.Detail, unknownEmailProblem.Detail);
        Assert.Equal(wrongPasswordProblem.Status, unknownEmailProblem.Status);
    }

    [Fact]
    public async Task Anonymous_requests_to_protected_endpoints_are_rejected_without_a_redirect()
    {
        var client = CreateClient(out _);

        var response = await client.GetAsync("/api/auth/me");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        AssertNotAnHtmlRedirect(response);
    }

    [Fact]
    public async Task Register_without_a_display_name_returns_a_validation_problem()
    {
        var client = CreateClient(out var cookies);

        var response = await SendAsync(
            client,
            cookies,
            HttpMethod.Post,
            "/api/auth/register",
            new RegisterRequest { Email = UniqueEmail(), Password = "Sup3rSecret!", DisplayName = "" });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task State_changing_requests_without_the_antiforgery_header_are_rejected()
    {
        var client = CreateClient(out _);

        var request = new HttpRequestMessage(HttpMethod.Post, "/api/auth/register")
        {
            Content = JsonContent.Create(new RegisterRequest
            {
                Email = UniqueEmail(),
                Password = "Sup3rSecret!",
                DisplayName = "No CSRF Token",
            }),
        };

        var response = await client.SendAsync(request);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    private HttpClient CreateClient(out CookieCapturingHandler cookies)
    {
        cookies = new CookieCapturingHandler();
        return _factory.CreateDefaultClient(cookies);
    }

    private static async Task<HttpResponseMessage> SendAsync(
        HttpClient client,
        CookieCapturingHandler cookies,
        HttpMethod method,
        string url,
        object? body)
    {
        // Every state-changing call fetches a fresh CSRF token first, mirroring what
        // the frontend does before a mutating request. This is not just caution: the
        // token's additional data is bound to the caller's authenticated identity, so
        // a token minted while anonymous is rejected once register/login establishes a
        // session (and vice versa after logout).
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

    private static void AssertNotAnHtmlRedirect(HttpResponseMessage response)
    {
        Assert.NotEqual(HttpStatusCode.Found, response.StatusCode);
        Assert.NotEqual(HttpStatusCode.Redirect, response.StatusCode);
        Assert.False(response.Headers.Contains("Location"));
    }

    private static string UniqueEmail() => $"user-{Guid.NewGuid():N}@example.com";
}
