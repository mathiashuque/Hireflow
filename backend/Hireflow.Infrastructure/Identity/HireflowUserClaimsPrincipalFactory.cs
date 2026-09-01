using System.Security.Claims;
using Hireflow.Application.Auth;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Options;

namespace Hireflow.Infrastructure.Identity;

/// <summary>
/// Adds the claims the API relies on for <c>GET /api/auth/me</c> so that request can be
/// served entirely from the authentication cookie's claims, without an extra database
/// round trip on every call.
/// </summary>
public sealed class HireflowUserClaimsPrincipalFactory(
    UserManager<HireflowUser> userManager,
    IOptions<IdentityOptions> optionsAccessor)
    : UserClaimsPrincipalFactory<HireflowUser>(userManager, optionsAccessor)
{
    public override async Task<ClaimsPrincipal> CreateAsync(HireflowUser user)
    {
        var principal = await base.CreateAsync(user);
        var identity = (ClaimsIdentity)principal.Identity!;

        if (identity.FindFirst(ClaimTypes.Email) is null && user.Email is not null)
        {
            identity.AddClaim(new Claim(ClaimTypes.Email, user.Email));
        }

        identity.AddClaim(new Claim(AuthClaimTypes.DisplayName, user.DisplayName));

        return principal;
    }
}
