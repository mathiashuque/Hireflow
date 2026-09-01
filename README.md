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

## License

This project is proprietary. Copying, redistribution, modification, or use
without prior written permission is prohibited. See [LICENSE](LICENSE).
