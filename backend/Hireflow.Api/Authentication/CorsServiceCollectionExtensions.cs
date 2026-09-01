namespace Hireflow.Api.Authentication;

/// <summary>
/// Configures CORS for the credentialed frontend/API relationship. Origins come from
/// configuration (<c>Cors:AllowedOrigins</c>) rather than a wildcard, because a wildcard
/// origin cannot be combined with <see cref="Microsoft.AspNetCore.Cors.Infrastructure.CorsPolicyBuilder.AllowCredentials" />.
/// </summary>
public static class HireflowCorsServiceCollectionExtensions
{
    public const string PolicyName = "Frontend";

    public static IServiceCollection AddHireflowCors(this IServiceCollection services, IConfiguration configuration)
    {
        var allowedOrigins = configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? [];

        if (allowedOrigins.Length == 0)
        {
            throw new InvalidOperationException(
                "Cors:AllowedOrigins must list at least one explicit frontend origin. " +
                "A wildcard origin cannot be used with credentialed requests.");
        }

        services.AddCors(options =>
        {
            options.AddPolicy(PolicyName, policy =>
            {
                policy.WithOrigins(allowedOrigins)
                    .AllowAnyHeader()
                    .AllowAnyMethod()
                    .AllowCredentials();
            });
        });

        return services;
    }
}
