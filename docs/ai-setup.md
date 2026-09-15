# Food image analysis setup

LifeBalance can estimate meal ingredients and macronutrients from an image through a university-hosted, OpenAI-compatible Chat Completions service. The feature is server-side only: the browser never receives `AI_API_KEY`.

Set these values in the server's `.env` file:

```dotenv
# Use the provider base URL, or its complete Chat Completions endpoint.
AI_BASE_URL=https://ai.example.edu/v1
AI_API_KEY=your-university-issued-key
AI_MODEL=your-vision-capable-model-name
AI_DAILY_SCAN_LIMIT=50
# Optional, for verified USDA FoodData Central search results only.
NUTRITION_API_KEY=your-data-gov-api-key
```

`AI_BASE_URL` accepts a base URL such as `https://ai.example.edu/v1` or a full endpoint ending in `/chat/completions`. LifeBalance appends `/chat/completions` only when needed. The configured model must accept image data URLs in OpenAI-compatible `messages` input. For KKU, the tested base URL is `https://gen.ai.kku.ac.th/upacth/api/v1`.

Put actual credentials in the root `.env` file and save it in your editor. `.env.example` is a public template and must contain no real key. Restart the API after changing `.env`. `AI_API_KEY` is the university key; `NUTRITION_API_KEY` is a separate optional USDA/data.gov key. Food image estimation works without a USDA key. The two providers are currently separate entry methods: AI results are not automatically matched or verified against USDA.

Daily scan counts are currently in server memory and reset when the server restarts; they are not an account-wide provider token budget. Keep the university's own quota controls enabled.

The endpoint must use HTTPS in production. Plain HTTP is accepted only for `localhost`, `127.0.0.1`, or `::1` development endpoints. URLs containing credentials (`user:password@host`) or a fragment (`#...`) are rejected.

Leave any of the three AI settings blank to disable `POST /api/meals/analyze`. It then returns HTTP 503 and no provider request is made. `AI_DAILY_SCAN_LIMIT` must be a whole number from 1 through 50; its default is 50 analysis attempts per account per UTC calendar day. Do not put these settings in `VITE_*` variables, commit real keys, or send a key from the browser.

The endpoint requires an authenticated session and JSON from the configured app origin. It accepts `{ "imageData": "data:image/png;base64,..." }`, limits image data to 300,000 characters, allows ten attempts per account per 15 minutes, and times out provider calls after 15 seconds. A successful response is `{ "analysis": { ... } }`, where `analysis.source` is always `"ai-estimate"` and natural-language fields are requested in Thai. The result is for the user to verify before saving; this application does not claim it was checked against a nutrition database. A non-food image returns HTTP 422 with `{ "error": "not-food" }` and a Thai user-safe message.

## Optional verified food search

With `NUTRITION_API_KEY` configured, authenticated users may request `GET /api/foods/search?q=...`. The server calls the official USDA FoodData Central `https://api.nal.usda.gov/fdc/v1/foods/search` endpoint with the key held only on the server. It returns up to five results with USDA's FDC ID, a USDA FoodData Central source and result URL, and the available values reported per 100 g for energy (nutrient IDs 1008, then 2047/2048 fallback), carbohydrate (1005), protein (1003), fat (1004), and total sugars (2000/1063). Missing nutrient values are returned as `null` rather than estimated.

The USDA API requires a data.gov key and publishes a default rate limit of 1,000 requests per IP address per hour. See the official [FoodData Central API guide](https://fdc.nal.usda.gov/api-guide/) and [API specification](https://fdc.nal.usda.gov/api-spec/fdc_api.html). If the key is absent, food search returns HTTP 503 and no USDA request is made.
