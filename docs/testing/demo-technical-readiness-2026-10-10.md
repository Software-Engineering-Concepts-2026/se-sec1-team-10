# Demo technical evidence — 10 October 2026

## Status

Work is prepared on `feature/Chayakorn05`. Measurements below were collected locally before the initial commit; GitHub CI and live CD evidence must be captured separately after publishing the change. No production deployment, production database mutation, application business-logic change or new migration was performed for this task.

| Area | Requirement | Verified evidence | Remaining |
| --- | --- | --- | --- |
| Coverage | Demo: at least 60% | All 45 production TypeScript files: 71.42% statements, 89.17% lines from unit and mocked browser tests | Run the committed workflow in GitHub and retain its artifact |
| Core logic | NFR-08: at least 80% | BMI, meal calorie and net calorie implementation scope: 96.83% unit/API line coverage, 122/126 lines | This is the documented core scope, not every application module |
| Performance | Demo: response under 2 seconds | Isolated real API/PostgreSQL test: 100 concurrent users, dashboard p95 701.36 ms, 1,805 HTTP responses, zero errors | Render/browser rendering, AI calls and image payload timings are not measured |
| CD | Automatic deployment | Main-only gated workflow, immutable image selection, public revision/asset verification and six verifier tests | Add two secrets and `CD_ENABLED=true`, review/merge, then capture a successful enabled main run |

Whole-source branch coverage is 59.70%; function coverage is 65.30%. The Demo gate uses statements and lines, not a claim that every coverage metric exceeds 60%. Browser tests mock the API and are separate from the real-database performance test.

## Local checks

- `npm run test:coverage:all`: 132 unit tests passed; 3 database-dependent tests skipped without `TEST_DATABASE_URL`; all 73 browser tests passed on the final run. Earlier transient browser failures are recorded in the coverage guide.
- `npm run build`: typecheck and production build succeeded, also inside Docker.
- Coverage fixture standalone TypeScript check passed, including its re-exported Playwright types.
- `npm run test:e2e:chunks`: 2 tests passed using installed Microsoft Edge. The sandbox startup stalled; the unrestricted Chromium attempt could not launch because its executable was absent. The Edge rerun passed. CI installs Chromium explicitly before these tests.
- `node --test scripts/deploy-render.test.mjs`: 6 passed; production was not contacted.
- `node scripts/performance-check.mjs lifebalance:demo-readiness`: passed; own database, application container, network and migration directory were cleaned up.
- Local Docker build and extraction of its `release.json` and public asset manifest succeeded. The local image records its base commit; it is not a published release of the uncommitted changes.
- YAML syntax and deployment prerequisites/branch/permission guards passed local validation. `git diff --check` passed. These are not a substitute for a successful GitHub workflow run.

## Evidence locations

- [Coverage methodology and scopes](typescript-coverage.md); local `coverage/summary.json`, `coverage/unit-coverage.json`, `coverage/merged-html/index.html` and `coverage/merged-html/merged-lcov.info`.
- [Performance setup, measurements and limitations](performance-2026-10-10.md); local `.local/performance/result.json` includes all samples.
- [CD setup and verification](../deployment/continuous-deployment.md); local test asset hashes are `.local/cd/asset-manifest.json`.
- CI retains `typescript-coverage`, `performance-results` and, after an enabled deployment, `deployment-proof-<sha>` artifacts. Only the named safe JSON files under `.local` are uploaded for performance/CD.

## Finish CD evidence

1. Review this change and explicitly authorize its commit/push/PR under the project's Git rules.
2. Add `DOCKERHUB_TOKEN` and the existing service's `RENDER_DEPLOY_HOOK` to repository Actions secrets; do not place their values in chat or source files.
3. Set repository Actions variable `CD_ENABLED=true` after credential/review setup.
4. Merge through the agreed `life-balance-test` → `main` sequence after checks/review succeed.
5. Capture the successful enabled main workflow, immutable Docker image, deployment proof artifact, and matching public `/release.json`. Until this run exists, present CD as implemented and locally tested, with live evidence pending.
