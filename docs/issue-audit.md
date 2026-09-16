# GitHub issue acceptance audit

Audit date: 2026-09-16. Repository read only: Software-Engineering-Concepts-2026/se-sec1-team-10.

The unauthenticated issue endpoint returned 404. The QA agent then retrieved issues using the existing authenticated Git credential without changing GitHub data. Feature issue bodies were empty; only their titles were available as acceptance statements. No issue, board, PR, or merge was changed.

## Issue #12: meal notifications

[Issue #12](https://github.com/Software-Engineering-Concepts-2026/se-sec1-team-10/issues/12) asks for meal reminders during a busy workday. Previously only an in-page message existed. The app now has explicit opt-in browser notification permission, a service worker notification handler, three account-scoped reminder times, validation of saved settings, and per-day/time deduplication. The observer runs after login even before visiting Diary. Browser tests verify the opt-in and due/deduplicated dispatch using a notification API test double.

Scope limit: the page must remain running. Delivery while the browser is suspended or closed is not implemented; that would require server-side scheduled Web Push. Physical phone permissions and background behavior are not verified. Do not describe this as guaranteed closed-app reminders.

## Other retrieved feature titles

The QA agent found corresponding code and test coverage for #4, #6, #8, #9, #14–#17, #19, #20, and #29–#32. Because the bodies contain no detailed acceptance criteria, this is a limited implementation review, not a certification of every team's requirement or a change to GitHub status. The concrete verification evidence is in test-report-mobile.md.

## Remaining external checks

- A live USDA request requires the separate NUTRITION_API_KEY.
- Recognition and nutrition estimation across varied Thai and mixed dishes need a representative image set; one banana photograph has passed live recognition.
- Real phone camera, keyboard, permission and background-notification behavior require device testing.

PostgreSQL registration/login, meal and exercise lifecycle, profile, summaries, isolation and persistence have now passed real database tests. The previous infrastructure blocker is resolved on this machine.
