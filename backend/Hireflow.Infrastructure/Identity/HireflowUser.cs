using Microsoft.AspNetCore.Identity;

namespace Hireflow.Infrastructure.Identity;

/// <summary>
/// The ASP.NET Core Identity user for Hireflow. The <see cref="IdentityUser{TKey}.Id" />
/// is a stable <see cref="Guid" /> that future workspace membership and audit records
/// will reference as a foreign key.
/// </summary>
public sealed class HireflowUser : IdentityUser<Guid>
{
    /// <summary>
    /// The name shown to other users. Required and independent of the sign-in email.
    /// </summary>
    public required string DisplayName { get; set; }

    /// <summary>
    /// The UTC instant the account was created.
    /// </summary>
    public DateTimeOffset CreatedAt { get; set; }
}
