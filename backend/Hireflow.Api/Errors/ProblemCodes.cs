namespace Hireflow.Api.Errors;

/// <summary>
/// The complete catalog of stable, machine-readable <c>code</c> values Hireflow's API
/// puts on every problem-details response. These are a client contract: once published,
/// a code's meaning never changes and a code is never removed, only added. Frontend
/// control flow must branch on these values, never on <c>title</c>/<c>detail</c> prose.
/// </summary>
public static class ProblemCodes
{
    // General codes. Every problem response resolves to one of these when no more
    // specific domain code applies.
    public const string ValidationError = "validation_error";
    public const string Unauthorized = "unauthorized";
    public const string Forbidden = "forbidden";
    public const string NotFound = "not_found";
    public const string Conflict = "conflict";
    public const string Gone = "gone";
    public const string UnsupportedMediaType = "unsupported_media_type";
    public const string InternalError = "internal_error";

    // Auth-specific.
    public const string InvalidCredentials = "invalid_credentials";
    public const string EmailAlreadyRegistered = "email_already_registered";
    public const string CsrfTokenInvalid = "csrf_token_invalid";

    // Workspace/membership-specific.
    public const string WorkspaceSlugConflict = "workspace_slug_conflict";
    public const string LastOwner = "last_owner";

    // Invitation-specific.
    public const string InvitationAlreadyMember = "invitation_already_member";
    public const string InvitationDuplicate = "invitation_duplicate";
    public const string InvitationUnavailable = "invitation_unavailable";

    // Job opening-specific.
    public const string JobNotOpen = "job_not_open";
    public const string InvalidJobTransition = "invalid_job_transition";

    // Candidate-specific.
    public const string DuplicateCandidateEmail = "duplicate_candidate_email";
    public const string NoOpStageMove = "no_op_stage_move";

    // Shared across candidate/job optimistic-concurrency mutations.
    public const string StaleVersion = "stale_version";

    /// <summary>
    /// The fallback code for a problem response whose status was set without an explicit
    /// domain code — framework-owned paths such as cookie-auth <c>401</c>/<c>403</c>,
    /// unmatched routes, and unhandled exceptions. A controller that sets a more specific
    /// code always wins; this only fills the gap.
    /// </summary>
    public static string DefaultForStatus(int? status) => status switch
    {
        StatusCodes.Status400BadRequest => ValidationError,
        StatusCodes.Status401Unauthorized => Unauthorized,
        StatusCodes.Status403Forbidden => Forbidden,
        StatusCodes.Status404NotFound => NotFound,
        StatusCodes.Status409Conflict => Conflict,
        StatusCodes.Status410Gone => Gone,
        StatusCodes.Status415UnsupportedMediaType => UnsupportedMediaType,
        StatusCodes.Status500InternalServerError => InternalError,
        _ => InternalError,
    };
}
