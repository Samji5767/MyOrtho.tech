# ADR-003: NestJS Feature Module Pattern

## Status

Accepted

## Date

2026-01-15

## Context

MyOrtho.tech's backend serves a multi-domain clinical platform. The primary business domains are:

- **Cases** — orthodontic case lifecycle management
- **Patients** — patient records and demographics
- **Treatment Plans** — appliance selection and treatment sequencing
- **Manufacturing** — appliance fabrication workflow and status
- **Billing** — invoicing and payment tracking
- **AI Copilot** — rule-based and LLM-assisted clinical recommendations

Without deliberate architectural boundaries, a growing NestJS application collapses into a single large module where services import each other freely, controllers access the database directly, and domain logic becomes entangled. This makes the codebase harder to test, reason about, and evolve independently per domain.

## Decision

We adopt a **one NestJS module per business domain** pattern.

Each feature module (e.g., `CasesModule`, `PatientsModule`, `TreatmentPlansModule`) owns:

- Its own controllers (HTTP interface only — no business logic)
- Its own services (all business logic lives here)
- Its own DTOs and validation pipes
- Explicit exports of services that other modules may consume

Two modules are designated `@Global()` and do not need to be imported by individual feature modules:

- **`DatabaseModule`** — provides and exports the `PG_POOL` token
- **`AuthModule`** — provides and exports `AuthGuard` and user context utilities

Cross-domain access is achieved by injecting the exporting module's service (not by accessing the database directly). For example, `TreatmentPlansService` may inject `PatientsService` to validate patient existence, but it does not query the `patients` table directly.

## Consequences

### Positive

- **Clear ownership.** Each domain module has a single team/owner responsible for its service, controller, and schema slice
- **Testable in isolation.** Feature modules can be unit-tested by mocking their injected service dependencies. No global state to clean up between tests
- **Encapsulated schema access.** A module's service is the only code that queries its tables, making it easier to enforce data access policies and audit data flows
- **Incremental extraction.** If a domain grows large enough to warrant a separate microservice, its module boundary already defines the extraction seam

### Negative

- **Circular dependency risk.** If module A imports module B and module B imports module A, NestJS will throw at startup. This requires deliberate design of dependency direction and, in some cases, extraction of shared types into a `SharedModule` or use of `forwardRef()`
- **Import boilerplate.** Each module must explicitly declare its `imports`, `providers`, `controllers`, and `exports` arrays. This is verbose but intentional
- **Cross-domain queries.** Complex queries joining tables owned by different modules cannot be expressed as a single service call; they require either a composed service call pattern or a dedicated read-model service in a cross-cutting module

## Module Dependency Guidelines

- `DatabaseModule` and `AuthModule` are `@Global()` — no explicit import needed
- Feature modules may import other feature modules to consume their exported services
- Direct database access from a module that does not "own" that table is prohibited
- Circular dependencies must be resolved by extracting shared concerns to `SharedModule` or redesigning the dependency direction
