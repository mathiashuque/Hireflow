using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace Hireflow.Api.Authentication;

/// <summary>
/// Validates the antiforgery double-submit token pair on a state-changing endpoint.
/// <see cref="Microsoft.AspNetCore.Mvc.ValidateAntiForgeryTokenAttribute" /> is not
/// usable here: it depends on Mvc.ViewFeatures services that only exist when
/// <c>AddControllersWithViews</c>/<c>AddMvc</c> registers Razor form support, which this
/// API-only project does not use. This attribute calls <see cref="IAntiforgery" />
/// directly instead, so protection stays enforced rather than disabled.
/// </summary>
public sealed class ValidateCsrfTokenAttribute : Attribute, IAsyncActionFilter
{
    public async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
    {
        var antiforgery = context.HttpContext.RequestServices.GetRequiredService<IAntiforgery>();

        try
        {
            await antiforgery.ValidateRequestAsync(context.HttpContext);
        }
        catch (AntiforgeryValidationException)
        {
            context.Result = new ObjectResult(new ProblemDetails
            {
                Title = "Missing or invalid CSRF token",
                Detail = "Call GET /api/auth/csrf and echo the XSRF-TOKEN cookie back as the X-XSRF-TOKEN header.",
                Status = StatusCodes.Status400BadRequest,
            })
            {
                StatusCode = StatusCodes.Status400BadRequest,
            };
            return;
        }

        await next();
    }
}
