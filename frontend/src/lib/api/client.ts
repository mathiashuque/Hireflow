import { getApiBaseUrl } from "./config";

const CSRF_COOKIE_NAME = "XSRF-TOKEN";
const CSRF_HEADER_NAME = "X-XSRF-TOKEN";

/** The general problem codes every canonical error response resolves to when no more specific domain code applies. */
export type GeneralProblemCode =
  | "validation_error"
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "conflict"
  | "gone"
  | "unsupported_media_type"
  | "internal_error";

/**
 * A structured API failure, built from the backend's RFC 9457 problem details. `code` is
 * the stable, machine-readable value control flow should branch on — never `message`,
 * which is human-readable prose that may change independently. `code` is `null` for a
 * response this client couldn't parse as a canonical problem (an old/unexpected shape, a
 * non-JSON gateway error, etc.); treat a `null` code the same as an unrecognized one.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code: GeneralProblemCode | (string & {}) | null;
  readonly traceId: string | null;
  readonly fieldErrors: Record<string, string[]>;

  constructor(
    status: number,
    message: string,
    options: { code?: string | null; traceId?: string | null; fieldErrors?: Record<string, string[]> } = {},
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = options.code ?? null;
    this.traceId = options.traceId ?? null;
    this.fieldErrors = options.fieldErrors ?? {};
  }

  /** True when this error's code matches one of `codes`. Prefer this over status/message checks. */
  hasCode(...codes: string[]): boolean {
    return this.code !== null && codes.includes(this.code);
  }
}

/** Thrown when the API could not be reached at all (offline, backend down, CORS, etc.). */
export class ApiUnavailableError extends Error {
  constructor() {
    super("The Hireflow API is unavailable. Check your connection and try again.");
    this.name = "ApiUnavailableError";
  }
}

function readCookie(name: string): string | null {
  const match = document.cookie
    .split("; ")
    .find((entry) => entry.startsWith(`${name}=`));

  return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
}

/**
 * Fetches a fresh CSRF token pair before a state-changing request. A token is not
 * reusable indefinitely: it is bound to the caller's authenticated identity at
 * issuance, so a token minted before login/logout no longer validates afterward.
 */
async function primeCsrfToken(): Promise<string> {
  const response = await fetch(`${getApiBaseUrl()}/api/auth/csrf`, {
    method: "GET",
    credentials: "include",
  });

  if (!response.ok) {
    throw new ApiUnavailableError();
  }

  const token = readCookie(CSRF_COOKIE_NAME);
  if (!token) {
    throw new ApiUnavailableError();
  }

  return token;
}

type ProblemDetails = {
  title?: string;
  detail?: string;
  status?: number;
  code?: string;
  traceId?: string;
  errors?: Record<string, string[]>;
};

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export async function apiRequest<TResponse>(
  path: string,
  init: { method: "GET" | "POST" | "PATCH" | "DELETE"; body?: unknown } = { method: "GET" },
): Promise<TResponse | undefined> {
  const headers: HeadersInit = {};
  let requestBody: string | undefined;

  if (init.body !== undefined) {
    headers["Content-Type"] = "application/json";
    requestBody = JSON.stringify(init.body);
  }

  if (MUTATING_METHODS.has(init.method)) {
    headers[CSRF_HEADER_NAME] = await primeCsrfToken();
  }

  let response: Response;
  try {
    response = await fetch(`${getApiBaseUrl()}${path}`, {
      method: init.method,
      credentials: "include",
      headers,
      body: requestBody,
    });
  } catch {
    throw new ApiUnavailableError();
  }

  if (response.status === 204) {
    return undefined;
  }

  // The API returns both "application/json" and RFC 7807's "application/problem+json".
  const contentType = response.headers.get("Content-Type") ?? "";
  const payload = contentType.includes("json") ? await response.json() : undefined;

  if (!response.ok) {
    const problem = payload as ProblemDetails | undefined;
    throw new ApiError(response.status, problem?.detail ?? problem?.title ?? "The request could not be completed.", {
      code: problem?.code,
      traceId: problem?.traceId,
      fieldErrors: problem?.errors,
    });
  }

  return payload as TResponse;
}
