# Performance baseline — 10 October 2026

Historical load-test result. The 11 October update changes normal Demo checks and the CI configuration to the [single-user Demo benchmark](performance-demo-2026-10-11.md). Results in this document predate that update and are not results from a new CI run. The 100-user project load check remains available separately with `--load`; it is not required by the teacher's Demo handout.

This is an isolated API benchmark, not a load test against Render/Supabase or a measurement of browser rendering or AI latency.

## Measured setup

- Locally built production-mode image: `lifebalance:demo-readiness`. It contains this uncommitted test/CD work on `feature/Chayakorn05`; its revision label records the base commit `58abe6f689b895177c5fac7dce283fabe456719e`, not a published release of these changes. Application business logic is unchanged.
- Windows x64 host, 12 reported CPU execution slots, 30.9 GiB host memory; Linux application container and PostgreSQL 17 over loopback/Docker bridge. These are host readings, not guaranteed container resource limits.
- 100 synthetic accounts, each initially containing 1,000 health records: 500 meals, 300 weights and 200 exercises across a one-year date window. Each meal has one ingredient. Image payloads and AI are excluded.
- Real Express routes, password verification, sessions, Prisma and PostgreSQL are used. No repository/database mocks.
- Synthetic proxy client addresses distinguish the 100 users; the normal authentication limiter remains enabled. Test credentials exist only in memory and disposable containers.

## Latest result

| Measurement | Samples | p95 | Errors |
| --- | ---: | ---: | ---: |
| 100 simultaneous logins | 100 | 1,174.30 ms | 0 |
| Daily dashboard + year health history + weights + weekly API bundle | 20 | 24.89 ms | 0 |
| Save meal then verify updated daily totals | 20 | 34.32 ms | 0 |
| Read updated totals after save acknowledgement | 20 | 22.11 ms | 0 |
| Dashboard API under 100 concurrent users, 3 rounds | 300 | 701.36 ms | 0 |
| View → save → refresh user journey under load | 300 | 781.36 ms | 0 |
| All measured HTTP responses | 1,805 | 1,139.27 ms | 0 |

The normal API bundle and save/read gates passed; the concurrent dashboard p95 was below 3 seconds, with HTTP error rate 0%. Every failed view/request is retained in statistics; the concurrency gate requires all 300 view samples. All containers/network created by the test were cleaned up. The local raw result is `.local/performance/result.json`; CI saves the same file as `performance-results`.

## Reproduce

After `npm ci` and `npm run build`, with Docker running:

```sh
docker build --build-arg VCS_REF=<full-tested-commit-sha> -t lifebalance:performance .
node scripts/performance-check.mjs lifebalance:performance --load
```

The script creates a new database and network itself, applies existing migrations to that database only, seeds synthetic data, starts the image, measures HTTP requests and cleans up its own resources in `finally`. It does not accept a database URL or read `.env`; never substitute Supabase data into this test. `DOCKER_EXECUTABLE` can select a local Docker executable when Docker is not on PATH.

## Interpretation for presentation

This provides reproducible evidence for the application/API portions of the Demo response target and NFR-01/02/07. It does **not** prove the complete browser-visible NFR-01/02 timing, production capacity, cold-start time, availability, photo payload performance, external AI response time or nutrition accuracy. Do not present these local timings as Render timings. Measure those separately if claiming their full requirements are satisfied. Earlier CI runs measured this load baseline on their own Linux runner; local results do not guarantee identical CI numbers. The current script writes `load-result.json` for `--load` and `demo-result.json` for the default Demo mode; the `result.json` referenced above is the historical output.
