# TypeScript coverage

Run `npm run test:coverage` or `npm run test:coverage:all` to execute Vitest and the existing Playwright E2E suite, convert Chromium's V8 coverage
through Vite source maps, and merge both into one report. It writes text, HTML, LCOV, and JSON output under
`coverage/merged-html/`, `coverage/merged-html/merged-lcov.info`, `coverage/coverage-final.json`, and `coverage/summary.json`.
`npm run test:coverage:unit` runs only Vitest and writes its baseline report under `coverage/`.

The denominator includes every `.ts` and `.tsx` file under `src/server`, `src/shared`, and `src/client`; test files
are excluded. No production files are removed from the denominator to improve the result. Browser collection is
enabled only by the combined coverage command and records only Vite-served client/shared source modules. Its raw
coverage stays under ignored `coverage/browser/`.

The unit-only baseline on `feature/Chayakorn05` was 27.56% statement coverage and 33.12% line coverage across all
included TypeScript source. It left the client at 0.57% line coverage because Vitest does not render the application
UI. The latest complete run measured 71.42% statements and 89.17% lines across all TypeScript source, and all 73 E2E
tests passed. Two earlier complete runs each had one transient failure in a different E2E case; the first failed case
passed in isolation, and both passed in the latest complete run. The command exits unsuccessfully if the Playwright
suite fails or either whole-source threshold is missed. It reports the NFR-08 core line threshold of 80% separately.

NFR-08 focuses on BMI, meal calorie calculation, and net calories. The baseline for their direct implementation paths
was 96.83% line coverage (122 of 126 executable lines in the unit-only baseline) across `src/server/health.ts`, `src/server/meal.ts`,
`src/server/routes/activity.ts`, and `src/shared/contracts.ts`. These files contain BMI derivation, meal nutrient
calculation, consumed-minus-burned totals, and the associated calorie input contract. This scoped measurement meets
the 80% business-logic target. The combined summary keeps this NFR-08 gate based on the unit/API report before browser
merge; Istanbul statement maps from Vitest and V8 can differ even when source maps resolve to the same TypeScript file.
The merged report also shows this scope for comparison. The scoped measurement does not imply that the whole
application meets 80%.

Three PostgreSQL integration suites are skipped when `TEST_DATABASE_URL` is unset. The unit-only baseline had 132
passing tests and 3 skipped tests, and did not access a production database. E2E API fixtures use mocked data. Browser
coverage does not establish live database/provider behavior.
