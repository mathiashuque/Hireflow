# Hireflow — Engineering Reference

Detailed technical documentation for running, testing, and operating Hireflow.
For the project pitch and a tour of what it demonstrates, see the top-level
[README](../README.md).

## Local development

Docker Compose runs the frontend, API, and PostgreSQL. With no configuration,
development automatically uses the local PostgreSQL container:

```bash
docker compose up -d --build
```

The local database is only a development fallback. Production has no default
connection string and fails at startup unless one is configured.

### Use NeonDB

1. Copy the default environment template:

   ```bash
   cp .env.example .env
   ```

2. Replace `DATABASE_CONNECTION_STRING` with the connection details from your
   Neon dashboard. Keep `SSL Mode=Require`. A pooled endpoint is suitable for the
   application; prefer a direct endpoint for EF Core migrations.
3. Start the application. The configured Neon connection string overrides the
   local fallback automatically:

   ```bash
   docker compose up --build
   ```

### Use local PostgreSQL

No `.env` file is required. Remove or unset `DATABASE_CONNECTION_STRING`, then
start Compose normally:

```bash
docker compose up -d --build
```

The optional `.env.local.example` shows the fallback credentials if you want to
customize them. Switching between databases only requires setting or removing
`DATABASE_CONNECTION_STRING`; no code changes are required.

Services are available at:

- Frontend: `http://localhost:3000`
- API: `http://localhost:8080`
- OpenAPI document: `http://localhost:8080/openapi/v1.json` in development
- Local PostgreSQL: `localhost:5432`

Stop the stack with `docker compose down`. To also remove local PostgreSQL data,
run `docker compose down --volumes`.

The API only accepts credentialed requests from the origin(s) listed in
`Cors:AllowedOrigins` (`FRONTEND_ORIGIN` in Compose/environment files). Update
`FRONTEND_ORIGIN` if you serve the frontend from somewhere other than
`http://localhost:3000`; a wildcard origin is intentionally not supported for
credentialed requests.

### Run without Docker

Requirements: .NET 10 SDK, Node.js 20.9 or newer, and a reachable Neon or local
PostgreSQL database. Set the standard .NET connection-string environment variable
before starting the API:

```bash
export ConnectionStrings__Database="Host=...;Database=...;Username=...;Password=...;SSL Mode=Require"
dotnet run --project backend/Hireflow.Api

cd frontend
npm install
npm run dev
```

## Database migrations

Migrations are never applied automatically at startup, in any environment. Apply
them explicitly against whichever database `ConnectionStrings__Database` (or
`appsettings.Development.json`) currently points at:

```bash
# One-time: install the EF Core CLI tool if you don't already have it.
dotnet tool install --global dotnet-ef

# Create a new migration after changing the EF Core model.
dotnet ef migrations add <Name> \
  --project backend/Hireflow.Infrastructure \
  --startup-project backend/Hireflow.Api \
  --output-dir Persistence/Migrations

# Apply pending migrations (local PostgreSQL or Neon, depending on configuration).
dotnet ef database update \
  --project backend/Hireflow.Infrastructure \
  --startup-project backend/Hireflow.Api
```

Both commands read the same connection string as the running app. Against the
Docker Compose stack, the API listens inside the Compose network, but PostgreSQL
is also published on `localhost:5432`, so `appsettings.Development.json`'s default
connection string works for `dotnet ef database update` from the host. Against
Neon, prefer a direct (non-pooled) endpoint for migrations, as noted in
`.env.example`.

## Authentication

Accounts are ASP.NET Core Identity users stored in PostgreSQL and authenticated
with an HTTP-only session cookie (`Hireflow.Auth`); there is no token to store in
the frontend. The API exposes:

- `POST /api/auth/register` — email, password, and display name
- `POST /api/auth/login` — email and password
- `POST /api/auth/logout` — requires authentication
- `GET /api/auth/me` — requires authentication; returns the current account
- `GET /api/auth/csrf` — primes the CSRF cookie pair (see below)

Unauthenticated or forbidden requests return `401`/`403` JSON responses; the API
never redirects to an HTML login page.

### CSRF

`register`, `login`, and `logout` are state-changing and cookie-authenticated, so
they require a CSRF proof: call `GET /api/auth/csrf` first, read the non-HttpOnly
`XSRF-TOKEN` cookie it sets, and send that value back as the `X-XSRF-TOKEN` header
on the mutating request. The frontend's API client
(`frontend/src/lib/api/client.ts`) does this automatically for every mutating
call — fetch a fresh token before each one, since a token is bound to the
caller's authenticated identity at issuance and stops validating once that
identity changes (e.g. right after login or logout).

### End-to-end dev flow

With the stack running (`docker compose up -d --build`) and migrations applied:

