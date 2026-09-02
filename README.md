# Hireflow

A multi-tenant hiring tracker built to demonstrate production-grade backend
engineering: real tenant isolation, layered authorization, and API design that
takes security and correctness seriously — not just CRUD screens.

Teams create isolated **workspaces**, post job openings, and move candidates
through a hiring pipeline (Applied → Screening → Interview → Offer / Rejected)
with role-based permissions, stage history, and internal notes.

```text
Acme Inc. (workspace)
├── Backend Engineer
│   ├── Applied      — Alice, Bob
│   ├── Screening    — Charlie
│   ├── Interview
│   └── Offer
└── Product Designer
    ├── Applied
    ├── Screening
    └── Interview
```

## Why this project exists

Hireflow isn't trying to be a full ATS. It's a small, deliberately scoped
product used to showcase the parts of backend engineering that are easy to
fake and hard to get right:

- **Tenant isolation that actually holds.** Every tenant-owned query is scoped
  by workspace ID at the database boundary — never fetched globally and
  filtered afterward. Cross-tenant access attempts (guessed IDs, users from a
  different workspace) return the same non-enumerating `404` as a resource
  that doesn't exist, so an attacker can't even confirm another tenant's data
  exists.
- **Authorization enforced on the backend, always.** Roles (Owner, Recruiter,
  Interviewer) are checked server-side on every request; the frontend never
  makes an access decision on its own.
- **A consistent, secure API contract.** Every error — validation, auth,
  routing, unhandled exceptions — returns the same `application/problem+json`
  shape with a stable machine-readable error code and a trace ID for support,
  never a raw stack trace or internal detail.
- **Real-world correctness concerns**, not just happy paths: optimistic
  concurrency on edits (so two people editing the same candidate don't
  silently clobber each other), atomic multi-row writes for stage changes and
  history, and database-level constraints that back up application logic
  rather than replacing it.
- **Deployed like a real product**: containerized, health-checked, structured
  logging, and a documented production topology (Render + Neon + Vercel) with
  a same-origin proxy specifically designed to keep auth cookies secure across
  hosts.

## What it demonstrates

| Area | What's implemented |
| --- | --- |
| Multi-tenancy | Shared-database model with `WorkspaceId` scoping enforced at every query and via database foreign keys |
| Authentication | Cookie-based sessions (ASP.NET Core Identity), CSRF protection on every mutation |
| Authorization | Per-membership roles (Owner / Recruiter / Interviewer), enforced server-side |
| API design | Consistent problem-details error contract, OpenAPI docs, versioned error codes |
| Data integrity | Optimistic concurrency (`xmin`), atomic multi-table writes, composite foreign keys for tenant safety |
| Testing | xUnit with Testcontainers-backed integration tests against real PostgreSQL, including cross-tenant access tests |
| Operations | Health/readiness checks, structured JSON logging with request correlation IDs, fail-fast production config validation |
| Deployment | Dockerized services, CI on every PR, production on Render (API) + Neon (Postgres) + Vercel (Next.js frontend) |

## Stack

- **Backend:** ASP.NET Core Web API (.NET 10), Entity Framework Core, PostgreSQL, ASP.NET Core Identity
- **Frontend:** Next.js, React, TypeScript, Tailwind CSS
- **Testing:** xUnit, Testcontainers
- **Infrastructure:** Docker, GitHub Actions CI, Render, Neon, Vercel

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

Dependency direction is `Api -> Application <- Infrastructure`, with `Domain`
depended on by everything and depending on nothing — a modular monolith, not a
pile of speculative layers.

## Try it locally

```bash
git clone <repo-url>
cd Hireflow
docker compose up -d --build
```

Then open `http://localhost:3000`, sign up, create a workspace, and post a
job. See [docs/ENGINEERING.md](docs/ENGINEERING.md#local-development) for
database options, migrations, and a scripted multi-role demo seed.

## Full documentation

The complete technical reference — authentication and CSRF details, the API
error contract, every endpoint, tenant-isolation guarantees, health/logging
behavior, and the production deployment runbook — lives in
[docs/ENGINEERING.md](docs/ENGINEERING.md).

## License

This project is proprietary. Copying, redistribution, modification, or use
without prior written permission is prohibited. See [LICENSE](LICENSE).
