using System.Net;
using System.Text.Json;

namespace Hireflow.Tests.Integration;

/// <summary>
/// Verifies the three health endpoints' status codes, safe JSON shape, anonymous access,
/// and liveness/readiness independence — liveness must stay healthy even when the
/// database is unreachable, while readiness (and its compatibility alias) must not.
/// </summary>
[Collection(PostgresCollection.Name)]
public sealed class HealthEndpointsTests(PostgresContainerFixture postgres) : IAsyncLifetime
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
    public async Task Liveness_is_always_healthy_and_anonymous()
    {
        var client = _factory.CreateDefaultClient();

        var response = await client.GetAsync("/api/health/live");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await AssertSafeJsonAsync(response);
        Assert.Equal("Healthy", body.RootElement.GetProperty("status").GetString());
    }

    [Fact]
    public async Task Readiness_and_alias_are_healthy_when_database_is_reachable()
    {
        var client = _factory.CreateDefaultClient();

        foreach (var path in new[] { "/api/health/ready", "/api/health" })
        {
            var response = await client.GetAsync(path);

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            var body = await AssertSafeJsonAsync(response);
            Assert.Equal("Healthy", body.RootElement.GetProperty("status").GetString());
            Assert.Equal("Healthy", body.RootElement.GetProperty("checks").GetProperty("database").GetString());
        }
    }

    [Fact]
    public async Task Readiness_and_alias_return_503_when_database_is_unreachable_while_liveness_stays_healthy()
    {
        await using var unreachableFactory = new HireflowApiFactory("Host=127.0.0.1;Port=1;Database=unreachable;Username=x;Password=x;Timeout=2");
        var client = unreachableFactory.CreateDefaultClient();

        var liveResponse = await client.GetAsync("/api/health/live");
        Assert.Equal(HttpStatusCode.OK, liveResponse.StatusCode);

        foreach (var path in new[] { "/api/health/ready", "/api/health" })
        {
            var response = await client.GetAsync(path);

            Assert.Equal(HttpStatusCode.ServiceUnavailable, response.StatusCode);
            var body = await AssertSafeJsonAsync(response);
            Assert.Equal("Unhealthy", body.RootElement.GetProperty("status").GetString());
            Assert.Equal("Unhealthy", body.RootElement.GetProperty("checks").GetProperty("database").GetString());
        }
    }

    private static async Task<JsonDocument> AssertSafeJsonAsync(HttpResponseMessage response)
    {
        var body = await response.Content.ReadAsStringAsync();
        Assert.DoesNotContain("Host=", body, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("Password", body, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("Exception", body, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("postgres", body, StringComparison.OrdinalIgnoreCase);

        return JsonDocument.Parse(body);
    }
}
