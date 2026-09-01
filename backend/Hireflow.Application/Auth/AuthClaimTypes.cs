namespace Hireflow.Application.Auth;

/// <summary>Claim types the API relies on beyond the framework's standard claim types.</summary>
public static class AuthClaimTypes
{
    /// <summary>The authenticated user's display name, added to the auth cookie's claims.</summary>
    public const string DisplayName = "hireflow:display_name";
}
