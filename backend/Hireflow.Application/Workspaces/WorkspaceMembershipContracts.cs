using System.ComponentModel.DataAnnotations;

namespace Hireflow.Application.Workspaces;

/// <summary>Request body for <c>PATCH /api/workspaces/{workspaceId}/members/{userId}/role</c>.</summary>
public sealed class ChangeMemberRoleRequest
{
    [Required]
    public required string Role { get; init; }
}

public enum ChangeMemberRoleOutcome
{
    Success,
    NotFound,
    Forbidden,
    ValidationFailed,

    /// <summary>The change would leave the workspace with no Owner.</summary>
    LastOwner,
}

public sealed record ChangeMemberRoleResult(ChangeMemberRoleOutcome Outcome, IReadOnlyList<string> Errors)
{
    public static ChangeMemberRoleResult Success() => new(ChangeMemberRoleOutcome.Success, []);

    public static ChangeMemberRoleResult NotFound() => new(ChangeMemberRoleOutcome.NotFound, []);

    public static ChangeMemberRoleResult Forbidden() => new(ChangeMemberRoleOutcome.Forbidden, []);

    public static ChangeMemberRoleResult ValidationFailed(IReadOnlyList<string> errors) =>
        new(ChangeMemberRoleOutcome.ValidationFailed, errors);

    public static ChangeMemberRoleResult LastOwner() =>
        new(ChangeMemberRoleOutcome.LastOwner, ["A workspace must always have at least one Owner."]);
}

public enum RemoveMemberOutcome
{
    Success,
    NotFound,
    Forbidden,

    /// <summary>Removing this member would leave the workspace with no Owner.</summary>
    LastOwner,
}
