using System.Security.Claims;
using Hireflow.Application.Common;

namespace Hireflow.Api.Authentication;

/// <summary>
/// Resolves the authenticated caller's id from the request's claims principal. Never
/// falls back to a default identity: a missing or malformed claim is a bug in an
/// endpoint that should have required authentication, not a reason to guess.
/// </summary>
public sealed class CurrentUser(IHttpContextAccessor httpContextAccessor) : ICurrentUser
{
    public Guid UserId
    {
        get
        {
            var idValue = httpContextAccessor.HttpContext?.User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (idValue is null || !Guid.TryParse(idValue, out var id))
            {
                throw new InvalidOperationException(
                    "No authenticated user id is available on the current request. " +
                    "This endpoint must be protected with [Authorize].");
            }

            return id;
        }
    }
}
