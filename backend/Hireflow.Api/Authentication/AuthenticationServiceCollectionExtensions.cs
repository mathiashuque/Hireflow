using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Identity;

namespace Hireflow.Api.Authentication;

/// <summary>
/// Configures the Identity application cookie for API consumption: JSON 401/403
/// instead of HTML login redirects, and a same-site policy appropriate for this
/// slice's frontend/API deployment model (same registrable "site" in local
/// development across ports; separate hosts in production, which requires
/// <c>SameSite=None</c> over HTTPS).
/// </summary>
public static class AuthenticationServiceCollectionExtensions
{
    public const string CookieName = "Hireflow.Auth";

    public static IServiceCollection AddHireflowAuthentication(
        this IServiceCollection services,
        IHostEnvironment environment)
    {
        services
            .AddAuthentication(IdentityConstants.ApplicationScheme)
            .AddIdentityCookies();

        services.AddAuthorization();

        services.ConfigureApplicationCookie(options =>
        {
            options.Cookie.Name = CookieName;
            options.Cookie.HttpOnly = true;

            if (environment.IsDevelopment())
            {
                // Local development runs the frontend and API on different ports of the
                // same "localhost" site over plain HTTP; Lax cookies flow across ports
                // without requiring HTTPS.
                options.Cookie.SameSite = SameSiteMode.Lax;
                options.Cookie.SecurePolicy = CookieSecurePolicy.SameAsRequest;
            }
            else
            {
                // The documented deployment (Next.js on Vercel, the API on separate
                // Docker-compatible hosting) is cross-site, which requires SameSite=None
                // and Secure together.
                options.Cookie.SameSite = SameSiteMode.None;
                options.Cookie.SecurePolicy = CookieSecurePolicy.Always;
            }

            options.ExpireTimeSpan = TimeSpan.FromDays(14);
            options.SlidingExpiration = true;

            // Never redirect to an HTML login/access-denied page: this is a JSON API.
            options.Events.OnRedirectToLogin = context =>
            {
                context.Response.StatusCode = StatusCodes.Status401Unauthorized;
                return Task.CompletedTask;
            };
            options.Events.OnRedirectToAccessDenied = context =>
            {
                context.Response.StatusCode = StatusCodes.Status403Forbidden;
                return Task.CompletedTask;
            };
        });

        return services;
    }
}
