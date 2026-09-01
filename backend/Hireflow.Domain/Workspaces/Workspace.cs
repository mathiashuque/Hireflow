namespace Hireflow.Domain.Workspaces;

/// <summary>
/// A tenant. Every hiring-domain entity Hireflow adds later will carry this
/// workspace's <see cref="Id" /> as its tenant key.
/// </summary>
public sealed class Workspace
{
    public required Guid Id { get; init; }

    public required string Name { get; set; }

    /// <summary>Canonical, URL-safe, case-insensitively unique identifier for the workspace.</summary>
    public required string Slug { get; set; }

    public required DateTimeOffset CreatedAt { get; init; }

    public ICollection<WorkspaceMember> Members { get; init; } = new List<WorkspaceMember>();
}
