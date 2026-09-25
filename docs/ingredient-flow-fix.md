# Ingredient flow correction — 21 September 2026

The add-component editor previously rendered a form inside the meal form, accepted blank nutrition values as zero, and required users to enter every nutrient. This did not meet the intended name-and-grams workflow.

The editor now collects a component name and grams, requests an AI estimate through authenticated `POST /api/foods/estimate`, and appends the result to the draft. Values are explicitly labelled AI estimates. The endpoint shares the existing image-analysis rate limit and daily quota. Provider failures preserve the entered values. USDA search remains an optional alternative and requires its configured API key.

There is one meal form. Adding a component never submits it. Changed quantities invalidate displayed totals until recalculation; empty and invalid quantities cannot be confirmed. Deleting the last component still leaves the add action available. Editing an existing meal retains its identity when adding a component.

Verification:

- Build and TypeScript checks passed.
- 18 food/API/nutrition tests passed, including authentication, input validation and shared AI quota for text estimates.
- Browser regression tests passed at 320px and 390px with mocked API responses: failure/retry, add, 200g to 100g, explicit recalculation, save/reload/edit, deleting the final component and re-adding without a duplicate meal.
- Existing real PostgreSQL lifecycle test passed against the isolated `lifebalance_food_test_20260920` database.
- One live university AI request for cooked rice 200g succeeded; returned reference energy was 130 kcal per 100g. This verifies connectivity and format, not nutritional accuracy.

Existing legacy records with unknown gram weights remain labelled in their original serving units. No migration or conversion of unknown weights is included in this correction.

## Saved meal flow check — 25 September 2026

The mocked browser flow now stores meals by ID instead of replacing a single record. At 320px and 390px it verifies that reusing a favorite creates m2 at 50g and 65 kcal while the original m1 remains at 100g and 130 kcal. It then edits m2 to 150g, verifies the update targets m2 and shows 195 kcal in the daily list and history, and confirms both records retain their separate portions and totals after reload. Both mocked browser cases passed with `node_modules/.bin/playwright test e2e/ingredient-flow.spec.ts --workers=1`.

This check covers the browser flow with mocked API persistence. It does not verify this flow on a real phone or against PostgreSQL; the earlier database lifecycle check did not exercise favorite selection or the two-record portion assertions.
