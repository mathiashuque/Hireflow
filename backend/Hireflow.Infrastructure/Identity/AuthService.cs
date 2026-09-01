using Hireflow.Application.Auth;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Logging;
using AppSignInResult = Hireflow.Application.Auth.SignInResult;

namespace Hireflow.Infrastructure.Identity;

public sealed class AuthService(
    UserManager<HireflowUser> userManager,
    SignInManager<HireflowUser> signInManager,
    TimeProvider timeProvider,
    ILogger<AuthService> logger)
    : IAuthService
{
    public async Task<RegistrationResult> RegisterAsync(RegisterRequest request, CancellationToken cancellationToken)
    {
        var email = request.Email.Trim();
        var displayName = request.DisplayName.Trim();

        var user = new HireflowUser
        {
            UserName = email,
            Email = email,
            DisplayName = displayName,
            CreatedAt = timeProvider.GetUtcNow(),
        };

        var createResult = await userManager.CreateAsync(user, request.Password);
        if (!createResult.Succeeded)
        {
            if (createResult.Errors.Any(error => error.Code is "DuplicateUserName" or "DuplicateEmail"))
            {
                logger.LogInformation("Registration rejected: email already registered.");
                return RegistrationResult.EmailAlreadyRegistered();
            }

            logger.LogInformation("Registration rejected: {ErrorCount} validation error(s).", createResult.Errors.Count());
            return RegistrationResult.ValidationFailed(createResult.Errors.Select(error => error.Description).ToArray());
        }

        // Registering establishes the session immediately; no separate confirmation step exists in this slice.
        await signInManager.SignInAsync(user, isPersistent: true);

        logger.LogInformation("User {UserId} registered.", user.Id);
        return RegistrationResult.Success(ToResponse(user));
    }

    public async Task<AppSignInResult> SignInAsync(LoginRequest request, CancellationToken cancellationToken)
    {
        var email = request.Email.Trim();
        var user = await userManager.FindByEmailAsync(email);
        if (user is null)
        {
            // Do not reveal whether the account exists.
            logger.LogInformation("Login rejected: invalid credentials.");
            return AppSignInResult.InvalidCredentials();
        }

        var checkResult = await signInManager.CheckPasswordSignInAsync(user, request.Password, lockoutOnFailure: false);
        if (!checkResult.Succeeded)
        {
            logger.LogInformation("Login rejected: invalid credentials.");
            return AppSignInResult.InvalidCredentials();
        }

        await signInManager.SignInAsync(user, isPersistent: true);

        logger.LogInformation("User {UserId} signed in.", user.Id);
        return AppSignInResult.Success(ToResponse(user));
    }

    public Task SignOutAsync(CancellationToken cancellationToken) => signInManager.SignOutAsync();

    private static AuthenticatedUserResponse ToResponse(HireflowUser user) =>
        new(user.Id, user.Email!, user.DisplayName);
}
