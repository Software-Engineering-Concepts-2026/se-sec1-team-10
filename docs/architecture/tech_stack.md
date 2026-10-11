# Implemented Technology Stack

Reviewed against source on 11 October 2026. This matrix describes the current repository implementation. It is not a statement about the configuration of a live deployment.

| Layer | Current implementation | Notes |
| --- | --- | --- |
| Web client | React 19, TypeScript, Vite, Tailwind CSS 4 | Vite serves the client separately during development; the production build is served by Express. |
| API | Node.js 22.12+, Express 5, TypeScript | Modular monolith with account, meal/food, and activity route modules. |
| Shared domain types | TypeScript modules in `src/shared/` | Contracts and helpers are imported by the client and server. |
| Database access | PostgreSQL through Prisma ORM 6 | The application expects a configured PostgreSQL connection. Supabase may provide PostgreSQL, but is not required by the code. |
| Validation | Zod 4 | Validates request and provider data at runtime. |
| Authentication | Password hashing with Node.js `scrypt`; signed JWT session in an HttpOnly cookie using `jose` | The cookie uses `SameSite=Lax` and is marked `Secure` in production. Express middleware verifies authenticated requests. |
| HTTP protections | Helmet, Express rate limiting, bounded JSON body parsing, same-origin checks for mutations | Configured in the API application and route modules. |
| Food data integration | USDA FoodData Central API, when configured | Optional search integration; the local food catalog is also part of the application. |
| AI integration | Configurable OpenAI-compatible provider, when configured | Optional meal-photo and ingredient estimates; outputs are labeled estimates and must be reviewed by the user. |
| Production packaging | Multi-stage Docker build, one Node.js application image | The image serves the built SPA and API on the same port. Database remains a separate service. |
| Delivery | GitHub Actions, Docker Hub and Render deploy hook | CD runs after the four prerequisite jobs on a push to main when enabled; publishes an immutable image digest and verifies public revision, health and asset hashes. No production migrations/seeds run in CD. |
| Test tooling | Vitest/V8, Playwright and isolated PostgreSQL performance checks | Unit + mocked browser coverage is distinct from live database/browser checks. The default Demo API benchmark uses one synthetic user; load mode is separate. |

In local development, `npm run dev` runs Vite on port 5173 and the API on port 3000, with Vite proxying `/api` to the API. The Docker image defaults to port 10000. `compose.yaml` provides only a local PostgreSQL service on `127.0.0.1:5432`; it does not run the application container.

Redis sessions/cache, Google Fit, Apple HealthKit, SendGrid, and Firebase Cloud Messaging are not implemented in the current runtime code. Their mention in historical diagrams or decisions should be read as original design context, not as current integrations.
