using Hireflow.Application.Health;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Diagnostics.HealthChecks;

namespace Hireflow.Api.Controllers;

/// <summary>
/// Anonymous, read-only, bounded operational endpoints safe for a public load balancer.
/// These prove the process/its dependencies are reachable — they are not proof that a
/// caller is authorized for anything else.
/// </summary>
[ApiController]
[Route("api/health")]
[AllowAnonymous]
public sealed class HealthController(HealthCheckService healthCheckService) : ControllerBase
{
    /// <summary>Process liveness only. Never touches the database/network, so it stays healthy through a transient PostgreSQL outage.</summary>
    [HttpGet("live")]
    [ProducesResponseType<HealthCheckResponse>(StatusCodes.Status200OK)]
    public ActionResult<HealthCheckResponse> Live() =>
        Ok(new HealthCheckResponse(HealthStatus.Healthy.ToString(), new Dictionary<string, string>()));

    /// <summary>Readiness including a bounded PostgreSQL connectivity check.</summary>
    [HttpGet("ready")]
    [ProducesResponseType<HealthCheckResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType<HealthCheckResponse>(StatusCodes.Status503ServiceUnavailable)]
    public async Task<ActionResult<HealthCheckResponse>> Ready(CancellationToken cancellationToken) => await RunReadyChecksAsync(cancellationToken);

    /// <summary>Compatibility alias for <see cref="Ready" />, kept so existing callers/checks don't silently break.</summary>
    [HttpGet]
    [ProducesResponseType<HealthCheckResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType<HealthCheckResponse>(StatusCodes.Status503ServiceUnavailable)]
    public async Task<ActionResult<HealthCheckResponse>> Alias(CancellationToken cancellationToken) => await RunReadyChecksAsync(cancellationToken);

    private async Task<ActionResult<HealthCheckResponse>> RunReadyChecksAsync(CancellationToken cancellationToken)
    {
        var report = await healthCheckService.CheckHealthAsync(check => check.Tags.Contains("ready"), cancellationToken);

        var response = new HealthCheckResponse(
            report.Status.ToString(),
            report.Entries.ToDictionary(entry => entry.Key, entry => entry.Value.Status.ToString()));

        return report.Status == HealthStatus.Healthy
            ? Ok(response)
            : StatusCode(StatusCodes.Status503ServiceUnavailable, response);
    }
}
