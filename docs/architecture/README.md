# LifeBalance Architecture

Reviewed against repository source on 11 October 2026. This describes the implementation; live release and deployment results belong in the [deployment evidence](../deployment/continuous-deployment.md).

LifeBalance is a browser-based personal food and activity tracking application. The current implementation is a React single-page application and an Express API in one TypeScript modular monolith. In production, Express serves both the built web files and `/api` routes from one application process. PostgreSQL is accessed separately through Prisma; the repository does not establish the health or configuration of any live deployment.

Personas and scenarios in [`docs/requirements`](../requirements/) describe product context. They are not clinical guidance, and the application does not provide medical recommendations or a postpartum care service.

## Current C4 views

- [C1 System Context](./c4-context.md) shows users and the integrations represented in the current code.
- [C2 Containers](./c4-container.md) shows the logical web, API, and database containers and explains how they map to local development and the production image.
- [Technology stack](./tech_stack.md) lists the implementation choices.

The older draw.io exports in [`diagrams/`](./diagrams/) show an original design and may describe planned or obsolete components. They do not represent the current React/Express implementation or prove that external services are deployed. Use the Mermaid files above for the current code-based view. The UML file is an unfinished template, not implementation evidence. Historical ADR decision text is retained; status notes distinguish superseded proposals from the current architecture.

## Architectural decisions

| Record | Current status | Interpretation |
| --- | --- | --- |
| [Modular Monolith](./adr/0001-monolith-vs-microservices.md) | Accepted | One Node.js/Express application deployment, with a built React client and separate PostgreSQL database. |
| [Original technology selection](./adr/0001-tech-stack-selection.md) | Superseded | Historical Python/FastAPI, Redis and separate frontend hosting proposal; use the current technology matrix above. |
| [Internal microservice REST communication](./adr/001-use-restful-api-internal-commu.md) | Superseded for the microservice topology | Current HTTP boundary is the browser → Express `/api`; internal modules use TypeScript calls, not separately deployed microservices. |

The existing filenames retain their historical numbering so existing links continue to work.

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

Photo analysis is followed by matching against the food catalog through the repository. Matched nutrition values retain their database source; unmatched or ambiguous ingredients retain labeled AI estimates. Image-based quantities remain estimates, and the user must review and save the draft explicitly.

## Delivery mapping

[GitHub Actions](../../.github/workflows/ci.yml) builds and checks the application. Only a successful push workflow for `main` with `CD_ENABLED=true` can enter the deployment job. It pushes the application image to Docker Hub, requests Render to deploy its immutable digest, and verifies the public revision, health and asset hashes. The application image excludes migration tooling; CD does not run migrations or seeds on the production database. Schema changes must use the separately reviewed Prisma migration procedure. See the [CD guide](../deployment/continuous-deployment.md) for configuration and recorded evidence.
