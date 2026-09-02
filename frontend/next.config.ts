import type { NextConfig } from "next";

/**
 * Server/build-time only — deliberately not `NEXT_PUBLIC_`, so the Render API hostname
 * is never shipped to the browser bundle. Set in Vercel's Production environment to the
 * Render API's origin (e.g. `https://hireflow-api.onrender.com`); this is what the
 * `/api/:path*` rewrite below proxies to, keeping browser requests same-origin so the
 * auth/CSRF cookies stay on the Vercel host.
 */
const API_PROXY_TARGET = process.env.API_PROXY_TARGET;

function resolveProxyTarget(): string | undefined {
  if (!API_PROXY_TARGET) {
    return undefined;
  }

  // Fail the build rather than silently proxying somewhere unexpected: outside
  // Development this must be an absolute HTTPS origin with no path, so the rewrite
  // below can safely append "/api/:path*" without producing "/api/api/..." or a
  // duplicated trailing slash.
  if (process.env.NODE_ENV !== "development") {
    let parsed: URL;
    try {
      parsed = new URL(API_PROXY_TARGET);
    } catch {
      throw new Error(`API_PROXY_TARGET must be an absolute URL, got "${API_PROXY_TARGET}".`);
    }

    if (parsed.protocol !== "https:") {
      throw new Error(`API_PROXY_TARGET must use https:, got "${API_PROXY_TARGET}".`);
    }

    if (parsed.pathname !== "/" || parsed.search || parsed.hash) {
      throw new Error(
        `API_PROXY_TARGET must be an origin with no path, query, or fragment, got "${API_PROXY_TARGET}".`,
      );
    }
  }

  return API_PROXY_TARGET.replace(/\/+$/, "");
}

const proxyTarget = resolveProxyTarget();
const isVercelBuild = process.env.VERCEL === "1";

const nextConfig: NextConfig = {
  // The Docker image copies Next's standalone server, while Vercel packages the
  // application with its own build integration. Forcing standalone output there can
  // remove tracing files before Vercel's onBuildComplete hook reads them.
  ...(isVercelBuild ? {} : { output: "standalone" as const }),
  async rewrites() {
    if (!proxyTarget) {
      return [];
    }

    return [
      {
        source: "/api/:path*",
        destination: `${proxyTarget}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
