using Hireflow.Infrastructure.Persistence;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace Hireflow.Tests.Integration;

/// <summary>
/// Boots the real API pipeline (Program.cs) against a disposable PostgreSQL container
/// instead of production configuration.
/// </summary>
public sealed class HireflowApiFactory(string connectionString) : WebApplicationFactory<Program>
{
    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Development");

        builder.ConfigureAppConfiguration((_, configBuilder) =>
        {
            configBuilder.AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Cors:AllowedOrigins:0"] = "http://localhost:3000",
            });
        });

        // AddInfrastructure() reads ConnectionStrings:Database eagerly (it needs the
        // value immediately to fail fast when it's missing outside Development), so a
        // later configuration override never reaches it. Replace the already-registered
        // DbContextOptions with the container's connection string instead, which is the
        // supported way to redirect EF Core in WebApplicationFactory-based tests.
        builder.ConfigureServices(services =>
        {
            services.RemoveAll<DbContextOptions<HireflowDbContext>>();
            services.AddDbContext<HireflowDbContext>(options => options.UseNpgsql(connectionString));
        });
    }

    /// <summary>Applies the committed migrations to the container database. Test-only:
    /// the running application never applies migrations automatically.</summary>
    public async Task MigrateDatabaseAsync()
    {
        using var scope = Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<HireflowDbContext>();
        await dbContext.Database.MigrateAsync();
    }
}
