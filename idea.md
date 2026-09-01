# Project Idea — Multi-Tenant Hiring Tracker — Hireflow

## Overview

Build a small multi-tenant hiring management application for teams.

The product allows companies or teams to create isolated workspaces where members can manage job openings, candidates, hiring stages, notes, and recruiting activity.

The main purpose of this project is not to build a full Applicant Tracking System.

The main objective is to showcase strong backend engineering using **ASP.NET Core and the .NET ecosystem**, while keeping the product scope small enough to complete and polish as a portfolio project.

The frontend will be built with **Next.js and TypeScript**.

---

# Primary Goal

Demonstrate practical backend engineering skills with .NET, including:

* ASP.NET Core API design
* Entity Framework Core
* PostgreSQL
* Multi-tenancy
* Authentication
* Authorization
* Relational database modeling
* Dependency injection
* Validation
* Transactions
* Error handling
* Integration testing
* API documentation
* Docker
* Clean project structure

The project should prioritize **code quality, architecture, correctness, and security** over having many features.

---

# Product Concept

A company creates a workspace.

That workspace acts as a tenant.

Users can belong to one or multiple workspaces.

Inside each workspace, members can create job openings and manage candidates through a hiring pipeline.

Example:

```text
Acme Inc.
│
├── Backend Engineer
│   ├── Applied
│   │   ├── Alice
│   │   └── Bob
│   │
│   ├── Screening
│   │   └── Charlie
│   │
│   ├── Interview
│   └── Offer
│
└── Product Designer
    ├── Applied
    ├── Screening
    └── Interview
```

Every workspace must be fully isolated from every other workspace.

A user from Workspace A must never be able to access data belonging to Workspace B unless that user is also explicitly a member of Workspace B.

Tenant isolation is one of the core technical requirements of the project.

---

# Tech Stack

## Frontend

* Next.js
* TypeScript
* React
* TanStack Query or equivalent data-fetching solution
* Simple UI component library

The frontend should focus on presentation, routing, forms, and user interaction.

Business rules must remain in the backend.

---

## Backend

* .NET
* ASP.NET Core Web API
* Entity Framework Core
* Npgsql
* PostgreSQL
* OpenAPI / Swagger
* xUnit
* ASP.NET Core authentication and authorization

The backend is the main focus of the project.

---

## Database

PostgreSQL hosted on **Neon**.

The application uses a shared-database multi-tenant model.

Tenant-owned entities should be scoped using a `WorkspaceId` or equivalent tenant identifier.

---

# High-Level Architecture

```text
Browser
   │
   ▼
Next.js Frontend
   │
   │ HTTPS / JSON
   ▼
ASP.NET Core API
   │
   ▼
Application / Domain Logic
   │
   ▼
Entity Framework Core
   │
   ▼
PostgreSQL / Neon
```

Do not introduce microservices.

The backend should be implemented as a **modular monolith**.

The architecture should remain simple and appropriate for the size of the project.

---

# Main Domain Entities

## User

Represents an authenticated account.

A user may belong to multiple workspaces.

Typical fields:

* Id
* Email
* DisplayName
* CreatedAt

---

## Workspace

Represents a tenant.

Typical fields:

* Id
* Name
* Slug
* CreatedAt

---

## WorkspaceMember

Represents the relationship between a user and a workspace.

Typical fields:

* WorkspaceId
* UserId
* Role
* JoinedAt

Possible roles:

* Owner
* Recruiter
* Interviewer

Authorization should use workspace membership and role information.

---

## JobOpening

Represents a position being recruited for.

Typical fields:

* Id
* WorkspaceId
* Title
* Description
* Status
* CreatedAt
* ClosedAt

Possible statuses:

* Draft
* Open
* Closed

---

## Candidate

Represents a person applying to a job.

Typical fields:

* Id
* WorkspaceId
* JobOpeningId
* Name
* Email
* CurrentStageId
* CreatedAt

---

## HiringStage

Represents one stage of the hiring pipeline.

Examples:

* Applied
* Screening
* Interview
* Offer
* Rejected

Stages may initially be predefined.

Custom pipelines can be considered later but are not required for the first version.

---

## CandidateNote

Represents an internal note added by a workspace member.

Typical fields:

* Id
* WorkspaceId
* CandidateId
* AuthorUserId
* Content
* CreatedAt

---

## CandidateStageHistory

Records candidate movement through the hiring pipeline.

Typical fields:

* Id
* WorkspaceId
* CandidateId
* PreviousStage
* NewStage
* ChangedByUserId
* ChangedAt

