using Testcontainers.PostgreSql;

namespace Hireflow.Tests.Integration;

/// <summary>
/// Starts one disposable PostgreSQL container for the whole auth integration test
/// collection. Using a real Npgsql-backed database (rather than EF's non-relational
/// in-memory provider) exercises the actual provider behavior the app depends on
/// (unique indexes, column types, etc.) without touching Neon or any shared database.
/// </summary>
public sealed class PostgresContainerFixture : IAsyncLifetime
{
    private readonly PostgreSqlContainer _container = new PostgreSqlBuilder("postgres:17-alpine")
        .WithDatabase("hireflow_test")
        .WithUsername("hireflow_test")
        .WithPassword("hireflow_test")
        .Build();

    public string ConnectionString => _container.GetConnectionString();

    public Task InitializeAsync() => _container.StartAsync();

    public Task DisposeAsync() => _container.DisposeAsync().AsTask();
}

[CollectionDefinition(Name)]
public sealed class PostgresCollection : ICollectionFixture<PostgresContainerFixture>
{
    public const string Name = "Postgres";
}
