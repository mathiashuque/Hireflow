namespace Hireflow.Domain.Workspaces;

/// <summary>
/// A member's role within a single workspace (tenant). Persisted as its name rather
/// than its ordinal so reordering or inserting members never changes stored meaning.
/// </summary>
public enum WorkspaceRole
{
    Owner,
    Recruiter,
    Interviewer,
}
