/**
 * Public API base URL, read from environment configuration. Never hardcode a backend
 * origin or embed credentials here; this file only resolves where requests go.
 */
export function getApiBaseUrl(): string {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL;

  if (!baseUrl) {
    throw new Error(
      "NEXT_PUBLIC_API_URL is not configured. Set it in your environment (see .env.local.example).",
    );
  }

  return baseUrl.replace(/\/+$/, "");
}
