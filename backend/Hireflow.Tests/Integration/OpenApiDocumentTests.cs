using System.Net;
using System.Text.Json;

namespace Hireflow.Tests.Integration;

/// <summary>
/// Validates the generated OpenAPI document's structure semantically (unique operation
/// IDs, expected tags, the cookie security scheme, CSRF header requirements) rather than
/// pinning a brittle full-document snapshot, and confirms the document/interactive
/// reference are Development-only.
/// </summary>
[Collection(PostgresCollection.Name)]
public sealed class OpenApiDocumentTests(PostgresContainerFixture postgres) : IAsyncLifetime
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
    public async Task Document_contains_expected_operations_with_unique_ids_and_tags()
    {
        var client = _factory.CreateDefaultClient();

        var response = await client.GetAsync("/openapi/v1.json");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        var root = document.RootElement;

        Assert.StartsWith("3.1", root.GetProperty("openapi").GetString());

        var paths = root.GetProperty("paths");
        Assert.True(paths.TryGetProperty("/api/workspaces", out _));
        Assert.True(paths.TryGetProperty("/api/workspaces/{workspaceId}/candidates/{candidateId}/notes", out _));
        Assert.True(paths.TryGetProperty("/api/workspaces/{workspaceId}/jobs/{jobId}/status", out _)
            || paths.TryGetProperty("/api/workspaces/{workspaceId}/jobs/{jobId}", out _));

        var operationIds = new List<string>();
        var tags = new HashSet<string>();
        foreach (var pathProperty in paths.EnumerateObject())
        {
            foreach (var operationProperty in pathProperty.Value.EnumerateObject())
            {
                var operation = operationProperty.Value;
                if (operation.TryGetProperty("operationId", out var operationId))
                {
                    operationIds.Add(operationId.GetString()!);
                }

                if (operation.TryGetProperty("tags", out var operationTags))
                {
                    foreach (var tag in operationTags.EnumerateArray())
                    {
                        tags.Add(tag.GetString()!);
                    }
                }
            }
        }

        Assert.NotEmpty(operationIds);
        Assert.Equal(operationIds.Count, operationIds.Distinct().Count());

        foreach (var expectedTag in new[] { "System", "Authentication", "Workspaces", "Members", "Invitations", "Jobs", "Candidates" })
        {
            Assert.Contains(expectedTag, tags);
        }
    }

    [Fact]
    public async Task Document_declares_cookie_security_scheme_and_csrf_header_on_mutations()
    {
        var client = _factory.CreateDefaultClient();

        var response = await client.GetAsync("/openapi/v1.json");
        using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        var root = document.RootElement;

        var securitySchemes = root.GetProperty("components").GetProperty("securitySchemes");
        var cookieScheme = securitySchemes.GetProperty("CookieAuth");
        Assert.Equal("apiKey", cookieScheme.GetProperty("type").GetString());
        Assert.Equal("cookie", cookieScheme.GetProperty("in").GetString());

        var registerOperation = root.GetProperty("paths").GetProperty("/api/auth/register").GetProperty("post");
        var headerNames = registerOperation
            .GetProperty("parameters")
            .EnumerateArray()
            .Select(parameter => parameter.GetProperty("name").GetString())
            .ToArray();
        Assert.Contains("X-XSRF-TOKEN", headerNames);

        var createWorkspaceOperation = root.GetProperty("paths").GetProperty("/api/workspaces").GetProperty("post");
        Assert.True(createWorkspaceOperation.TryGetProperty("security", out var security));
        Assert.True(security.GetArrayLength() > 0);
    }

    [Fact]
    public async Task Document_and_interactive_reference_are_absent_outside_development()
    {
        // "Testing" stands in for any non-Development environment here: both routes are
        // gated on IsDevelopment(), the same gate a real Production deployment hits.
        await using var nonDevelopmentFactory = new HireflowApiFactory(postgres.ConnectionString, environment: "Testing");
        await nonDevelopmentFactory.MigrateDatabaseAsync();
        var client = nonDevelopmentFactory.CreateDefaultClient();

        var documentResponse = await client.GetAsync("/openapi/v1.json");
        Assert.Equal(HttpStatusCode.NotFound, documentResponse.StatusCode);

        var referenceResponse = await client.GetAsync("/api-docs");
        Assert.Equal(HttpStatusCode.NotFound, referenceResponse.StatusCode);

        // The rest of the API keeps working normally outside Development.
        var healthResponse = await client.GetAsync("/api/health");
        Assert.Equal(HttpStatusCode.OK, healthResponse.StatusCode);
    }
}
