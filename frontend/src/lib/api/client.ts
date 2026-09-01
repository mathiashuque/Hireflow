import { getApiBaseUrl } from "./config";

const CSRF_COOKIE_NAME = "XSRF-TOKEN";
const CSRF_HEADER_NAME = "X-XSRF-TOKEN";

/** A structured API failure, built from the backend's RFC 7807 problem details. */
export class ApiError extends Error {
  readonly status: number;
  readonly fieldErrors: Record<string, string[]>;

  constructor(status: number, message: string, fieldErrors: Record<string, string[]> = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.fieldErrors = fieldErrors;
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
  errors?: Record<string, string[]>;
};

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export async function apiRequest<TResponse>(
  path: string,
  init: { method: "GET" | "POST"; body?: unknown } = { method: "GET" },
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
    throw new ApiError(
      response.status,
      problem?.detail ?? problem?.title ?? "The request could not be completed.",
      problem?.errors ?? {},
    );
  }

  return payload as TResponse;
}
