using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using Hireflow.Api.Errors;
using Hireflow.Application.Auth;
using Hireflow.Application.Candidates;
using Hireflow.Application.Jobs;
using Hireflow.Application.Workspaces;

namespace Hireflow.Tests.Integration;

/// <summary>
/// Verifies every canonical problem-details path returns the same
/// <c>application/problem+json</c> shape: status, stable <c>code</c>, <c>traceId</c>, and
/// (for validation) field-keyed <c>errors</c> — regardless of whether a controller built
/// the response by hand, the framework generated it (model binding, cookie auth, an
/// unmatched route), or an unhandled exception reached the exception handler.
/// </summary>
[Collection(PostgresCollection.Name)]
public sealed class ProblemDetailsTests(PostgresContainerFixture postgres) : IAsyncLifetime
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
    public async Task Validation_failure_returns_canonical_400_with_field_errors()
    {
        var (owner, ownerCookies) = await CreateAuthenticatedClientAsync("Owner");

        var response = await SendAsync(
            owner, ownerCookies, HttpMethod.Post, "/api/workspaces",
            new CreateWorkspaceRequest { Name = "" });

        var problem = await AssertCanonicalProblemAsync(response, HttpStatusCode.BadRequest, ProblemCodes.ValidationError);
        Assert.True(problem.RootElement.TryGetProperty("errors", out _));
    }

    [Fact]
    public async Task Malformed_json_body_returns_canonical_400()
    {
        var (owner, ownerCookies) = await CreateAuthenticatedClientAsync("Owner");

        var csrfResponse = await owner.GetAsync("/api/auth/csrf");
        csrfResponse.EnsureSuccessStatusCode();

        var request = new HttpRequestMessage(HttpMethod.Post, "/api/workspaces")
        {
            Content = new StringContent("{ not valid json", Encoding.UTF8, "application/json"),
        };
        if (ownerCookies.Cookies.TryGetValue("XSRF-TOKEN", out var token))
        {
            request.Headers.Add("X-XSRF-TOKEN", token);
        }

        var response = await owner.SendAsync(request);

        await AssertCanonicalProblemAsync(response, HttpStatusCode.BadRequest, ProblemCodes.ValidationError);
    }

    [Fact]
    public async Task Anonymous_request_to_an_authenticated_endpoint_returns_canonical_401()
    {
        var anonymous = _factory.CreateDefaultClient(new CookieCapturingHandler());

        var response = await anonymous.GetAsync("/api/workspaces");

        await AssertCanonicalProblemAsync(response, HttpStatusCode.Unauthorized, ProblemCodes.Unauthorized);
    }

    [Fact]
    public async Task Missing_csrf_token_returns_canonical_400_with_csrf_code()
    {
        var (owner, _) = await CreateAuthenticatedClientAsync("Owner");

        var request = new HttpRequestMessage(HttpMethod.Post, "/api/workspaces")
        {
            Content = JsonContent.Create(new CreateWorkspaceRequest { Name = "No CSRF" }),
        };
        var response = await owner.SendAsync(request);

        await AssertCanonicalProblemAsync(response, HttpStatusCode.BadRequest, ProblemCodes.CsrfTokenInvalid);
    }

    [Fact]
    public async Task Role_forbidden_returns_canonical_403()
    {
        var (owner, ownerCookies) = await CreateAuthenticatedClientAsync("Owner");
        var workspaceId = await CreateWorkspaceAsync(owner, ownerCookies, "Acme");
        var (interviewer, interviewerCookies, _) = await AddMemberAsync(owner, ownerCookies, workspaceId, "Interviewer1", "Interviewer");

        var response = await SendAsync(
            interviewer, interviewerCookies, HttpMethod.Post, $"/api/workspaces/{workspaceId}/jobs",
            new CreateJobOpeningRequest { Title = "Backend Engineer" });

        await AssertCanonicalProblemAsync(response, HttpStatusCode.Forbidden, ProblemCodes.Forbidden);
    }

    [Fact]
    public async Task Missing_and_cross_tenant_resources_return_the_same_canonical_404()
    {
        var (ownerA, ownerACookies) = await CreateAuthenticatedClientAsync("Owner A");
        var workspaceAId = await CreateWorkspaceAsync(ownerA, ownerACookies, "Workspace A");

        var (ownerB, _) = await CreateAuthenticatedClientAsync("Owner B");

        var missingResponse = await ownerB.GetAsync($"/api/workspaces/{Guid.NewGuid()}");
        var missingProblem = await AssertCanonicalProblemAsync(missingResponse, HttpStatusCode.NotFound, ProblemCodes.NotFound);

        var crossTenantResponse = await ownerB.GetAsync($"/api/workspaces/{workspaceAId}");
        var crossTenantProblem = await AssertCanonicalProblemAsync(crossTenantResponse, HttpStatusCode.NotFound, ProblemCodes.NotFound);

        // Indistinguishable: neither body may reveal which case actually occurred.
        Assert.Equal(
            Normalize(missingProblem, "traceId"),
            Normalize(crossTenantProblem, "traceId"));
    }

    [Fact]
    public async Task Domain_conflict_returns_canonical_409_with_specific_code()
    {
        var (owner, ownerCookies) = await CreateAuthenticatedClientAsync("Owner");
        var workspaceId = await CreateWorkspaceAsync(owner, ownerCookies, "Acme");
        var job = await CreateOpenJobAsync(owner, ownerCookies, workspaceId, "Backend Engineer");

        await SendAsync(
            owner, ownerCookies, HttpMethod.Post, $"/api/workspaces/{workspaceId}/jobs/{job.Id}/candidates",
            new CreateCandidateRequest { Name = "Alice Example", Email = "alice@example.com" });

        var duplicateResponse = await SendAsync(
            owner, ownerCookies, HttpMethod.Post, $"/api/workspaces/{workspaceId}/jobs/{job.Id}/candidates",
            new CreateCandidateRequest { Name = "Alice Duplicate", Email = "alice@example.com" });

        await AssertCanonicalProblemAsync(duplicateResponse, HttpStatusCode.Conflict, ProblemCodes.DuplicateCandidateEmail);
    }

    [Fact]
    public async Task Invalid_invitation_returns_canonical_410()
    {
        var (owner, ownerCookies) = await CreateAuthenticatedClientAsync("Owner");

        var response = await SendAsync(owner, ownerCookies, HttpMethod.Post, "/api/invitations/not-a-real-token/accept", body: null);

        await AssertCanonicalProblemAsync(response, HttpStatusCode.Gone, ProblemCodes.InvitationUnavailable);
    }

    [Fact]
    public async Task Unhandled_exception_returns_canonical_safe_500()
    {
        await using var testingFactory = new HireflowApiFactory(postgres.ConnectionString, environment: "Testing");
        await testingFactory.MigrateDatabaseAsync();
        var client = testingFactory.CreateDefaultClient();

        var response = await client.GetAsync("/api/test-only/throw");

        var problem = await AssertCanonicalProblemAsync(response, HttpStatusCode.InternalServerError, ProblemCodes.InternalError);
        var body = problem.RootElement.GetRawText();
        Assert.DoesNotContain("Deliberate test-only failure", body);
        Assert.DoesNotContain("InvalidOperationException", body);
        Assert.DoesNotContain("StackTrace", body, StringComparison.OrdinalIgnoreCase);
    }

    private static async Task<JsonDocument> AssertCanonicalProblemAsync(HttpResponseMessage response, HttpStatusCode expectedStatus, string expectedCode)
    {
        Assert.Equal(expectedStatus, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);

        var body = await response.Content.ReadAsStringAsync();
        var document = JsonDocument.Parse(body);
        var root = document.RootElement;

        Assert.Equal((int)expectedStatus, root.GetProperty("status").GetInt32());
        Assert.Equal(expectedCode, root.GetProperty("code").GetString());
        Assert.False(string.IsNullOrWhiteSpace(root.GetProperty("traceId").GetString()));
        Assert.True(root.TryGetProperty("title", out _));

        return document;
    }

    private static string Normalize(JsonDocument document, string excludedProperty)
    {
        using var stream = new MemoryStream();
        using (var writer = new Utf8JsonWriter(stream))
        {
            writer.WriteStartObject();
            foreach (var property in document.RootElement.EnumerateObject())
            {
                if (property.NameEquals(excludedProperty))
                {
                    continue;
                }

                property.WriteTo(writer);
            }

            writer.WriteEndObject();
        }

        return Encoding.UTF8.GetString(stream.ToArray());
    }

    private async Task<JobOpeningResponse> CreateOpenJobAsync(HttpClient owner, CookieCapturingHandler ownerCookies, Guid workspaceId, string title)
    {
        var createResponse = await SendAsync(
            owner, ownerCookies, HttpMethod.Post, $"/api/workspaces/{workspaceId}/jobs", new CreateJobOpeningRequest { Title = title });
        createResponse.EnsureSuccessStatusCode();
        var job = (await createResponse.Content.ReadFromJsonAsync<JobOpeningResponse>())!;

        var openResponse = await SendAsync(
            owner, ownerCookies, HttpMethod.Patch, $"/api/workspaces/{workspaceId}/jobs/{job.Id}/status",
            new ChangeJobOpeningStatusRequest { Status = "Open", Version = job.Version });
        openResponse.EnsureSuccessStatusCode();
        return (await openResponse.Content.ReadFromJsonAsync<JobOpeningResponse>())!;
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
