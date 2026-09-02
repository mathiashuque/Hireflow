using Hireflow.Api.Authentication;
using Hireflow.Application.Workspaces;
using Hireflow.Infrastructure;
using Hireflow.Infrastructure.Configuration;
using Hireflow.Infrastructure.Health;
using Hireflow.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Npgsql;

namespace Hireflow.Tests.Unit;

/// <summary>
/// Fail-fast startup configuration checks, exercised directly against the extension
/// methods/validators rather than a full host boot — faster, and precise about which
/// specific setting is invalid.
/// </summary>
public sealed class ConfigurationValidationTests
{
    [Fact]
    public void AddInfrastructure_throws_a_clear_non_secret_message_when_the_database_connection_string_is_missing()
    {
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?> { ["ConnectionStrings:Database"] = "" })
            .Build();

        var exception = Assert.Throws<InvalidOperationException>(() => new ServiceCollection().AddInfrastructure(configuration));

        Assert.Contains("ConnectionStrings:Database", exception.Message);
        Assert.DoesNotContain("Host=", exception.Message);
        Assert.DoesNotContain("Password", exception.Message);
    }

    [Fact]
    public void AddInfrastructure_accepts_a_neon_postgresql_uri()
    {
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["ConnectionStrings:Database"] =
                    "postgresql://neondb_owner:p%40ss%3Aword@ep-example-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
            })
            .Build();

        using var provider = new ServiceCollection().AddInfrastructure(configuration).BuildServiceProvider();
        using var scope = provider.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<HireflowDbContext>();
        var parsed = new NpgsqlConnectionStringBuilder(dbContext.Database.GetConnectionString());

        Assert.Equal("ep-example-pooler.us-east-2.aws.neon.tech", parsed.Host);
        Assert.Equal(5432, parsed.Port);
        Assert.Equal("neondb", parsed.Database);
        Assert.Equal("neondb_owner", parsed.Username);
        Assert.Equal("p@ss:word", parsed.Password);
        Assert.Equal(SslMode.Require, parsed.SslMode);
        Assert.Equal(ChannelBinding.Require, parsed.ChannelBinding);
    }

    [Fact]
    public void AddInfrastructure_rejects_a_malformed_postgresql_uri_without_exposing_it()
    {
        const string secret = "do-not-log-this";
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["ConnectionStrings:Database"] = $"postgresql://owner:{secret}@host-without-database"
            })
            .Build();

        var exception = Assert.Throws<InvalidOperationException>(() => new ServiceCollection().AddInfrastructure(configuration));

        Assert.Contains("PostgreSQL URI", exception.Message);
        Assert.DoesNotContain(secret, exception.ToString());
    }

    [Fact]
    public void AddHireflowCors_throws_a_clear_non_secret_message_when_no_origin_is_configured()
    {
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>())
            .Build();

        var exception = Assert.Throws<InvalidOperationException>(() => new ServiceCollection().AddHireflowCors(configuration));

        Assert.Contains("Cors:AllowedOrigins", exception.Message);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    public void WorkspaceInvitationOptionsValidator_rejects_a_non_positive_lifetime(int lifetimeDays)
    {
        var result = new WorkspaceInvitationOptionsValidator().Validate(null, new WorkspaceInvitationOptions { LifetimeDays = lifetimeDays });

        Assert.True(result.Failed);
        Assert.Contains("LifetimeDays", result.FailureMessage);
    }

    [Fact]
    public void WorkspaceInvitationOptionsValidator_accepts_a_positive_lifetime()
    {
        var result = new WorkspaceInvitationOptionsValidator().Validate(null, new WorkspaceInvitationOptions { LifetimeDays = 7 });

        Assert.False(result.Failed);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-5)]
    public void HireflowHealthOptionsValidator_rejects_a_non_positive_timeout(int timeoutSeconds)
    {
        var result = new HireflowHealthOptionsValidator().Validate(null, new HireflowHealthOptions { DatabaseTimeoutSeconds = timeoutSeconds });

        Assert.True(result.Failed);
        Assert.Contains("DatabaseTimeoutSeconds", result.FailureMessage);
    }

    [Fact]
    public void HireflowHealthOptionsValidator_accepts_a_positive_timeout()
    {
        var result = new HireflowHealthOptionsValidator().Validate(null, new HireflowHealthOptions { DatabaseTimeoutSeconds = 5 });

        Assert.False(result.Failed);
    }
}
