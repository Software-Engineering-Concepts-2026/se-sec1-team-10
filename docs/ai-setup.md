# Food image analysis setup

LifeBalance can estimate meal ingredients and macronutrients from an image through a university-hosted, OpenAI-compatible Chat Completions service. The feature is server-side only: the browser never receives `AI_API_KEY`.

Set these values in the server's `.env` file:

```dotenv
# Use the provider base URL, or its complete Chat Completions endpoint.
AI_BASE_URL=https://ai.example.edu/v1
AI_API_KEY=your-university-issued-key
AI_MODEL=your-vision-capable-model-name
AI_DAILY_SCAN_LIMIT=50
AI_TIMEOUT_MS=45000
# Optional, for verified USDA FoodData Central search results only.
NUTRITION_API_KEY=your-data-gov-api-key
```

`AI_BASE_URL` accepts a base URL such as `https://ai.example.edu/v1` or a full endpoint ending in `/chat/completions`. LifeBalance appends `/chat/completions` only when needed. The configured model must accept image data URLs in OpenAI-compatible `messages` input. For KKU, the tested base URL is `https://gen.ai.kku.ac.th/upacth/api/v1`.

Put actual credentials in the root `.env` file and save it in your editor. `.env.example` is a public template and must contain no real key. Restart the API after changing `.env`. `AI_API_KEY` is the university key; `NUTRITION_API_KEY` is a separate optional USDA/data.gov key. Food image estimation works without a USDA key. AI components are matched by name and alias against the local Food catalog. The optional USDA search is a separate endpoint and does not automatically verify components that have no complete local catalog match.

Daily scan counts are stored in PostgreSQL per account and UTC calendar day, so they survive API restarts and apply across API processes that share the database. Run the `AiDailyQuota` migration before enabling the feature in another environment. This is an application request cap, not the university provider's token budget; keep the university's own quota controls enabled.

The endpoint must use HTTPS in production. Plain HTTP is accepted only for `localhost`, `127.0.0.1`, or `::1` development endpoints. URLs containing credentials (`user:password@host`) or a fragment (`#...`) are rejected.

Leave any of the three AI settings blank to disable `POST /api/meals/analyze`. It then returns HTTP 503 and no provider request is made. `AI_DAILY_SCAN_LIMIT` must be a whole number from 1 through 50; its default is 50 analysis attempts per account per UTC calendar day. Do not put these settings in `VITE_*` variables, commit real keys, or send a key from the browser.

The endpoint requires an authenticated session and JSON from the configured app origin. It accepts `{ "imageData": "data:image/png;base64,...", "correctedMealName": "ชื่ออาหารที่ยืนยัน" }`; `correctedMealName` is optional, trimmed, and must contain 2–120 characters. A correction reconsiders the same photo and preserves the confirmed name. It limits image data to 300,000 characters and allows ten attempts per account per 15 minutes. `AI_TIMEOUT_MS` is the provider abort budget, including response reading: a whole number from 1000 to 60000 milliseconds, defaulting to 45000 (45 seconds). Restart the API after changing this value. Local catalog lookup occurs after the provider call and is outside that budget.

A successful response is `{ "analysis": { ... } }`, where `analysis.source` is always `"ai-estimate"` and natural-language fields are requested in Thai. The server checks each AI-extracted ingredient against the signed-in user's visible local Food catalog using its name and aliases. A complete match uses the catalog's nutrient values, while an unmatched, ambiguous, or incomplete match remains an AI estimate. Ingredient names and gram amounts extracted from an image are still estimates and should be reviewed before saving. The optional USDA search endpoint is separate and does not automatically verify unmatched AI estimates. A non-food image returns HTTP 422 with `{ "error": "not-food" }` and a Thai user-safe message.

Every admitted provider attempt consumes daily quota, including failures, non-food responses, timeouts, and corrections. There is no automatic retry or quota refund: a timed-out request may still be billed upstream. The UI shows elapsed seconds and asks users to wait after ten seconds. Failures preserve the photo and draft; manually analyzing again consumes another attempt. Analysis produces a preview and never saves a meal automatically.

The provider is asked for compact JSON with concise Thai notes and portion descriptions, retaining all ingredient and nutrient fields. One enclosing `json` or unlabelled Markdown fence is accepted before strict JSON/schema validation; commentary, malformed JSON, nonnumeric nutrients, and truncated completions remain failures. Provider failures return HTTP 502 with safe codes such as `upstream_rate_limit`, `upstream_unavailable`, `network`, `invalid_response`, or `truncated_response`; timeouts return HTTP 504 with `timeout`. Thai messages suggest waiting, manually retrying, or entering data by hand.

For admitted photo requests only, the server writes one structured `photo_analysis` log with `quotaElapsedMs`, `providerElapsedMs`, `providerStatus` (null if no response arrived), `reason`, `catalogElapsedMs`, and `totalElapsedMs`. Total time starts after request validation and includes the database quota claim, provider request, and local catalog step; authentication and request parsing occur before this timer. Quota time records the separate database claim. Provider time starts only after admission and includes reading and validating its response; catalog time records the separate local lookup/matching step, with zero when skipped. Logs contain no image, dish/ingredient names, user identity, keys, endpoint URLs, or provider response bodies. These timings support diagnosis; the larger timeout improves tolerance for slow providers but does not establish a measured speed improvement.

## Optional verified food search

With `NUTRITION_API_KEY` configured, authenticated users may request `GET /api/foods/search?q=...`. The server calls the official USDA FoodData Central `https://api.nal.usda.gov/fdc/v1/foods/search` endpoint with the key held only on the server. It returns up to five results with USDA's FDC ID, a USDA FoodData Central source and result URL, and the available values reported per 100 g for energy (nutrient IDs 1008, then 2047/2048 fallback), carbohydrate (1005), protein (1003), fat (1004), and total sugars (2000/1063). Missing nutrient values are returned as `null` rather than estimated.

The USDA API requires a data.gov key and publishes a default rate limit of 1,000 requests per IP address per hour. See the official [FoodData Central API guide](https://fdc.nal.usda.gov/api-guide/) and [API specification](https://fdc.nal.usda.gov/api-spec/fdc_api.html). If the key is absent, food search returns HTTP 503 and no USDA request is made.
