/**
 * Public site origin, used only for absolute SEO/metadata URLs (canonical links,
 * sitemap/robots entries, Open Graph/Twitter images, `metadataBase`). This is
 * configuration, not a credential, but it is deliberately server-only and kept
 * separate from `NEXT_PUBLIC_API_URL` (the API host) and `API_PROXY_TARGET` (the
 * Render proxy target) — neither of those is a safe stand-in for the public
 * website origin.
 *
 * Set `SITE_URL` to the exact Production frontend origin (for example
 * `https://hireflow.example.com`), with no path, query, or fragment. In any
 * non-development environment, an unset or malformed `SITE_URL` fails fast at
 * import time rather than silently deriving a canonical URL from an unstable
 * preview deployment or the API host. Local development and local production
 * builds may omit it and fall back to `http://localhost:3000`.
 */
function resolveSiteOrigin(): string {
  const raw = process.env.SITE_URL;
  const isDevelopment = process.env.NODE_ENV === "development";

  if (!raw) {
    if (isDevelopment) {
      return "http://localhost:3000";
    }
    throw new Error(
      "SITE_URL is not set. Set it to the exact public frontend origin (e.g. " +
        '"https://hireflow.example.com") with no path, query, or fragment. Local ' +
        "development may omit it to fall back to http://localhost:3000.",
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error(`SITE_URL must be an absolute URL, got "${raw}".`);
  }

  const isLocalhostDev = parsed.hostname === "localhost" && parsed.protocol === "http:";
  if (parsed.protocol !== "https:" && !(isDevelopment && isLocalhostDev)) {
    throw new Error(`SITE_URL must use https:, got "${raw}".`);
  }

  if (parsed.pathname !== "/" || parsed.search || parsed.hash) {
    throw new Error(`SITE_URL must be an origin with no path, query, or fragment, got "${raw}".`);
  }

  return raw.replace(/\/+$/, "");
}

let cachedOrigin: string | undefined;

/** The validated, absolute public site origin (no trailing slash). */
export function getSiteOrigin(): string {
  if (cachedOrigin === undefined) {
    cachedOrigin = resolveSiteOrigin();
  }
  return cachedOrigin;
}

/** Builds an absolute site URL from an app-relative path (must start with "/"). */
export function siteUrl(path: string): string {
  if (!path.startsWith("/")) {
    throw new Error(`siteUrl() expects a path starting with "/", got "${path}".`);
  }
  return `${getSiteOrigin()}${path}`;
}
