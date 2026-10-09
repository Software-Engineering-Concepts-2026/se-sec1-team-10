# LifeBalance Architecture

LifeBalance is a browser-based personal food and activity tracking application. The current implementation is a React single-page application and an Express API in one TypeScript modular monolith. In production, Express serves both the built web files and `/api` routes from one application process. PostgreSQL is accessed separately through Prisma; the repository does not establish the health or configuration of any live deployment.

Personas and scenarios in [`docs/requirements`](../requirements/) describe product context. They are not clinical guidance, and the application does not provide medical recommendations or a postpartum care service.

## Current C4 views

- [C1 System Context](./c4-context.md) shows users and the integrations represented in the current code.
- [C2 Containers](./c4-container.md) shows the logical web, API, and database containers and explains how they map to local development and the production image.
- [Technology stack](./tech_stack.md) lists the implementation choices.

The older draw.io exports in [`diagrams/`](./diagrams/) show an original design and may describe planned or obsolete components. In particular, they do not represent the current React/Express implementation or prove that external services are deployed. Use the Mermaid files above for the current code-based view. Historical ADRs remain unchanged and record decisions at the time they were written.

## Source map

| Path | Responsibility |
| --- | --- |
| `src/client/` | React UI, panels, browser-side API calls, and styles |
| `src/server/index.ts` | Process entrypoint, configuration wiring, database connection, production static-file serving, and HTTP listener |
| `src/server/app.ts` | Express middleware, health endpoint, error handling, and route registration |
| `src/server/routes/` | Account, meal, food, activity, and weight HTTP routes |
| `src/server/` | Application services, validation and calculations, authentication, AI/nutrition integrations, and repository implementation |
| `src/shared/` | TypeScript contracts and shared domain helpers used across client and server |
| `prisma/` | Prisma schema, migrations, and seed/catalog utilities |
| `docs/architecture/` | Current diagrams and historical architecture decisions |

## Runtime notes

For local development, `npm run dev` starts the Vite client at port 5173 and the Express API at port 3000; Vite proxies `/api` requests to the API. `Dockerfile` builds a single production application image that listens on port 10000 and serves the client and API together. `compose.yaml` currently defines only an optional local PostgreSQL 17 service on `127.0.0.1:5432`; it does not define an application service. A production-style deployment therefore runs the application separately from its PostgreSQL database. Supabase can provide a PostgreSQL endpoint, but these files do not establish any live deployment state.

The code includes optional integrations for an OpenAI-compatible image/ingredient estimation provider and USDA FoodData Central search. Their availability depends on runtime configuration and provider access; their presence in code does not assert that they are configured in production. No Google Fit, Apple HealthKit, SendGrid, FCM, or Redis integration is implemented in the current application entrypoints and modules.
