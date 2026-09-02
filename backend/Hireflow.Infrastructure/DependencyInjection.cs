using Hireflow.Application.Auth;
using Hireflow.Application.Candidates;
using Hireflow.Application.Jobs;
using Hireflow.Application.Workspaces;
using Hireflow.Infrastructure.Candidates;
using Hireflow.Infrastructure.Identity;
using Hireflow.Infrastructure.Jobs;
using Hireflow.Infrastructure.Persistence;
using Hireflow.Infrastructure.Workspaces;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace Hireflow.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        var connectionString = configuration.GetConnectionString("Database");

        if (string.IsNullOrWhiteSpace(connectionString))
        {
            throw new InvalidOperationException(
                "ConnectionStrings:Database is required outside Development. " +
                "Configure it through a secure environment variable.");
        }

        services.AddDbContext<HireflowDbContext>(options =>
            options.UseNpgsql(connectionString));

        services.AddSingleton(TimeProvider.System);

        services
            .AddIdentityCore<HireflowUser>(options =>
            {
                // Rely on Identity's built-in password hashing and validation instead of
                // hand-written credential rules.
                options.Password.RequiredLength = 8;
                options.Password.RequireDigit = true;
                options.Password.RequireLowercase = true;
                options.Password.RequireUppercase = true;
                options.Password.RequireNonAlphanumeric = false;
                options.Password.RequiredUniqueChars = 4;

                options.User.RequireUniqueEmail = true;

                // Email confirmation, lockout UI, and MFA are explicitly out of scope
                // for this authentication foundation slice.
                options.SignIn.RequireConfirmedAccount = false;
            })
            .AddClaimsPrincipalFactory<HireflowUserClaimsPrincipalFactory>()
            .AddEntityFrameworkStores<HireflowDbContext>()
            .AddSignInManager();

        services.AddScoped<IAuthService, AuthService>();
        services.AddScoped<IWorkspaceService, WorkspaceService>();
        services.AddScoped<IWorkspaceInvitationService, WorkspaceInvitationService>();
        services.AddScoped<IWorkspaceMembershipService, WorkspaceMembershipService>();
        services.AddScoped<IJobOpeningService, JobOpeningService>();
        services.AddScoped<ICandidateService, CandidateService>();
        services.AddScoped<ICandidateNoteService, CandidateNoteService>();

        services.Configure<WorkspaceInvitationOptions>(configuration.GetSection(WorkspaceInvitationOptions.SectionName));

        return services;
    }
}
