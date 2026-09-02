namespace Hireflow.Api.Errors;

/// <summary>
/// Registers Hireflow's canonical <c>application/problem+json</c> shape: every response,
/// however it was produced (a controller's <c>Problem()</c>/<c>ValidationProblem()</c>,
/// the <c>[ApiController]</c> automatic model-state <c>400</c>, cookie-auth
/// <c>401</c>/<c>403</c> with no body, an unmatched route, or an unhandled exception)
/// converges on the same <c>type</c>/<c>code</c>/<c>traceId</c> extensions.
/// </summary>
public static class HireflowProblemDetailsOptions
{
    public const string CodeExtensionKey = "code";
    public const string TraceIdExtensionKey = "traceId";

    public static IServiceCollection AddHireflowProblemDetails(this IServiceCollection services)
    {
        services.AddProblemDetails(options =>
        {
            options.CustomizeProblemDetails = context =>
            {
                var problemDetails = context.ProblemDetails;

                if (!problemDetails.Extensions.TryGetValue(CodeExtensionKey, out var codeValue) ||
                    codeValue is not string { Length: > 0 } code)
                {
                    code = ProblemCodes.DefaultForStatus(problemDetails.Status);
                    problemDetails.Extensions[CodeExtensionKey] = code;
                }

                problemDetails.Type ??= $"https://hireflow.dev/problems/{code}";
                problemDetails.Extensions[TraceIdExtensionKey] = context.HttpContext.TraceIdentifier;

                // The documented response contract never discloses exception internals,
                // SQL/provider details, connection strings, or stack traces, even though
                // the framework's own diagnostics remain available server-side via
                // logging. This holds regardless of environment: Development tooling
                // (the interactive reference, logs) is a separate, safer channel for that
                // detail than a response body a client can capture.
                if (problemDetails.Status is StatusCodes.Status500InternalServerError)
                {
                    problemDetails.Detail = null;
                }
            };
        });

        return services;
    }
}
