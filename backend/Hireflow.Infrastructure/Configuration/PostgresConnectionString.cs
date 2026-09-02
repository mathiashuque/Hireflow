using Npgsql;

namespace Hireflow.Infrastructure.Configuration;

internal static class PostgresConnectionString
{
    public static string Normalize(string configuredValue)
    {
        try
        {
            if (!configuredValue.StartsWith("postgres://", StringComparison.OrdinalIgnoreCase) &&
                !configuredValue.StartsWith("postgresql://", StringComparison.OrdinalIgnoreCase))
            {
                return new NpgsqlConnectionStringBuilder(configuredValue).ConnectionString;
            }

            var uri = new Uri(configuredValue, UriKind.Absolute);
            var credentials = uri.UserInfo.Split(':', 2);
            var database = Uri.UnescapeDataString(uri.AbsolutePath.TrimStart('/'));

            if (string.IsNullOrWhiteSpace(uri.Host) ||
                credentials.Length != 2 ||
                string.IsNullOrWhiteSpace(credentials[0]) ||
                string.IsNullOrWhiteSpace(database) ||
                database.Contains('/'))
            {
                throw new FormatException();
            }

            var builder = new NpgsqlConnectionStringBuilder
            {
                Host = uri.Host,
                Port = uri.Port > 0 ? uri.Port : 5432,
                Database = database,
                Username = Uri.UnescapeDataString(credentials[0]),
                Password = Uri.UnescapeDataString(credentials[1])
            };

            foreach (var parameter in uri.Query.TrimStart('?').Split('&', StringSplitOptions.RemoveEmptyEntries))
            {
                var pair = parameter.Split('=', 2);
                if (pair.Length != 2)
                {
                    throw new FormatException();
                }

                // Neon uses libpq-style names such as sslmode and channel_binding.
                // Npgsql accepts the equivalent keywords with spaces.
                var key = Uri.UnescapeDataString(pair[0]).Replace('_', ' ');
                var value = Uri.UnescapeDataString(pair[1]);
                builder[key] = value;
            }

            return builder.ConnectionString;
        }
        catch (Exception exception) when (exception is ArgumentException or FormatException or UriFormatException)
        {
            throw new InvalidOperationException(
                "ConnectionStrings:Database must be a valid Npgsql connection string or PostgreSQL URI.");
        }
    }
}
