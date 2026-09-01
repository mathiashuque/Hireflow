using Hireflow.Domain.Jobs;
using Hireflow.Domain.Workspaces;
using Hireflow.Infrastructure.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

namespace Hireflow.Infrastructure.Persistence;

/// <summary>
/// Hireflow's EF Core database context. It persists Identity user accounts and,
/// starting with this slice, workspaces and their membership.
/// </summary>
/// <remarks>
/// <see cref="IdentityUserContext{TUser, TKey}" /> is used instead of the full
/// <c>IdentityDbContext</c> because this slice has no ASP.NET Core Identity roles:
/// workspace-scoped roles are modeled explicitly on <see cref="WorkspaceMember" />
/// rather than through Identity's global role tables.
/// </remarks>
public sealed class HireflowDbContext(DbContextOptions<HireflowDbContext> options)
    : IdentityUserContext<HireflowUser, Guid>(options)
{
    public DbSet<Workspace> Workspaces => Set<Workspace>();

    public DbSet<WorkspaceMember> WorkspaceMembers => Set<WorkspaceMember>();

    public DbSet<WorkspaceInvitation> WorkspaceInvitations => Set<WorkspaceInvitation>();

    public DbSet<JobOpening> JobOpenings => Set<JobOpening>();

    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);

        builder.ApplyConfigurationsFromAssembly(typeof(HireflowDbContext).Assembly);
    }
}
