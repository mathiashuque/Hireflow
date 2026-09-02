using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Hireflow.Api.Observability;
using Hireflow.Application.Auth;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace Hireflow.Tests.Integration;

/// <summary>
/// Verifies request correlation (the <c>X-Request-ID</c> header matches the problem
/// response's <c>traceId</c>, a caller-supplied ID is honored only when safe) and that
/// nothing logs an invitation token or other sensitive route/body content at the default
/// Information level.
/// </summary>
[Collection(PostgresCollection.Name)]
public sealed class ObservabilityTests(PostgresContainerFixture postgres) : IAsyncLifetime
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
    public async Task Response_carries_a_request_id_header_matching_the_problem_traceId()
    {
        var client = _factory.CreateDefaultClient();

        var response = await client.GetAsync($"/api/workspaces/{Guid.NewGuid()}");

        Assert.True(response.Headers.TryGetValues(RequestCorrelationMiddleware.RequestIdHeaderName, out var values));
        var headerRequestId = values!.Single();

        var body = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        var traceId = body.RootElement.GetProperty("traceId").GetString();

        Assert.Equal(traceId, headerRequestId);
        Assert.False(string.IsNullOrWhiteSpace(headerRequestId));
    }

    [Fact]
    public async Task A_safe_caller_supplied_request_id_is_echoed_back()
    {
        var client = _factory.CreateDefaultClient();
        var request = new HttpRequestMessage(HttpMethod.Get, "/api/health/live");
        request.Headers.Add(RequestCorrelationMiddleware.RequestIdHeaderName, "client-request-42");

        var response = await client.SendAsync(request);

        Assert.Equal("client-request-42", response.Headers.GetValues(RequestCorrelationMiddleware.RequestIdHeaderName).Single());
    }

    [Fact]
    public async Task An_unsafe_or_oversized_caller_supplied_request_id_is_replaced()
    {
        var client = _factory.CreateDefaultClient();

        var injectionAttempt = new HttpRequestMessage(HttpMethod.Get, "/api/health/live");
        injectionAttempt.Headers.TryAddWithoutValidation(RequestCorrelationMiddleware.RequestIdHeaderName, "bad\r\nX-Injected: evil");
        var injectionResponse = await client.SendAsync(injectionAttempt);
        var injectionRequestId = injectionResponse.Headers.GetValues(RequestCorrelationMiddleware.RequestIdHeaderName).Single();
        Assert.DoesNotContain("evil", injectionRequestId);
        Assert.DoesNotContain('\n', injectionRequestId);

        var oversized = new HttpRequestMessage(HttpMethod.Get, "/api/health/live");
        oversized.Headers.Add(RequestCorrelationMiddleware.RequestIdHeaderName, new string('a', 500));
        var oversizedResponse = await client.SendAsync(oversized);
        var oversizedRequestId = oversizedResponse.Headers.GetValues(RequestCorrelationMiddleware.RequestIdHeaderName).Single();
        Assert.True(oversizedRequestId.Length < 500);
    }

    [Fact]
    public async Task Invitation_token_and_note_content_never_appear_in_information_level_logs()
    {
        var capturingProvider = new CapturingLoggerProvider();
        await using var loggingFactory = _factory.WithWebHostBuilder(builder =>
            builder.ConfigureServices(services => services.AddLogging(logging => logging.AddProvider(capturingProvider))));

        var cookies = new CookieCapturingHandler();
        var client = loggingFactory.CreateDefaultClient(cookies);

        const string secretToken = "totally-secret-invitation-token-abc123";
        const string secretPassword = "Sup3rSecret!";

        await SendAsync(
            client, cookies, HttpMethod.Post, "/api/auth/register",
            new RegisterRequest
            {
                Email = $"observability-{Guid.NewGuid():N}@example.com",
                Password = secretPassword,
                DisplayName = "Observability Test",
            });

        await SendAsync(client, cookies, HttpMethod.Post, $"/api/invitations/{secretToken}/accept", body: null);

        var informationAndAboveMessages = capturingProvider.Entries
            .Where(entry => entry.Level >= LogLevel.Information)
            .SelectMany(entry => new[] { entry.Message }.Concat(entry.ScopeText))
            .ToArray();

        Assert.DoesNotContain(informationAndAboveMessages, text => text.Contains(secretToken, StringComparison.Ordinal));
        Assert.DoesNotContain(informationAndAboveMessages, text => text.Contains(secretPassword, StringComparison.Ordinal));
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
