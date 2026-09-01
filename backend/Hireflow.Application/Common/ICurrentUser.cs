namespace Hireflow.Application.Common;

/// <summary>
/// Resolves the authenticated caller's stable user id from the current HTTP request.
/// Implemented in the Api layer against <c>HttpContext</c>; Application and
/// Infrastructure depend only on this contract, never on claims or routing directly.
/// </summary>
public interface ICurrentUser
{
    /// <summary>
    /// The authenticated caller's id. Throws if no authenticated identity is present;
    /// every endpoint that uses this must require authentication so that never happens.
    /// </summary>
    Guid UserId { get; }
}
