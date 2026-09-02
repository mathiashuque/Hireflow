namespace Hireflow.Application.Health;

/// <summary>
/// The public shape of every <c>/api/health/*</c> response. Deliberately minimal: an
/// overall status plus each named check's own status, with no connection strings,
/// hostnames, database names/users, exception text, or precise timing that could aid
/// infrastructure enumeration. Detailed diagnostics belong only in server-side logs.
/// </summary>
public sealed record HealthCheckResponse(string Status, IReadOnlyDictionary<string, string> Checks);
