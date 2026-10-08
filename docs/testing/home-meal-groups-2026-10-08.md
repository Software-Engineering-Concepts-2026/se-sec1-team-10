# Home meal groups check — 2026-10-08

## Scope

The Home section `อาหาร · selected date` groups existing meal cards by `mealOptions` order: breakfast, lunch, dinner, then snack. Empty groups are omitted. Historical meals with a null or unknown `mealType` remain visible under `ไม่ระบุมื้อ`. Each group shows its item count and calories calculated by summing the stored meal totals and rounding the sum for display.

Existing meal cards, editor, edit/delete actions, global add action, selected-date requests, and daily nutrition summary remain in place. This change adds no API, backend behavior, or per-group actions.

## Coverage

`e2e/home-meal-actions.spec.ts` checks mixed meal types and order, omitted empty groups, all meals in one group, raw-sum rounding, historical null fallback, moving a meal by editing its type, selected-date clearing, removal after deleting the last meal, and responsive group headings at 320, 360, 390, 533, and 1440 px. Existing tests also cover the meal actions and daily overview refresh.

## Validation

Run the focused Home checks with:

```powershell
node node_modules/@playwright/test/cli.js test --config=.local/compact-regression.config.ts e2e/home-meal-actions.spec.ts e2e/home-date-selector.spec.ts
npm run build
```

## Results

- `npm run build` passed (typecheck, Vite production build, and server TypeScript compile).
- The parent ran the focused Playwright command in the environment with local socket access: **11/11 passed**. Tests use mocked API responses; they do not mutate the shared database.
- Mobile/desktop checks passed at 320, 360, 390, 533, and 1440 px: no horizontal overflow, group headings stay within the viewport, and existing edit/delete actions retain 44 px touch targets.
- Fixture screenshots: `.local/home-meal-actions-20261008/home-{width}.png`.
- Live browser verification uses the existing three lunch records for 6 October 2026 at port 5173. The screenshot is saved as `.local/home-meal-actions-20261008/live-home-groups.png`; no live records are edited or deleted.

## Files

- `src/client/DashboardPanel.tsx`: display groups derived from existing selected-date meals; original cards and handlers are unchanged.
- `src/client/home-meal-groups.css`: scoped group headers and spacing, loaded directly by the component.
- `e2e/home-meal-actions.spec.ts`: grouping and existing-flow regression coverage.
- `docs/ui/lifebalance-ui-design-brief.md`: approved grouping layout.
