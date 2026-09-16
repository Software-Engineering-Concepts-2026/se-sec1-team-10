# Mobile and food analysis QA report

Verified on 2026-09-16 on `life-balance-test`. No PR or merge is part of this work.

## Automated results

- Vitest: 48 tests passed across five files with TEST_DATABASE_URL pointing to the local PostgreSQL database. This includes 46 normal tests and two opt-in PostgreSQL integration tests.
- Real database lifecycle: registration/login, profile and goals, meal/exercise create/update/delete, daily and weekly totals, history, cross-account isolation, logout, and persistence across independent app/Prisma instances passed.
- Real quota concurrency: six independent Prisma clients racing for three slots resulted in exactly three accepted reservations; exhaustion persisted after reconnect, and other users/days remained independent.
- Mocked Edge browser suite: eight cases cover navigation, narrow viewport, AI preview/save/fallback, desktop canvas, USDA 200 g scaling/source, meal edit/delete/history, and reminder opt-in/deduplication. This suite does not call external providers.
- Build: TypeScript and production build passed. Initial JavaScript chunk decreased from 527.64 kB to 475.30 kB (137.95 kB gzip). Secondary sections are loaded on first visit and stay mounted thereafter; no Vite chunk-size warning remains.

## Live provider verification

A public food photo was downloaded with user authorization: [Banana-Single.jpg by Evan-Amos, Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Banana-Single.jpg). The image and provider diagnostics stay in ignored .local files.

The first food-photo attempts revealed a real compatibility bug: the university provider returned notes as a string while the application expected an array. The prompt now specifies the full JSON shape and bounds, and a single string note is narrowly normalized to an array before strict validation. Regression coverage was added; nutrient strings and other invalid data remain rejected.

After the fix, the real KKU adapter recognized one banana and returned an ai-estimate preview in 8,382 ms. Reported usage was 5,775 input + 410 output = 6,185 tokens for this 960 px image. This is one observed request, not a typical cost estimate. It confirms image recognition and response parsing, not nutritional accuracy. Earlier blank-image testing correctly returned non-food.

## Infrastructure

PostgreSQL 17 portable binaries were installed under ignored .local, initialized for loopback-only connections, and all six migrations applied. API and Vite run on 127.0.0.1:3000 and 127.0.0.1:5173. See local-testing.md for restarting the local instance. No university key or database password is committed.

Daily AI scan limits now use atomic persistent database reservations rather than process memory. Attempt counts include failed provider requests, so retries cannot bypass the quota. The short 15-minute rate limiter remains per process; the daily limit is shared through PostgreSQL.

## Remaining limits

- USDA live access still needs NUTRITION_API_KEY; fixtures verify mapping/portion scaling only.
- AI estimates and USDA search are separate entry methods; there is no automatic matching or database verification of a photo.
- Real phone camera permissions, on-screen keyboard behavior, and recognition across varied Thai meals/mixed dishes remain unverified.
- Nutrition estimates cannot be treated as measured ingredient weights or laboratory nutrition values.
- GitHub issue acceptance coverage is tracked separately in issue-audit.md; do not infer completion from this test report.

## Live browser result and additional fixes

Two real Edge mobile-viewport tests passed against Vite, API and PostgreSQL: registration, profile save, meal creation, page reload persistence, edit, delete, and daily totals. Each run uses a unique account and cleans up only that account. Run npm run test:e2e:live with the local API/web/database running.

The real edit test exposed Prisma mealLogId leaking into public ingredient records. The server now explicitly selects public ingredient fields, and client submissions explicitly select allowed input fields. A real-database regression verifies the response fields; the live edit flow now passes.

Meal reminders now use opt-in browser notifications via a service worker while the app remains running. The observer starts after login, settings are account-scoped, and repeated notifications for the same meal time are suppressed. Browser/system APIs are mocked in its automated dispatch test. Delivery with the app closed or suspended is not implemented.
