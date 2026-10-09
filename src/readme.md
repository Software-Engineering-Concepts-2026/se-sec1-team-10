# Source Code

The current application source is organized by runtime responsibility:

| Directory | Contents |
| --- | --- |
| `client/` | React entrypoint, app shell, UI panels, API client, and styles |
| `server/` | Express entrypoint and app, route modules, repository/database access, authentication, domain services, and optional provider integrations |
| `shared/` | Contracts and domain helpers shared by the client and server |
| `tests/` | Vitest and Python tests for the modules in this repository |

Production build output is generated under `dist/`; it is not source. See the [architecture guide](../docs/architecture/README.md) for the source map, C4 views, and runtime layout.
