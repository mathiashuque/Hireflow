using System.Security.Claims;
using Hireflow.Api.Authentication;
using Hireflow.Application.Auth;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.ModelBinding;

namespace Hireflow.Api.Controllers;

[ApiController]
[Route("api/auth")]
public sealed class AuthController(IAuthService authService, IAntiforgery antiforgery, IHostEnvironment environment)
    : ControllerBase
{
    /// <summary>
    /// Primes the CSRF cookie pair. The frontend calls this before any state-changing
    /// request and echoes the readable token back as the <c>X-XSRF-TOKEN</c> header.
    /// </summary>
    [HttpGet("csrf")]
    [AllowAnonymous]
    public IActionResult GetCsrfToken()
    {
        antiforgery.IssueCsrfToken(HttpContext, environment);
        return NoContent();
    }

    [HttpPost("register")]
    [ValidateCsrfToken]
    public async Task<ActionResult<AuthenticatedUserResponse>> Register(
        [FromBody] RegisterRequest request,
        CancellationToken cancellationToken)
    {
        var result = await authService.RegisterAsync(request, cancellationToken);

        return result.Outcome switch
        {
            RegistrationOutcome.Success => Ok(result.User),
            RegistrationOutcome.EmailAlreadyRegistered => Problem(
                title: "Registration failed",
                detail: "An account with this email already exists.",
                statusCode: StatusCodes.Status409Conflict),
            RegistrationOutcome.ValidationFailed => ValidationProblem(ToModelState(nameof(request.Password), result.Errors)),
            _ => Problem(statusCode: StatusCodes.Status500InternalServerError),
        };
    }

    [HttpPost("login")]
    [ValidateCsrfToken]
    public async Task<ActionResult<AuthenticatedUserResponse>> Login(
        [FromBody] LoginRequest request,
        CancellationToken cancellationToken)
    {
        var result = await authService.SignInAsync(request, cancellationToken);

        return result.Outcome switch
        {
            SignInOutcome.Success => Ok(result.User),
            SignInOutcome.InvalidCredentials => Problem(
                title: "Login failed",
                detail: "Invalid email or password.",
                statusCode: StatusCodes.Status401Unauthorized),
            _ => Problem(statusCode: StatusCodes.Status500InternalServerError),
        };
    }

    [HttpPost("logout")]
    [Authorize]
    [ValidateCsrfToken]
    public async Task<IActionResult> Logout(CancellationToken cancellationToken)
    {
        await authService.SignOutAsync(cancellationToken);
        return NoContent();
    }

    [HttpGet("me")]
    [Authorize]
    public ActionResult<AuthenticatedUserResponse> Me()
    {
        var idValue = User.FindFirstValue(ClaimTypes.NameIdentifier);
        var email = User.FindFirstValue(ClaimTypes.Email);
        var displayName = User.FindFirstValue(AuthClaimTypes.DisplayName);

        if (idValue is null || !Guid.TryParse(idValue, out var id) || email is null || displayName is null)
        {
            // The cookie is valid but predates claims this endpoint requires (e.g. an
            // account created before a claims-shape change). Treat it as unauthenticated
            // rather than exposing a partial/incorrect identity.
            return Problem(statusCode: StatusCodes.Status401Unauthorized);
        }

        return Ok(new AuthenticatedUserResponse(id, email, displayName));
    }

    private static ModelStateDictionary ToModelState(string key, IReadOnlyList<string> errors)
    {
        var modelState = new ModelStateDictionary();
        foreach (var error in errors)
        {
            modelState.AddModelError(key, error);
        }

        return modelState;
    }
}
