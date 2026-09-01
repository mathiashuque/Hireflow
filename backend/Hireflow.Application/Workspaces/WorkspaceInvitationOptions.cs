namespace Hireflow.Application.Workspaces;

/// <summary>Configuration for how long a workspace invitation stays acceptable.</summary>
public sealed class WorkspaceInvitationOptions
{
    public const string SectionName = "WorkspaceInvitations";

    public int LifetimeDays { get; set; } = 7;
}
