using System.Diagnostics;
using System.Text.RegularExpressions;

namespace Hireflow.Api.Observability;

/// <summary>
/// Establishes one correlation ID per request, early enough to cover every response —
/// including framework-owned ones like a cookie-auth <c>401</c> or a status-code-pages
/// problem response. A caller-supplied <c>X-Request-ID</c> is used only if it is a short,
/// safe token (never trusted as a log template/property name, and never allowed to inject
/// extra headers/lines); otherwise the server's own trace ID is used. That same value
/// becomes <see cref="HttpContext.TraceIdentifier" /> — the exact value the problem-details
/// customizer places in a response body's <c>traceId</c> — so a client can always correlate
/// a response, its <c>X-Request-ID</c> header, and its <c>traceId</c> body field as one.
/// </summary>
public sealed partial class RequestCorrelationMiddleware(RequestDelegate next, ILogger<RequestCorrelationMiddleware> logger)
{
    public const string RequestIdHeaderName = "X-Request-ID";

    private const int MaxRequestIdLength = 128;

    public async Task InvokeAsync(HttpContext context)
    {
        var correlationId = ResolveCorrelationId(context);
        context.TraceIdentifier = correlationId;

        context.Response.OnStarting(() =>
        {
            context.Response.Headers[RequestIdHeaderName] = correlationId;
            return Task.CompletedTask;
        });

        var activity = Activity.Current;
        using (logger.BeginScope(new Dictionary<string, object?>
               {
                   ["CorrelationId"] = correlationId,
                   ["TraceId"] = activity?.TraceId.ToString(),
                   ["SpanId"] = activity?.SpanId.ToString(),
               }))
        {
            await next(context);
        }
    }

    private static string ResolveCorrelationId(HttpContext context)
    {
        if (context.Request.Headers.TryGetValue(RequestIdHeaderName, out var provided) &&
            provided.Count > 0 &&
            IsSafeRequestId(provided[0]))
        {
            return provided[0]!;
        }

        return context.TraceIdentifier;
    }

    private static bool IsSafeRequestId(string? value) =>
        value is { Length: > 0 and <= MaxRequestIdLength } && SafeRequestIdPattern().IsMatch(value);

    [GeneratedRegex("^[A-Za-z0-9._-]+$")]
    private static partial Regex SafeRequestIdPattern();
}
