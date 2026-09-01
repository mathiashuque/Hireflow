using System.ComponentModel.DataAnnotations;

namespace Hireflow.Application.Auth;

/// <summary>Request body for <c>POST /api/auth/register</c>.</summary>
public sealed class RegisterRequest
{
    [Required]
    [EmailAddress]
    [MaxLength(256)]
    public required string Email { get; init; }

    [Required]
    public required string Password { get; init; }

    [Required]
    [MinLength(1)]
    [MaxLength(200)]
    public required string DisplayName { get; init; }
}

/// <summary>Request body for <c>POST /api/auth/login</c>.</summary>
public sealed class LoginRequest
{
    [Required]
    [EmailAddress]
    [MaxLength(256)]
    public required string Email { get; init; }

    [Required]
    public required string Password { get; init; }
}

/// <summary>Public shape of an authenticated account, returned by register, login, and me.</summary>
public sealed record AuthenticatedUserResponse(Guid Id, string Email, string DisplayName);

public enum RegistrationOutcome
{
    Success,
    EmailAlreadyRegistered,
    ValidationFailed,
}

public sealed record RegistrationResult(RegistrationOutcome Outcome, AuthenticatedUserResponse? User, IReadOnlyList<string> Errors)
{
    public static RegistrationResult Success(AuthenticatedUserResponse user) =>
        new(RegistrationOutcome.Success, user, []);

    public static RegistrationResult EmailAlreadyRegistered() =>
        new(RegistrationOutcome.EmailAlreadyRegistered, null, ["An account with this email already exists."]);

    public static RegistrationResult ValidationFailed(IReadOnlyList<string> errors) =>
        new(RegistrationOutcome.ValidationFailed, null, errors);
}

public enum SignInOutcome
{
    Success,
    InvalidCredentials,
}

public sealed record SignInResult(SignInOutcome Outcome, AuthenticatedUserResponse? User)
{
    public static SignInResult Success(AuthenticatedUserResponse user) => new(SignInOutcome.Success, user);

    public static SignInResult InvalidCredentials() => new(SignInOutcome.InvalidCredentials, null);
}
