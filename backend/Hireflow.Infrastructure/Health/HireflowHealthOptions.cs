namespace Hireflow.Infrastructure.Health;

/// <summary>Configuration for Hireflow's own health checks (currently just the bounded database check).</summary>
public sealed class HireflowHealthOptions
{
    public const string SectionName = "Health";

    /// <summary>How long the readiness database check waits for PostgreSQL before reporting unhealthy.</summary>
    public int DatabaseTimeoutSeconds { get; set; } = 5;
}
