# Hireflow

Hireflow is a small multi-tenant hiring tracker for teams. It provides isolated
workspaces for managing job openings, candidates, hiring stages, internal notes,
and recruiting activity, with tenant isolation and authorization enforced by the
backend.

## Stack

- ASP.NET Core Web API and .NET 10
- ASP.NET Core Identity, Entity Framework Core, and PostgreSQL
- Next.js, React, TypeScript, and Tailwind CSS
- xUnit, with Testcontainers-backed integration tests against real PostgreSQL

## Project structure

```text
backend/
  Hireflow.Api/             HTTP API and application entry point
  Hireflow.Application/     Use cases, contracts, and validation
  Hireflow.Domain/          Domain entities and rules
  Hireflow.Infrastructure/  Persistence and external services
  Hireflow.Tests/           Unit and integration tests
frontend/                   Next.js application
```

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

- **Owner** and **Recruiter** can add candidates to an **Open** job and edit
  name/email on any candidate regardless of the job's current status.
- **Interviewer** can list and view candidates but gets `403` from every
  mutation.

A candidate can only be added while its job is **Open**; adding to a Draft or
Closed job returns a `409` domain conflict. New candidates always start in the
**Applied** stage — the create/edit contracts never accept a caller-selected
stage. The predefined stages are Applied, Screening, Interview, Offer, and
Rejected; moving a candidate between stages is not implemented in this slice.

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
  supports an optional `?stage=Applied|Screening|Interview|Offer|Rejected`
  filter, ordered by most recently updated then ID.
- `GET /api/workspaces/{workspaceId}/candidates/{candidateId}` — any member.
- `PATCH /api/workspaces/{workspaceId}/candidates/{candidateId}` — Owner/Recruiter;
  edits name/email using the same `xmin`-backed optimistic-concurrency `version`
  field as job openings. Stage, job, workspace, creator, and creation time cannot
  be changed through this contract.

Candidate name/email are treated as personal data: they are never written to
routine application logs, and a guessed or cross-tenant workspace/job/candidate
ID returns the same non-enumerating `404` as a nonexistent resource.

## License

This project is proprietary. Copying, redistribution, modification, or use
without prior written permission is prohibited. See [LICENSE](LICENSE).