This provides a basic audit trail.

---

## WorkspaceInvitation

Allows existing workspace members to invite another user.

Typical fields:

* Id
* WorkspaceId
* Email
* Role
* Token
* ExpiresAt
* AcceptedAt

---

# Core Features

## Authentication

Users must be able to:

* Register
* Login
* Logout
* Access authenticated endpoints

The exact authentication mechanism may use cookies or tokens depending on deployment architecture.

Authentication should use standard ASP.NET Core mechanisms.

Avoid implementing cryptographic authentication primitives manually.

---

# Workspace Management

Users should be able to:

* Create a workspace
* View workspaces they belong to
* Switch between workspaces
* View workspace members

Workspace owners should be able to:

* Invite members
* Change member roles
* Remove members

---

# Job Management

Authorized workspace members should be able to:

* Create a job opening
* Edit a job opening
* Open or close a job
* View workspace job openings

Every operation must respect tenant boundaries.

---

# Candidate Management

Authorized members should be able to:

* Add a candidate
* View candidates
* View a candidate's details
* Edit candidate information
* Move candidates between hiring stages
* Add internal notes
* View candidate stage history

---

# Hiring Board

The main UI should display candidates grouped by hiring stage.

Example:

```text
Applied          Screening       Interview       Offer

Alice            Charlie         David           Emma
Bob                              Sofia
```

Dragging candidates between columns may be added if convenient.

A simpler move-stage action is acceptable for the first version.

---

# Multi-Tenancy

Multi-tenancy is a core architectural requirement.

The application uses:

```text
One application
One PostgreSQL database
Multiple workspaces
Shared tables
Tenant-owned rows scoped by WorkspaceId
```

Tenant isolation must not rely exclusively on the frontend.

The backend must verify that:

1. The authenticated user belongs to the requested workspace.
2. The requested resource belongs to that workspace.
3. The user's role has permission to perform the requested action.

Tenant boundaries should be enforced centrally where practical.

Possible mechanisms include:

* authorization policies
* scoped tenant context
* EF Core query filters
* repository/service-level tenant constraints

The final implementation should prioritize simplicity and correctness.

---

# Important Security Requirement

The following scenario must never succeed:

```text
User belongs to Workspace A

GET /workspaces/B/candidates/123
```

If the user does not belong to Workspace B, the API must reject access even if candidate `123` exists.

Integration tests should explicitly verify tenant isolation.

This is one of the most important technical demonstrations in the project.

---

# Suggested API Shape

The exact routes may evolve, but the API can conceptually follow:

```text
/api/auth

/api/workspaces
/api/workspaces/{workspaceId}

/api/workspaces/{workspaceId}/members
/api/workspaces/{workspaceId}/invitations

/api/workspaces/{workspaceId}/jobs
/api/workspaces/{workspaceId}/jobs/{jobId}

/api/workspaces/{workspaceId}/candidates
/api/workspaces/{workspaceId}/candidates/{candidateId}

/api/workspaces/{workspaceId}/candidates/{candidateId}/notes
/api/workspaces/{workspaceId}/candidates/{candidateId}/stage
/api/workspaces/{workspaceId}/candidates/{candidateId}/history
```

Prefer REST-style APIs unless there is a strong reason otherwise.

---

# Backend Project Structure

A reasonable initial structure is:

```text
backend/
│
├── HiringTracker.Api/
│   ├── Controllers/
│   ├── Middleware/
│   ├── Authentication/
│   ├── Authorization/
│   └── Program.cs
│
├── HiringTracker.Application/
│   ├── Services/
│   ├── DTOs/
│   ├── Interfaces/
│   └── Validation/
│
├── HiringTracker.Domain/
│   ├── Entities/
│   ├── Enums/
│   └── Exceptions/
│
├── HiringTracker.Infrastructure/
│   ├── Persistence/
│   ├── Configurations/
│   ├── Migrations/
│   └── Services/
│
└── HiringTracker.Tests/
    ├── Unit/
    └── Integration/
```

This is a guideline, not a strict requirement.

Avoid unnecessary abstractions.

Do not create interfaces, repositories, handlers, or architectural layers unless they provide meaningful value.

---

# Frontend Structure

A reasonable frontend structure:

```text
frontend/
│
├── app/
│   ├── login/
│   ├── register/
│   ├── workspaces/
│   └── dashboard/
│
├── components/
├── features/
│   ├── workspaces/
│   ├── jobs/
│   └── candidates/
│
├── lib/
└── types/
```

