using System.ComponentModel.DataAnnotations;

namespace Hireflow.Application.Workspaces;

/// <summary>Request body for <c>POST /api/workspaces</c>.</summary>
public sealed class CreateWorkspaceRequest
{
    [Required]
    [MaxLength(200)]
    public required string Name { get; init; }

    /// <summary>Optional caller-chosen slug. Normalized server-side; a collision is
    /// resolved with a distinct suffixed slug rather than overwriting the existing one.</summary>
    [MaxLength(100)]
    public string? Slug { get; init; }
}

/// <summary>A workspace as it appears in the caller's workspace list.</summary>
public sealed record WorkspaceSummaryResponse(Guid Id, string Name, string Slug, DateTimeOffset CreatedAt, string Role);

/// <summary>A single workspace's detail, including the caller's role in it.</summary>
public sealed record WorkspaceDetailResponse(Guid Id, string Name, string Slug, DateTimeOffset CreatedAt, string Role);

/// <summary>One member of a workspace, as returned by the members endpoint.</summary>
public sealed record WorkspaceMemberResponse(Guid UserId, string DisplayName, string Role, DateTimeOffset JoinedAt);

public enum CreateWorkspaceOutcome
{
    Success,
    ValidationFailed,

    /// <summary>Every suffixed slug candidate was already taken; exceedingly unlikely in practice.</summary>
    SlugConflict,
}

public sealed record CreateWorkspaceResult(CreateWorkspaceOutcome Outcome, WorkspaceDetailResponse? Workspace, IReadOnlyList<string> Errors)
{
    public static CreateWorkspaceResult Success(WorkspaceDetailResponse workspace) =>
        new(CreateWorkspaceOutcome.Success, workspace, []);

    public static CreateWorkspaceResult ValidationFailed(IReadOnlyList<string> errors) =>
        new(CreateWorkspaceOutcome.ValidationFailed, null, errors);

    public static CreateWorkspaceResult SlugConflict() =>
        new(CreateWorkspaceOutcome.SlugConflict, null, ["Could not find an available workspace URL. Try a different name or slug."]);
}
