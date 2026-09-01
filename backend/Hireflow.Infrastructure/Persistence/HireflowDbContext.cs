using Hireflow.Infrastructure.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

namespace Hireflow.Infrastructure.Persistence;

/// <summary>
/// Hireflow's EF Core database context. It currently persists Identity user accounts
/// only; this slice intentionally has no workspace or hiring-domain tables yet.
/// </summary>
/// <remarks>
/// <see cref="IdentityUserContext{TUser, TKey}" /> is used instead of the full
/// <c>IdentityDbContext</c> because this slice has no ASP.NET Core Identity roles:
/// future workspace-scoped roles will be modeled explicitly on <c>WorkspaceMember</c>
/// rather than through Identity's global role tables.
/// </remarks>
public sealed class HireflowDbContext(DbContextOptions<HireflowDbContext> options)
    : IdentityUserContext<HireflowUser, Guid>(options)
{
    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);

        builder.ApplyConfigurationsFromAssembly(typeof(HireflowDbContext).Assembly);
    }
}