The frontend should remain significantly simpler than the backend.

---

# Suggested Screens

Only a few screens are necessary.

## Authentication

* Login
* Register

## Workspace

* Workspace selector
* Workspace members

## Jobs

* Job opening list
* Create/edit job opening

## Candidates

* Hiring board
* Candidate details
* Candidate notes/history

This is enough for the portfolio version.

---

# Testing Strategy

Testing should focus primarily on backend behavior.

High-value integration tests include:

### Tenant isolation

Verify that a user cannot:

* read another workspace's jobs
* update another workspace's candidates
* delete another workspace's resources
* access resources by guessing IDs

### Authorization

Verify that:

* owners can manage members
* recruiters can manage candidates
* interviewers have restricted permissions

### Candidate workflow

Verify that:

* candidates can move between valid stages
* stage transitions create history entries
* changes are persisted atomically

### Authentication

Verify:

* protected endpoints require authentication
* invalid credentials are rejected
* authenticated users receive correct workspace access

---

# Database Design Principles

Use:

* foreign keys
* indexes
* unique constraints
* transactions where required
* proper nullable/non-nullable columns
* database migrations

Useful composite indexes may include:

```text
WorkspaceId + JobOpeningId

WorkspaceId + CandidateId

WorkspaceId + Email
```

Uniqueness rules should generally be scoped to a workspace when appropriate.

---

# Error Handling

The API should return consistent error responses.

Possible errors include:

* validation errors
* unauthorized
* forbidden
* resource not found
* tenant access violation
* duplicate resource
* invalid state transition

Use ASP.NET Core's standard mechanisms where possible.

---

# Observability

Include basic structured logging.

Log important application events such as:

* authentication failures
* workspace creation
* member invitations
* candidate stage transitions
* unexpected exceptions

Do not log secrets, passwords, tokens, or sensitive candidate data unnecessarily.

---

# Deployment

The expected deployment architecture is:

```text
Next.js
   │
   └── Vercel

ASP.NET Core API
   │
   └── Docker-compatible hosting provider

PostgreSQL
   │
   └── Neon
```

The exact API hosting provider is not important.

Deployment should remain simple.

---

# Non-Goals

Do not build:

* payroll
* employee management
* calendar synchronization
* email marketing
* complex reporting
* AI candidate ranking
* resume parsing
* video interviews
* enterprise SSO
* subscription billing
* payment processing
* custom workflow builders
* microservices
* event-driven distributed architecture

These features are outside the scope of the portfolio version.

---

# Optional Features

Only consider these after the core product is complete:

* candidate search
* pagination
* workspace audit log
* candidate file attachments
* email invitation delivery
* drag-and-drop candidate board
* real-time updates
* candidate tags
* simple analytics
* background jobs
* rate limiting
* caching

Optional features must not delay completion of the core application.

---

# Engineering Priorities

When implementing features, prioritize in this order:

1. Correctness
2. Tenant isolation
3. Security
4. Clear domain modeling
5. Maintainable code
6. Testability
7. API consistency
8. Performance
9. Developer experience
10. Additional features

---

# Scope Rule

When deciding whether to add a feature, ask:

> Does this demonstrate meaningful backend engineering or make the existing product substantially better?

If not, skip it.

This is a portfolio project, not a startup.

---

# Definition of Done

The project is considered complete when:

* users can register and authenticate
* users can create workspaces
* users can belong to multiple workspaces
* workspace roles are enforced
* workspace owners can invite members
* workspaces can create job openings
* candidates can be added to jobs
* candidates can move through hiring stages
* candidate notes can be added
* candidate stage history is recorded
* tenant isolation is enforced
* tenant isolation has integration tests
* the API has OpenAPI documentation
* the backend has automated tests
* the database uses migrations
* the frontend provides a usable interface
* the frontend is deployed
* the API is deployed
* PostgreSQL is hosted on Neon
* the repository contains setup instructions

At that point, prefer polishing documentation, tests, architecture, and UX over adding new features.

---

# Portfolio Objective

Someone reviewing this repository should quickly understand that the developer knows how to build a real ASP.NET Core backend.

The project should demonstrate:

* understanding of the .NET ecosystem
* ability to model relational data
* practical API design
* multi-tenant security
* authorization
* database design
* testing discipline
* clean code organization
* production-minded engineering decisions

The ideal reaction from a backend engineer reviewing the repository should be:

> "This is a small application, but the backend was designed thoughtfully."
