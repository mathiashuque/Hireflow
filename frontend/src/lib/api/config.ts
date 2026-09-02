/**
 * Public API base URL, read from environment configuration. Never hardcode a backend
 * origin or embed credentials here; this file only resolves where requests go.
 *
 * When `NEXT_PUBLIC_API_URL` is unset (the Production default), requests target the
 * frontend's own origin — `getApiBaseUrl()` returns `""`, so `apiRequest` builds a
 * same-origin path such as `/api/auth/me`. The Next.js rewrite in `next.config.ts`
 * proxies that path to the Render API server-side, which is what keeps auth/CSRF
 * cookies same-site instead of scattering them across the Vercel and Render hosts.
 * Local development sets `NEXT_PUBLIC_API_URL=http://localhost:8080` explicitly (see
 * `.env.local.example`) to call the API directly, bypassing the proxy.
 */
export function getApiBaseUrl(): string {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL;

  return baseUrl ? baseUrl.replace(/\/+$/, "") : "";
}
