using System.Security.Claims;

namespace Hireflow.Api.Observability;

/// <summary>
/// Enriches the logging scope with the caller's UserId (once authenticated) and the
/// route's WorkspaceId (once routing has matched), so every log line for a request can be
/// tied to who made it and which tenant it targeted without any individual log call
/// repeating that context. Registered after authentication/authorization: a missing or
/// malformed value is simply omitted from the scope — it never fails the request or
/// implies the caller is authorized for anything.
/// </summary>
public sealed class RequestContextLoggingMiddleware(RequestDelegate next, ILogger<RequestContextLoggingMiddleware> logger)
{
    public async Task InvokeAsync(HttpContext context)
    {
        var scopeState = new Dictionary<string, object?>();

        var userId = context.User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (Guid.TryParse(userId, out var parsedUserId))
        {
            scopeState["UserId"] = parsedUserId;
        }

        if (context.Request.RouteValues.TryGetValue("workspaceId", out var workspaceIdValue) &&
            Guid.TryParse(workspaceIdValue?.ToString(), out var parsedWorkspaceId))
        {
            scopeState["WorkspaceId"] = parsedWorkspaceId;
        }

        using (logger.BeginScope(scopeState))
        {
            await next(context);
        }
    }
}
