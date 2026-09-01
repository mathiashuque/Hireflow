namespace Hireflow.Application.Auth;

/// <summary>
/// Orchestrates the account use cases behind <c>/api/auth</c>. Implemented in
/// Infrastructure against ASP.NET Core Identity; the API controller depends only on
/// this contract and the DTOs above.
/// </summary>
public interface IAuthService
{
    Task<RegistrationResult> RegisterAsync(RegisterRequest request, CancellationToken cancellationToken);

    Task<SignInResult> SignInAsync(LoginRequest request, CancellationToken cancellationToken);

    Task SignOutAsync(CancellationToken cancellationToken);
}
