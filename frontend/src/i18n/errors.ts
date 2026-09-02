import { ApiError, ApiUnavailableError } from "@/lib/api/client";
import type { Dictionary } from "./dictionaries";

/**
 * Translates a caught error into safe, localized UI copy.
 *
 * This NEVER inspects `error.message`/`title`/`detail` (raw, always-English
 * backend prose) — only the stable `ApiError.code` and `ApiError.status`,
 * which are the values the rest of the app already branches control flow
 * on. An error whose code isn't one of the known stable codes below (an
 * unmapped/unexpected condition) falls back to a generic localized message
 * instead of leaking English backend prose into the Spanish UI.
 *
 * Known limitation: field-level validation errors from the API
 * (`ApiError.fieldErrors`) are English prose strings with no per-field
 * translation code yet. Callers must not render `fieldErrors` values
 * directly in the Spanish UI; use `localizeError` (keyed on `code`) for the
 * field's failure instead, and treat the underlying English string as a
 * this-is-known-not-yet-localizable gap tracked for future backend work
 * (a stable per-field error code from the API would let us localize this
 * precisely).
 */
export function localizeError(dict: Dictionary, error: unknown): string {
  if (error instanceof ApiUnavailableError) {
    return dict.common.apiUnavailable;
  }

  if (error instanceof ApiError) {
    if (error.code && error.code in dict.errors) {
      return dict.errors[error.code as keyof typeof dict.errors];
    }

    switch (error.status) {
      case 404:
        return dict.errors.not_found;
      case 403:
        return dict.errors.forbidden;
      case 401:
        return dict.errors.unauthorized;
      case 409:
        return dict.errors.conflict;
      case 422:
        return dict.errors.validation_error;
      default:
        return dict.errors.generic;
    }
  }

  return dict.errors.generic;
}
