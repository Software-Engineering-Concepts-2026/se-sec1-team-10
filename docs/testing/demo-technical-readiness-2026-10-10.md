# Demo technical evidence — measurements from 10–11 October 2026

## Status

This report separates local measurements, recorded GitHub CI/CD evidence and a production public check. The 11 October benchmark/document update is prepared on `feature/Chayakorn05` for the protected `life-balance-test` → `main` flow. These changes do not modify application logic, APIs, authentication or the database schema. Existing migrations run only against a disposable test database.

| Area | Requirement | Verified evidence | Remaining |
| --- | --- | --- | --- |
| Coverage | Demo: at least 60% | Local: all 45 production TypeScript files, 71.42% statements and 89.17% lines from unit and mocked browser tests; the previous successful GitHub run retains a separate `typescript-coverage` artifact | Keep the scope/metric labels; do not label the local screenshot as downloaded CI coverage |
| Core logic | NFR-08: at least 80% | BMI, meal calorie and net calorie implementation scope: 96.83% unit/API line coverage, 122/126 lines | This is the documented core scope, not every application module |
| Performance | Demo: response under 2 seconds; teacher handout does not prescribe concurrency | New local single-user run: 20 repetitions per action, 379 HTTP responses, zero errors, every measured API/action under 2 seconds; login action maximum 85.85 ms | Publish/run the new CI mode and measure the browser/production flow separately; this does not retest NFR-07 |
| CD | Automatic deployment | Recorded main run [38076002736, attempt 3](https://github.com/Software-Engineering-Concepts-2026/se-sec1-team-10/actions/runs/38076002736/attempts/3) succeeded for revision `151b609`; revision, health and 12 public assets verified | A later commit needs its own successful main CI/deploy proof; setup secrets/flag are already configured for the recorded run |

Whole-source branch coverage is 59.70%; function coverage is 65.30%. The Demo gate uses statements and lines, not a claim that every coverage metric exceeds 60%. Browser tests mock the API and are separate from the real-database performance test.

## Local checks

- `npm run test:coverage:all`: 132 unit tests passed; 3 database-dependent tests skipped without `TEST_DATABASE_URL`; all 73 browser tests passed on the final run. Earlier transient browser failures are recorded in the coverage guide.
- `npm run build`: typecheck and production build succeeded, also inside Docker.
- Coverage fixture standalone TypeScript check passed, including its re-exported Playwright types.
- `npm run test:e2e:chunks`: 2 tests passed using installed Microsoft Edge. The sandbox startup stalled; the unrestricted Chromium attempt could not launch because its executable was absent. The Edge rerun passed. CI installs Chromium explicitly before these tests.
- `node --test scripts/deploy-render.test.mjs`: 6 passed; production was not contacted.
- Historical 10 October default benchmark ran 100 concurrent users. The new `node scripts/performance-check.mjs lifebalance:demo-readiness --demo` run measured one user with 20 repetitions and passed; its own database, application container, network and migration directory were cleaned up. See the [new report](performance-demo-2026-10-11.md) for the reused image's provenance and first failed test-script attempt.
- Local Docker build and extraction of its `release.json` and public asset manifest succeeded. The local image records its base commit; it is not a published release of the uncommitted changes.
- The original workflow's YAML/guards were validated before the original commit. For the 11 October change, script syntax, build/typecheck and `git diff --check` passed; the six deployment-verifier tests passed again. An independent reviewer found no blocking issues in the benchmark/CI diff. These checks do not substitute for a new GitHub workflow execution.

## Evidence locations

- [Coverage methodology and scopes](typescript-coverage.md); local `coverage/summary.json`, `coverage/unit-coverage.json`, `coverage/merged-html/index.html` and `coverage/merged-html/merged-lcov.info`.
- [New single-user Performance report](performance-demo-2026-10-11.md); local `.local/performance/demo-result.json` includes all new samples. The [100-user report](performance-2026-10-10.md) is historical and remains separate.
- [CD setup and verification](../deployment/continuous-deployment.md); local test asset hashes are `.local/cd/asset-manifest.json`.
- CI retains `typescript-coverage`, `performance-results` and, after an enabled deployment, `deployment-proof-<sha>` artifacts. Only the named safe JSON files under `.local` are uploaded for performance/CD.

## Production public check and remaining work

On 11 October at 03:43 Thailand time, the public health endpoint returned `ok` and the public revision matched `151b60927d4c424463df00d56fce44a9679fd0b9`. The first command-line health request took **22,837 ms** end to end. Five subsequent requests took **373, 199, 186, 174 and 188 ms**. The reason for the slow first request is not established by these measurements; do not claim all production responses are under 2 seconds. These public health checks do not measure authenticated actions or browser rendering.

1. Publish the new benchmark/docs through the protected `life-balance-test` → `main` sequence and capture its own CI results/deployment proof. The teacher's Demo gate and the project's optional NFR-07 load check remain separate.
2. Check browser-visible authenticated flows on the actual deployment and record both slow and fast samples. Login/session expiry may require the human user to sign in.
3. Use original capture images for the slides and label local/CI/production sources. The new local image-only package contains 14 captures with a single-user performance log; it is ignored output under `.local`, not a GitHub artifact.
4. The presentation slides, backup video, external-user feedback and Q&A bank are team deliverables; their completion is not verified by this technical report.
