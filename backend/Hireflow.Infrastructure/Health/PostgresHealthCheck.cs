using Hireflow.Infrastructure.Persistence;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using Microsoft.Extensions.Options;

namespace Hireflow.Infrastructure.Health;

/// <summary>
/// Readiness-only PostgreSQL connectivity check: opens a connection through the
/// configured EF Core/Npgsql database and confirms it responds, bounded by a short
/// configurable timeout. Never runs migrations, creates schema, or writes rows — a
/// pure, cheap connectivity probe safe to call from a public load balancer.
/// </summary>
public sealed class PostgresHealthCheck(HireflowDbContext dbContext, IOptions<HireflowHealthOptions> options) : IHealthCheck
{
    public async Task<HealthCheckResult> CheckHealthAsync(
        HealthCheckContext context,
        CancellationToken cancellationToken = default)
    {
        using var timeoutSource = new CancellationTokenSource(TimeSpan.FromSeconds(Math.Max(1, options.Value.DatabaseTimeoutSeconds)));
        using var linkedSource = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken, timeoutSource.Token);

        try
        {
            var canConnect = await dbContext.Database.CanConnectAsync(linkedSource.Token);
            return canConnect
                ? HealthCheckResult.Healthy()
                : HealthCheckResult.Unhealthy();
        }
        catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
        {
            // The bounded timeout elapsed rather than the caller cancelling the request.
            return HealthCheckResult.Unhealthy();
        }
        catch (Exception)
        {
            // Never surface the provider exception (connection string, host, error text)
            // in the health response; detailed diagnostics belong in server-side logs,
            // which the framework's own health-check logging already captures.
            return HealthCheckResult.Unhealthy();
        }
    }
}