1. Open `http://localhost:3000` and choose **Sign up**, or go directly to
   `http://localhost:3000/register`.
2. Register an account; you land on `/dashboard` already signed in.
3. Reload the page — the session is restored via `GET /api/auth/me`.
4. Use **Log out**, then log back in at `/login` with the same credentials.

### Seeding multi-role dev accounts

`scripts/seed-dev-accounts.sh` drives the real HTTP API (register, CSRF, workspace
creation, invitations, job creation) to build a disposable Owner/Recruiter/Interviewer
fixture for manual testing. Run it once against a fresh database, after migrations are
applied:

```bash
docker compose up -d --build
dotnet ef database update --project backend/Hireflow.Infrastructure --startup-project backend/Hireflow.Api
./scripts/seed-dev-accounts.sh
```

It creates `owner@example.com`, `recruiter@example.com`, and `interviewer@example.com`
(all with the dev-only password printed by the script), a workspace they share, an Open
job (candidate intake enabled), and a Draft job (intake disabled). Requires `curl` and
`jq`. Not idempotent — rerun it only against a database you've reset.

## API errors

Every API failure — however it originates — returns `application/problem+json` with
the same shape: standard `type`/`title`/`status`/`detail` (never exception messages,
stack traces, SQL/provider details, or connection strings), a stable machine-readable
`code`, a `traceId` correlating the response to server-side logs, and field-keyed
`errors` for validation failures. This holds for hand-built controller responses,
`[ApiController]` model-binding/data-annotation failures, cookie-auth `401`/`403`
(no HTML login redirect), an unmatched route, a missing/invalid CSRF token, and an
unhandled exception alike — a single central customizer
(`Hireflow.Api/Errors/HireflowProblemDetailsOptions.cs`) and `app.UseStatusCodePages()`
converge every path onto this contract, so no individual response can drift from it.

`code` is the client contract: frontend control flow branches on it (see
`ApiError.hasCode(...)` in `frontend/src/lib/api/client.ts`), never on `title`/`detail`
prose, which may be reworded or localized without breaking anything. General codes:
`validation_error`, `unauthorized`, `forbidden`, `not_found`, `conflict`, `gone`,
`unsupported_media_type`, `internal_error`. Domain-specific codes layer on top where the
frontend needs to distinguish behavior within the same status, e.g. `stale_version` and
`no_op_stage_move` (both `409` on a candidate stage move), or `job_not_open` and
`duplicate_candidate_email` (both `409` on candidate creation) — see
`Hireflow.Api/Errors/ProblemCodes.cs` for the complete, versioned catalog.

A missing/inaccessible workspace, job, or candidate always returns the same `404`
shape, `code: "not_found"`, and generic detail regardless of which case actually
occurred — tenant non-enumeration holds through the error contract, not just the
success path. A production `500` never includes `detail`; diagnose it server-side via
the logged `traceId`.

## API documentation

