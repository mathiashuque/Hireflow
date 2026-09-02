using Hireflow.Application.Workspaces;
using Microsoft.Extensions.Options;

namespace Hireflow.Infrastructure.Configuration;

/// <summary>Fails startup with a clear, non-secret message rather than silently accepting a nonsensical invitation lifetime.</summary>
public sealed class WorkspaceInvitationOptionsValidator : IValidateOptions<WorkspaceInvitationOptions>
{
    public ValidateOptionsResult Validate(string? name, WorkspaceInvitationOptions options) =>
        options.LifetimeDays > 0
            ? ValidateOptionsResult.Success
            : ValidateOptionsResult.Fail(
                $"{WorkspaceInvitationOptions.SectionName}:{nameof(WorkspaceInvitationOptions.LifetimeDays)} must be a positive number of days.");
}
