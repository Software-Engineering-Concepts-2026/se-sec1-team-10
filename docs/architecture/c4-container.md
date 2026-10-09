# C4 Level 2: Containers

This is a logical C4 view of the application. The SPA and API are separate logical containers, but the production `Dockerfile` packages the built SPA with the Express API in one application image and one process. Database hosting is separate from that image.

```mermaid
C4Container
    title LifeBalance Logical Containers

    Person(user, "LifeBalance user", "Uses the app in a desktop or mobile browser")

    Container_Boundary(system, "LifeBalance") {
        Container(spa, "Web application", "React 19, TypeScript, Vite", "Browser-based single-page application")
        Container(api, "API application", "Node.js 22, Express 5, TypeScript", "REST API, application logic, authentication, and production static-file hosting")
    }
    ContainerDb(db, "PostgreSQL database", "PostgreSQL, accessed with Prisma", "Persistent account, meal, food, goal, weight, and activity data")
    System_Ext(usda, "USDA FoodData Central", "Optional food search API")
    System_Ext(ai, "OpenAI-compatible AI provider", "Optional estimate API")

    Rel(user, spa, "Uses", "HTTPS in production; HTTP localhost in development")
    Rel(spa, api, "Calls /api routes", "JSON; same origin in production, Vite proxy in development")
    Rel(api, db, "Reads and writes application data", "Prisma over PostgreSQL; local Compose publishes port 5432")
    Rel(api, usda, "Searches when configured", "HTTPS / JSON")
    Rel(api, ai, "Requests estimates when configured", "HTTPS / JSON")
```

## Runtime mapping

During development, Vite serves the browser app on port 5173 and proxies `/api` to Express on port 3000. In the production image, Express serves the built client files and API from the same process; the Dockerfile defaults to listening on port 10000. The database is a separate PostgreSQL service. The checked-in `compose.yaml` starts only a local PostgreSQL 17 service bound to `127.0.0.1:5432`, not an application service. No live deployment topology is asserted here.