In Development only, the API serves its generated OpenAPI 3.1 document at
`/openapi/v1.json` and an interactive reference (via [Scalar](https://scalar.com)) at
`/api-docs`. Neither route is registered outside Development — there is no
Production-time OpenAPI/reference exposure to opt out of, and enabling one would be a
deliberate, separate configuration change. The document covers every controller
endpoint with a unique `operationId`, a tag per functional area (System,
Authentication, Workspaces, Members, Invitations, Jobs, Candidates), the real cookie
authentication scheme (`CookieAuth`, never a fictitious bearer/JWT scheme), and the
`X-XSRF-TOKEN` header requirement on every state-changing operation.

The reference's "Try it" can exercise anonymous `GET`s directly, but it cannot supply
your session or CSRF token on its own — the auth cookie is intentionally not
JavaScript-readable, and the CSRF cookie is scoped to same-origin frontend requests.
Authenticate with a real cookie-aware client instead: sign in through the frontend and
use its browser session (with matching dev tooling to inspect requests), or drive the
API directly with `backend/Hireflow.Api/Hireflow.Api.http` (VS Code's REST Client
extension or any compatible tool), which documents the manual CSRF-priming sequence
step by step.

## Operations

### Health and readiness

Three anonymous, read-only, bounded endpoints:

- `GET /api/health/live` — process liveness only. Never touches PostgreSQL, so it
  stays `200` through a transient database outage; a load balancer/orchestrator
  should use this only to decide whether to restart the process, never to route
  traffic.
- `GET /api/health/ready` — readiness, including a PostgreSQL connectivity check
  (a bounded `SELECT`-free `CanConnectAsync`, never migrations/schema/writes)
  through the same connection string the app uses. `200` when reachable, `503`
  when not.
- `GET /api/health` — a compatibility alias for `/ready`, so an existing
  caller/check pointed at the old path keeps working.

Every response is the same small JSON shape and reveals no connection string,
hostname, database name/user, or exception text — e.g.
`{"status":"Healthy","checks":{"database":"Healthy"}}`. The database check's
timeout is `Health:DatabaseTimeoutSeconds` (default `5`; must be a positive
number — invalid values fail startup, see below).

```bash
curl http://localhost:8080/api/health/live
curl http://localhost:8080/api/health/ready
```

### Structured logging and correlation

Development logs stay the default human-readable console. Outside Development,
logging switches to structured JSON (`ILoggingBuilder.AddJsonConsole`) so a log
aggregator can parse fields without a third-party logging platform. Levels are
configurable the normal ASP.NET Core way — `Logging__LogLevel__*` environment
variables or `appsettings.{Environment}.json`.

Every request gets one correlation ID, established before routing/auth so it
covers every response including framework-owned ones (a cookie-auth `401`, an
unmatched route). That ID becomes both the response's `X-Request-ID` header and
the exact value in a problem response's `traceId` field, so a client-reported
issue and server logs can always be tied together. A caller may supply their own
`X-Request-ID`; it's honored only if it's a short, safe token (letters, digits,
`.`, `_`, `-`, ≤128 characters) — anything else (oversized, containing control
characters, etc.) is replaced with the server's own generated ID rather than
trusted as-is. After authentication/routing, the log scope additionally carries
the caller's `UserId` and the route's `WorkspaceId` when safely parseable, so
per-request log lines don't need to repeat that context — a missing/malformed
value is simply omitted, never a request failure.

Important events already logged with safe structured IDs (never candidate PII,
note content, passwords, tokens, or full overview payloads): authentication
failures, workspace creation, invitations, member role changes, job status
changes, candidate creation/stage movement, note creation, and unhandled
exceptions (logged once, server-side, with correlation context — the client
still only ever sees the safe `internal_error` problem response). EF Core's own
command logging is set to `Warning` by default specifically because invitation
acceptance embeds a bearer token in its route (`POST /api/invitations/{token}/accept`)
— the framework's built-in hosting-diagnostics log scope carries that raw path,
and EF's per-command `Information` logging would otherwise pull it into the
log stream; keeping `Microsoft.AspNetCore`/`Microsoft.EntityFrameworkCore` at
`Warning` (the shipped default) is what keeps it out.

### Production configuration

Production fails fast at startup, with a clear non-secret message, rather than
silently running with a broken/insecure default:

| Setting | Required in Production | Failure if missing/invalid |
| --- | --- | --- |
| `ConnectionStrings__Database` | Yes | Accepts Npgsql key/value syntax or a `postgresql://` URI; throws immediately when missing or malformed |
| `Cors__AllowedOrigins__0` (at least one) | Yes | Throws immediately — never allows a wildcard origin |
| `WorkspaceInvitations__LifetimeDays` | No (defaults to `7`) | Startup fails if explicitly set to `0` or negative |
| `Health__DatabaseTimeoutSeconds` | No (defaults to `5`) | Startup fails if explicitly set to `0` or negative |

Development keeps its documented local PostgreSQL/CORS fallback
(`appsettings.Development.json`); Production must supply real values through
environment/platform secret configuration, never a committed file. Secrets live
exclusively there — `.env.example`/`.env.local.example` contain placeholders
only, and `.gitignore` excludes real `.env*` files.

### Containers

Both images build multi-stage, run as a non-root user (`$APP_UID` for the API,
`node` for the frontend), and declare a `HEALTHCHECK` using `wget` (already
present in both Alpine base images' busybox — no extra package installed): the
API checks `/api/health/ready`, the frontend checks that its HTTP server
responds. In Compose, the frontend now waits for the API's healthcheck
(`depends_on: api: condition: service_healthy`), and the API still waits for a
healthy local PostgreSQL the same way. Both services have a 10-second
`stop_grace_period` for local development.

```bash
docker compose up -d --build
docker compose ps                 # every service should report "healthy"
docker compose stop postgres      # readiness should now report 503; liveness stays 200
docker compose start postgres     # readiness recovers once PostgreSQL is reachable again
docker compose down               # stops all three containers gracefully
```

### CI

`.github/workflows/CI.yml` runs on pull requests targeting `develop` and `main`,
on pushes to either branch, and on manual dispatch, with least-privilege
permissions and per-ref concurrency cancellation. Three jobs, all with bounded
timeouts:

- **Backend** — restore/build/test (the test suite's disposable Testcontainers
  PostgreSQL applies every migration and exercises the readiness health check),
  then `dotnet ef migrations has-pending-model-changes` to fail the build if an
  entity/mapping change wasn't captured in a migration.
- **Frontend** — `npm ci`, lint, build.
- **Docker build validation** — builds both the API and frontend production
  images to prove they still build; never pushes an image and requires no
  registry credentials.

Nothing in CI contacts Neon or requires production credentials.

### Production deployment (Render + Neon + Vercel)

Production is Render (Dockerized API), Neon (PostgreSQL), and Vercel (Next.js
frontend), deployed only from `main`. `develop` is never deployed.

**Same-origin proxy, and why.** Vercel serves the frontend and proxies
`/api/:path*` to the Render API (`frontend/next.config.ts`'s `rewrites()`, driven
by the server-only `API_PROXY_TARGET` env var — never `NEXT_PUBLIC_`, so the
Render hostname never reaches the browser bundle). The browser only ever talks
to the Vercel origin. This isn't a style preference: a direct browser→Render
call would be cross-site, which forces `SameSite=None` cookies and — critically —
would put the readable `XSRF-TOKEN` cookie on the Render host, where the
frontend's JavaScript can't read it to echo back as `X-XSRF-TOKEN`. Proxying
same-origin keeps every cookie on the Vercel host instead. `getApiBaseUrl()`
(`frontend/src/lib/api/config.ts`) reflects this: with `NEXT_PUBLIC_API_URL`
unset (the Production default) it returns `""`, so requests resolve to
same-origin paths like `/api/auth/me`. Local development keeps setting
`NEXT_PUBLIC_API_URL=http://localhost:8080` to call the API directly, bypassing
the proxy entirely.

**Render Blueprint.** The root `render.yaml` defines a single Docker web
service, `hireflow-api`, building `backend/Hireflow.Api/Dockerfile` with the
repo root as context, deploying from `main`, health-checked at
`/api/health/ready`. It declares `ASPNETCORE_HTTP_PORTS`/`PORT=8080` to match
the image's `EXPOSE 8080`, and non-secret production settings
(`WorkspaceInvitations__LifetimeDays`, `Health__DatabaseTimeoutSeconds`, log
levels). The API processes Render's forwarded HTTPS scheme before antiforgery so
Secure auth/CSRF cookies work across Render's TLS-terminating proxy. Two values
are intentionally *not* in the file (`sync: false` —
Render prompts for them once in its dashboard on Blueprint creation, then
they're edited there): `ConnectionStrings__Database` (Neon's **pooled**
connection string) and `Cors__AllowedOrigins__0` (the exact Vercel Production
origin). There is no Render-managed database — Neon is the only Production
datastore. Validate the Blueprint against Render's current schema (dashboard
preview/validation) before the first deploy; provider schemas change.

**Neon.** A dedicated Production project, never the local/test database. The API
accepts Neon's copied `postgresql://` URI directly (including its `sslmode` and
`channel_binding` query parameters), as well as Npgsql's key/value format. Two
connection strings from the same project: the **direct** endpoint, used only
for running migrations from a trusted local/one-off environment, and the
**pooled** endpoint, used by the running API (`ConnectionStrings__Database` on
Render). Both require TLS (`SSL Mode=Require`). The pooled string is stored
only in Render's secret environment; the direct string is stored only wherever
migrations are actually run — neither is committed (see `.env.example`'s
Production reference section, which documents the shape without real values).

**Migrations stay explicit.** The API never calls `Database.Migrate()` at
startup (Production or otherwise) — see [Database migrations](#database-migrations).
Before/alongside a Render deploy, apply migrations against Neon's **direct**
endpoint from a trusted environment:

```bash
cd backend
ConnectionStrings__Database="<neon-direct-connection-string>" \
  dotnet ef database update --project Hireflow.Infrastructure --startup-project Hireflow.Api
```

If the Render plan in use supports `preDeployCommand`, a pre-deploy migration
step can replace the manual gate above — only wire it in after verifying it
actually runs once before the new web version on that plan. Until then, this
is a mandatory manual release gate before every Render deploy that includes a
migration.

**Vercel.** Project root `frontend`, framework preset Next.js, Production
branch `main`. Production env vars: `API_PROXY_TARGET=https://<render-service>.onrender.com`
(server-side only) and no Production `NEXT_PUBLIC_API_URL` (leaving it unset is
what enables the same-origin proxy path). Preview deployments must not carry
`API_PROXY_TARGET` pointed at Production — they should have no Production API
access by default, since Render CORS only allows the one Production origin
anyway. Also set `SITE_URL` to the exact Production frontend origin (e.g.
`https://hireflow.example.com`, no path/query/fragment) — see **SEO, indexing,
and brand assets** below.

**SEO, indexing, and brand assets.** `SITE_URL` (`frontend/src/lib/seo/site-origin.ts`)
is the one source of truth for the public frontend origin used in absolute SEO
URLs — `metadataBase`, canonical/hreflang links, `robots.txt`'s `Sitemap` line,
`sitemap.xml` entries, and Open Graph/Twitter image URLs. It is deliberately
separate from `NEXT_PUBLIC_API_URL` (the API host) and `API_PROXY_TARGET` (the
Render proxy target) — neither is a safe stand-in for the public website
origin, and Production canonical URLs are never derived from an API host or an
unstable preview-deployment URL. Only a real Vercel Production build
(`VERCEL_ENV=production`, set automatically by Vercel) requires it — an unset
or malformed `SITE_URL` there fails the build fast rather than silently
falling back. Every other context — local development, CI, local production
builds, the frontend Docker image, Vercel previews — may omit it and falls
back to `http://localhost:3000`; `next build` always runs with
`NODE_ENV=production`, so `NODE_ENV` alone can't tell a real Production
deploy apart from CI or Docker build validation.

Indexing policy: only the localized marketing landing pages (`/en`, `/es`) are
indexable and listed in `/sitemap.xml`, with reciprocal `hreflang` alternates
and an `x-default` pointing at `/en` (the repository default locale). Every
authenticated or transactional route — `/[lang]/login`, `/[lang]/register`,
`/[lang]/dashboard`, all `/[lang]/workspaces/**` routes, and especially
`/[lang]/invitations/[token]` (which carries a sensitive, single-use token in
its URL) — carries explicit `noindex, nofollow` metadata via nested layouts
under `frontend/src/app/[lang]` and is disallowed in `/robots.txt`. Robots
exclusion is a crawler courtesy, not an access-control mechanism; every one of
those routes remains independently authenticated/authorized server-side.

Branded favicon/app icons, the Apple touch icon, and the shared Open Graph/
Twitter card are generated from the funnel mark in
`frontend/src/components/BrandMark.tsx` via Next's `icon`/`apple-icon`/
`opengraph-image`/`twitter-image` file conventions
(`frontend/src/app/{icon,icon1,icon2,apple-icon,opengraph-image,twitter-image}.tsx`),
so there are no generated binary assets to keep in sync by hand. The proxy
(`frontend/src/proxy.ts`) explicitly skips these route names so metadata
assets are never locale-redirected.

**Release order.**

1. Reserve/create the Vercel project first, to learn its stable Production
   origin (needed for Render CORS below) — a deploy can be incomplete at this
   point.
2. Provision Neon; retain the direct and pooled connection strings securely.
3. Create the Render service from `render.yaml`; enter the pooled Neon string
   and the exact Vercel origin as its dashboard-supplied secrets.
4. Apply migrations via the direct Neon endpoint (above).
5. Confirm `/api/health/live` and `/api/health/ready` both return `200` on
   Render.
6. Set Vercel's `API_PROXY_TARGET` to the Render origin and deploy Production.
7. Run the full smoke/security checklist below.

**Rollback.** Both Render and Vercel keep prior deploys; redeploying the
previous successful build on either platform is the rollback path (from each
platform's deploy history/dashboard). Applied migrations are not
automatically reversed — only roll one back if a reviewed, tested backward
migration exists for it.

**Production smoke checklist**, run with disposable test accounts after every
deploy that touches auth, CORS, or the proxy:

- Register, reload the session, log out, log in, create a workspace, create a
  job, create/move a candidate, add a note, load the overview — all through
  the deployed Vercel origin, confirming in browser devtools that network
  requests target the Vercel origin (never the Render origin directly) and
  that cookies are present.
- An unrelated `Origin` is rejected by CORS; a request missing the CSRF header
  on a mutation is rejected; an anonymous request to a protected route is
  rejected; a guessed cross-tenant resource ID returns a non-enumerating
  `404`; invalid input returns `validation_error`; a stale concurrency token
  returns the `stale_version` conflict — each with the expected status and
  problem `code`, never a raw exception.
- Render logs stay structured and free of secrets, raw invitation tokens, note
  content, or candidate PII.
- OpenAPI/Scalar remain unavailable in Production (`/openapi`, `/scalar`).

## Workspaces

A workspace is Hireflow's tenant: job openings, candidates, and hiring activity
(added in later slices) all belong to exactly one workspace. Every workspace read
or write is checked against the caller's membership on the backend — the frontend
never decides access on its own. An authenticated user who is not a member of a
requested workspace receives the same `404` as a nonexistent workspace, so
workspace existence is never observable across the tenant boundary.

Roles, assigned per membership rather than as a global account role:

- **Owner** — full administrative control: invites, revokes invitations, changes
  member roles (including promoting another member to Owner), and removes
  members. Every workspace always has at least one Owner; the backend rejects any
  role change or removal that would leave it without one, and a sole Owner cannot
  demote or remove themselves. Only granted by creating the workspace or being
  promoted by an existing Owner — never through an invitation.
- **Recruiter** and **Interviewer** — the two roles an invitation can grant. No
  administrative permissions in this slice; reserved for future job/candidate
  features.

Endpoints (all require authentication):

- `POST /api/workspaces` — create a workspace from a required name and optional
  slug; the caller becomes its sole Owner in the same transaction as the
  workspace row. A slug collision (from an explicit slug or one derived from the
  name) is resolved with a distinct suffixed slug rather than failing or
  overwriting the existing workspace.
- `GET /api/workspaces` — the caller's workspaces, with their role in each,
  ordered by name then id.
- `GET /api/workspaces/{workspaceId}` — a workspace's detail, including the
  caller's role. `404` if it doesn't exist or the caller isn't a member.
- `GET /api/workspaces/{workspaceId}/members` — a workspace's members (user id,
  display name, role, joined timestamp), ordered by joined time then user id.
  Same non-enumerating `404` as above for a nonmember.
- `PATCH /api/workspaces/{workspaceId}/members/{userId}/role` — Owner only;
  changes a member's role. `409` if it would leave the workspace without an
  Owner.
- `DELETE /api/workspaces/{workspaceId}/members/{userId}` — Owner only; removes
  a member (their Identity account is untouched). Same `409` last-Owner
  protection as above.
- `GET /api/workspaces/{workspaceId}/overview` — any member; the recruiting
  overview read model described below.

`POST /api/workspaces` and the two member-management endpoints are state-changing
and cookie-authenticated, so they require the same CSRF proof described above. A
member who is not an Owner receives `403` from the two management endpoints; a
caller who isn't a member of the workspace at all gets the same non-enumerating
`404` used everywhere else.

## Invitations

Owners invite people to a workspace by email; there is no email delivery in this
slice; the Owner copies a one-time link and sends it themselves. An invitation
grants Recruiter or Interviewer — never Owner. It expires after 7 days by default
(`WorkspaceInvitations:LifetimeDays` in configuration) and is single-use: accepting
it atomically creates the membership and consumes the invitation, so a replayed
link or a second acceptance attempt fails.

The raw invitation token is returned exactly once, in the response to
`POST .../invitations`. It is never stored (only a non-recoverable hash is), never
included in the pending-invitations list, and never logged.

Endpoints:

- `POST /api/workspaces/{workspaceId}/invitations` — Owner only; body is `email`
  and `role` (`Recruiter` or `Interviewer`). Rejects an email that already
  belongs to a member, and rejects a second active invitation for the same email
  (an invitation that expired unconsumed is superseded by a new one rather than
  blocking it).
- `GET /api/workspaces/{workspaceId}/invitations` — Owner only; lists pending
  (not yet accepted or revoked) invitations, without tokens.
- `DELETE /api/workspaces/{workspaceId}/invitations/{invitationId}` — Owner only;
  revokes a pending invitation.
- `POST /api/invitations/{token}/accept` — any authenticated account whose email
  matches the invitation. Scoped to the token itself, not to a workspace route.
  Every failure mode (invalid, expired, revoked, already used, or a mismatched
  account) returns the same generic response, so a caller can never learn
  anything about an invitation they can't already use.

All four endpoints are cookie-authenticated; the three that mutate state also
require the CSRF proof.

## Job openings

A job opening always belongs to exactly one workspace; every read and write is
scoped by that workspace's ID (and, for a specific job, its own ID within that
workspace) at the database query, never fetched globally and checked afterward.

Permissions:

- **Owner** and **Recruiter** can create job openings, edit title/description,
  and change status.
- **Interviewer** can list and view jobs but gets `403` from every mutation.

Lifecycle: a new job starts as **Draft**. Valid transitions are
Draft → Open, Open → Closed, and Closed → Open (reopen); every other request,
including a no-op like Open → Open, is rejected rather than silently accepted.
`ClosedAt` is set on close and cleared on reopen; ordinary edits never touch it.

Endpoints (all require workspace membership; authentication alone is not enough):

- `POST /api/workspaces/{workspaceId}/jobs` — Owner/Recruiter; creates a Draft
  job from a required title and optional plain-text description.
- `GET /api/workspaces/{workspaceId}/jobs` — any member; supports an optional
  `?status=Draft|Open|Closed` filter, ordered by most recently updated then ID.
- `GET /api/workspaces/{workspaceId}/jobs/{jobId}` — any member.
- `PATCH /api/workspaces/{workspaceId}/jobs/{jobId}` — Owner/Recruiter; edits
  title/description.
- `PATCH /api/workspaces/{workspaceId}/jobs/{jobId}/status` — Owner/Recruiter;
  applies a status transition.

The two mutation endpoints require a `version` field, echoed back from the job's
last-read response. It's backed by PostgreSQL's `xmin` system column rather than
a hand-maintained counter, so any concurrent edit changes it automatically. A
stale `version` is rejected with `409` instead of silently overwriting a newer
change; the client is expected to reload the job and retry.

## Candidates

A candidate always belongs to exactly one job opening, which always belongs to
exactly one workspace; every read and write is scoped by workspace ID plus job
or candidate ID at the database query. The database itself enforces that a
candidate's job belongs to the same workspace, via a composite foreign key on
`(WorkspaceId, JobOpeningId)` against a matching alternate key on `JobOpening`
— not only an application-level check.

Permissions:

- **Owner** and **Recruiter** can add candidates to an **Open** job, edit
  name/email on any candidate regardless of the job's current status, and move
  a candidate between stages regardless of the job's current status.
- **Interviewer** can list and view candidates and their stage history but
  gets `403` from every mutation, including stage moves.

A candidate can only be added while its job is **Open**; adding to a Draft or
Closed job returns a `409` domain conflict. New candidates always start in the
**Applied** stage — the create/edit contracts never accept a caller-selected
stage. The predefined stages are Applied, Screening, Interview, Offer, and
Rejected.

Email uniqueness is enforced per job (case-insensitive, using the same
normalization as Identity account emails) via a PostgreSQL unique index on
`(WorkspaceId, JobOpeningId, NormalizedEmail)`. The same person may appear in a
different job or a different workspace. The constraint is authoritative under
concurrent requests: a race that both pass the application-level duplicate
check is still caught by the database and translated into a `409`, so at most
one candidate is ever persisted.

Endpoints (all require workspace membership; authentication alone is not enough):

- `POST /api/workspaces/{workspaceId}/jobs/{jobId}/candidates` — Owner/Recruiter;
  adds a candidate to an Open job.
- `GET /api/workspaces/{workspaceId}/jobs/{jobId}/candidates` — any member;
  the hiring board's data source, supporting an optional
  `?stage=Applied|Screening|Interview|Offer|Rejected` filter, ordered by most
  recently updated then ID.
- `GET /api/workspaces/{workspaceId}/candidates/{candidateId}` — any member.
- `PATCH /api/workspaces/{workspaceId}/candidates/{candidateId}` — Owner/Recruiter;
  edits name/email using the same `xmin`-backed optimistic-concurrency `version`
  field as job openings. Stage, job, workspace, creator, and creation time cannot
  be changed through this contract.
- `PATCH /api/workspaces/{workspaceId}/candidates/{candidateId}/stage` —
  Owner/Recruiter; moves a candidate using `{ stage, version }` and returns the
  updated candidate.
- `GET /api/workspaces/{workspaceId}/candidates/{candidateId}/history` — any
  member; returns that candidate's immutable stage history, newest first.
- `POST /api/workspaces/{workspaceId}/candidates/{candidateId}/notes` — any
  member, including Interviewer; adds a plain-text internal note.
- `GET /api/workspaces/{workspaceId}/candidates/{candidateId}/notes` — any
  member, including Interviewer; returns that candidate's internal notes,
  oldest first.

Candidate name/email are treated as personal data: they are never written to
routine application logs, and a guessed or cross-tenant workspace/job/candidate
ID returns the same non-enumerating `404` as a nonexistent resource.

### Stage movement and history

Any predefined stage may move to any other *different* predefined stage,
including backward corrections and recovery out of Rejected — the portfolio
pipeline is intentionally flexible rather than a strict funnel. A no-op move to
the candidate's current stage is rejected as a `409` domain conflict, and an
unrecognized stage name is a `400` validation error. Stage movement works
regardless of whether the candidate's job is currently Draft, Open, or Closed,
so teams can finish or correct a hiring process after a job closes; a job's
status only gates adding *new* candidates, never moving existing ones.

Every successful move atomically updates `Candidate.Stage`/`UpdatedAt` and
inserts exactly one `CandidateStageHistory` row in the same `SaveChanges` unit
— neither half ever persists alone. History rows are immutable, append-only
audit facts: there is no update/delete endpoint, and initial creation into
Applied is never recorded or backfilled as a history event. History for an
existing or newly created Applied candidate starts empty and shows "No stage
changes yet" until its first real move.

Stage moves use the same `xmin`-backed `version` field, request contract shape,
and `409` concurrency convention as candidate edits, and serialize against
edits to the same candidate row — a stale move or a stale edit is rejected
without changing anything, so at most one of a racing edit/move pair ever wins.
`ChangedByUserId` is always resolved from the authenticated caller, never from
the request body; a history entry's display name is resolved only for verified
workspace members reading their own workspace's history, never disclosed to
nonmembers or cross-tenant guesses.

A `CandidateStageHistory` row is tenant-owned and enforced by a composite
foreign key against `(WorkspaceId, Id)` on `Candidate`, mirroring the
`Candidate` → `JobOpening` relationship, so the database itself rejects a
history row for a candidate in a different workspace.

### Hiring board

The job candidates page is a five-column board ordered Applied, Screening,
Interview, Offer, Rejected, backed by the same job-scoped candidate list
endpoint above (no separate board API). Every column is always rendered with a
count, even when empty. Owner/Recruiter move a candidate with an explicit
labeled stage select plus a Move button — an accessible, non-drag control that
is the only way to move a candidate in this slice; there is no drag-and-drop.
Interviewers see the same board read-only. A stage conflict (someone else moved
the candidate first) refreshes the board and explains what happened rather than
silently overwriting.

### Internal notes

Every current workspace member — including Interviewer, who cannot edit or
move candidates — can add and read plain-text internal notes on a candidate,
so the hiring team can capture interview feedback and recruiting context.
Notes are append-only: there is no edit or delete endpoint, `CandidateNote`
has no `UpdatedAt`, and its fields are immutable after creation. Content is
trimmed, must be 1–4,000 characters after trimming, and internal newlines are
preserved; HTML/Markdown is never interpreted — content is always rendered as
inert plain text, on both the API and the frontend. `AuthorUserId` and
`CreatedAt` are always resolved server-side from the authenticated caller and
clock, never accepted from the request body. Notes are listed oldest-first,
then by ID, reading as a discussion timeline, and are returned in full (no
pagination) at this portfolio scale.

A `CandidateNote` row is tenant-owned and enforced by the same composite
foreign key pattern as `CandidateStageHistory` — the database rejects a note
for a candidate in a different workspace. Removing a workspace member deletes
their membership only; their prior notes and attribution remain intact, and
the removal immediately blocks that former member from listing or adding
further notes (the standard non-enumerating `404` for nonmembers). Adding a
note never touches `Candidate.Stage`, `Candidate.UpdatedAt`, or its `xmin`
concurrency version, and never appends a stage-history row — notes and stage
history are separate concepts recorded independently. Note content is never
written to routine application logs or error responses.

## Workspace recruiting overview

`GET /api/workspaces/{workspaceId}/overview` powers `/workspaces/{workspaceId}`,
the workspace's home page, and is available to any current Owner, Recruiter, or
Interviewer. It is a read-only aggregation over existing job/candidate/history/
note rows — there is no separate analytics table, event log, or background
aggregation job; every call recomputes fresh, tenant-scoped results directly
from the same rows the rest of the product reads and writes.

**Metrics** — `jobCounts` (`Draft`/`Open`/`Closed`) and `candidateCounts`
(`Applied`/`Screening`/`Interview`/`Offer`/`Rejected`, plus `totalCandidates`)
always cover every predefined status/stage and exactly match the requested
workspace's rows; an empty workspace returns zeroed counts, never an error or
missing keys.

**Workload** — one row per non-Closed (Draft/Open) job with its total candidate
count and the same five-stage breakdown, ordered Open before Draft, then most
recently updated, then stable job ID. Closed jobs are excluded from workload
but remain in `jobCounts`; this slice does not paginate the workload list.

**Recent activity** — a bounded, best-effort feed, not a complete audit log. It
only reports facts the schema records directly, each as one of four kinds:
`JobCreated`, `CandidateAdded`, `CandidateStageChanged` (with previous/new
stage), and `CandidateNoteAdded`. Job status changes, candidate profile edits,
member/invitation administration, and logins are not tracked anywhere and are
never inferred or fabricated here. Ordering is newest first, tie-broken by
activity kind then source ID for a fully deterministic result. `activityLimit`
defaults to 20 and accepts 1–50; an out-of-range value is a `400` validation
problem. A note-added activity never includes note content or a preview, and no
activity includes candidate email — only candidate name, which is treated as
member-visible PII, not exposed to nonmembers, and never logged.

Every aggregate, workload row, and activity is queried with the requested
workspace ID as part of the query itself (never fetched globally and filtered
afterward), so cross-tenant jobs, candidates, history, or notes can never affect
the response. Nonmembers and former members get the same non-enumerating `404`
as a nonexistent workspace; anonymous callers get `401`.

On the frontend, `/workspaces/{workspaceId}` is the Overview page described
above. Member/invitation management (invite, role changes, removal, one-time
invitation links) moved to `/workspaces/{workspaceId}/members` with no
behavioral change. `WorkspaceNav` exposes Overview, Jobs, and Members with an
accessible current-page indication available to every role.
