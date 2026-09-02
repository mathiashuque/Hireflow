using Hireflow.Api.Authentication;
using Hireflow.Api.Errors;
using Hireflow.Api.OpenApi;
using Hireflow.Application.Common;
using Hireflow.Infrastructure;
using Scalar.AspNetCore;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.

builder.Services.AddControllers();
builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<ICurrentUser, CurrentUser>();
builder.Services.AddInfrastructure(builder.Configuration);
builder.Services.AddHireflowAuthentication(builder.Environment);
builder.Services.AddHireflowAntiforgery(builder.Environment);
builder.Services.AddHireflowCors(builder.Configuration);
builder.Services.AddHireflowProblemDetails();
builder.Services.AddHireflowOpenApi();

var app = builder.Build();

// Configure the HTTP request pipeline.
app.UseExceptionHandler();

// Converts any response that reaches here with a 4xx/5xx status and no body yet (cookie-
// auth 401/403, an unmatched route, a plain controller NotFound()/Forbid()) into the same
// application/problem+json shape as a hand-built Problem() response. Registered before
// routing/auth so it wraps everything downstream.
app.UseStatusCodePages();

if (app.Environment.IsDevelopment())
{
    // The generated document and interactive reference are Development-only tooling:
    // exposing the full endpoint/schema map by default in Production is unnecessary
    // attack-surface disclosure for a product with no public API consumers yet.
    app.MapOpenApi();
    app.MapScalarApiReference("/api-docs", options =>
    {
        options.Title = "Hireflow API reference";
        // "Try it" needs the caller's own credentials/CSRF token, which this UI cannot
        // supply on its own (the auth cookie is intentionally not JavaScript-readable,
        // and the CSRF cookie is scoped to same-origin requests from the frontend). See
        // README.md's API reference section for the manual cookie/CSRF steps.
    });
}

app.UseCors(HireflowCorsServiceCollectionExtensions.PolicyName);

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

if (app.Environment.IsEnvironment("Testing"))
{
    // Exists only so integration tests can exercise the unhandled-exception -> safe 500
    // problem-details path end to end. Never registered outside the test-only
    // "Testing" environment, so it can never reach a real deployment.
    app.MapGet("/api/test-only/throw", (HttpContext _) => throw new InvalidOperationException("Deliberate test-only failure."));
}

app.Run();

public partial class Program;
