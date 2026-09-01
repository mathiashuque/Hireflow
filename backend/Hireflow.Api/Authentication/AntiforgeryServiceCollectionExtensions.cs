using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Http;

namespace Hireflow.Api.Authentication;

/// <summary>
/// Configures ASP.NET Core's antiforgery service for a cookie-authenticated JSON API
/// following the documented SPA pattern: the frontend reads a non-HttpOnly cookie
/// token and echoes it back in a request header on state-changing calls. Framework
/// antiforgery integration is not automatic for explicit controller endpoints (it is
/// designed around server-rendered forms), so this is wired explicitly rather than
/// disabled.
/// </summary>
public static class AntiforgeryServiceCollectionExtensions
{
    public const string CookieName = "Hireflow.Csrf";
    public const string HeaderName = "X-XSRF-TOKEN";

    public static IServiceCollection AddHireflowAntiforgery(
        this IServiceCollection services,
        IHostEnvironment environment)
    {
        services.AddAntiforgery(options =>
        {
            options.HeaderName = HeaderName;
            options.Cookie.Name = CookieName;
            // The pairing cookie itself stays HttpOnly; the readable request token is
            // issued separately by the CSRF endpoint below.
            options.Cookie.HttpOnly = true;

            if (environment.IsDevelopment())
            {
                options.Cookie.SameSite = SameSiteMode.Lax;
                options.Cookie.SecurePolicy = CookieSecurePolicy.SameAsRequest;
            }
            else
            {
                options.Cookie.SameSite = SameSiteMode.None;
                options.Cookie.SecurePolicy = CookieSecurePolicy.Always;
            }
        });

        return services;
    }

    /// <summary>
    /// Issues the readable request-token cookie the frontend must echo back as the
    /// <c>X-XSRF-TOKEN</c> header on state-changing requests.
    /// </summary>
    public static void IssueCsrfToken(this IAntiforgery antiforgery, HttpContext context, IHostEnvironment environment)
    {
        var tokens = antiforgery.GetAndStoreTokens(context);

        context.Response.Cookies.Append(
            "XSRF-TOKEN",
            tokens.RequestToken!,
            new CookieOptions
            {
                HttpOnly = false,
                SameSite = environment.IsDevelopment() ? SameSiteMode.Lax : SameSiteMode.None,
                Secure = !environment.IsDevelopment(),
                Path = "/",
            });
    }
}
