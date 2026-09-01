# Hireflow

Hireflow is a small multi-tenant hiring tracker for teams. It provides isolated
workspaces for managing job openings, candidates, hiring stages, internal notes,
and recruiting activity, with tenant isolation and authorization enforced by the
backend.

## Stack

- ASP.NET Core Web API and .NET 10
- Entity Framework Core and PostgreSQL (planned)
- Next.js, React, TypeScript, and Tailwind CSS
- xUnit

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

## License

This project is proprietary. Copying, redistribution, modification, or use
without prior written permission is prohibited. See [LICENSE](LICENSE).
