# Hireflow frontend

Next.js (App Router) application for Hireflow. See the repository root
[README.md](../README.md) for a project overview and
[docs/ENGINEERING.md](../docs/ENGINEERING.md) for the full technical
reference, including local development, environment variables, and the
Render + Neon + Vercel production deployment.

## Local development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Checks

```bash
npm run lint
npm run build
```

## SEO and indexing scope

- Only the localized marketing landing pages (`/en`, `/es`) are indexable and
  listed in `/sitemap.xml`. Everything else — login, registration, the
  dashboard, `/workspaces/**`, and `/invitations/[token]` — emits explicit
  `noindex, nofollow` metadata and is disallowed in `/robots.txt`. Robots
  exclusion is a crawler courtesy only; it is never a substitute for backend
  authorization.
- Absolute SEO URLs (canonical links, sitemap/robots entries, social preview
  images) are built from the `SITE_URL` environment variable — the public
  frontend origin, not the API host or the Render proxy target. See
  `.env.example` and docs/ENGINEERING.md for the Production configuration
  contract.
