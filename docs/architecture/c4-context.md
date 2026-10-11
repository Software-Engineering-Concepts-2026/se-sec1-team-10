# C4 Level 1: System Context

Reviewed against source on 11 October 2026. This view reflects integrations present in the current source. Optional external integrations are not evidence that a provider is configured or reachable in any deployment.

```mermaid
C4Context
    title LifeBalance System Context

    Person(user, "LifeBalance user", "Uses the browser app to manage a personal food and activity log")
    System(lifebalance, "LifeBalance", "Web application for recording meals and activity and viewing personal summaries")
    System_Ext(usda, "USDA FoodData Central", "Optional external food search and nutrition data API")
    System_Ext(ai, "OpenAI-compatible AI provider", "Optional provider for food-photo and ingredient estimates")

    Rel(user, lifebalance, "Records and reviews personal data", "HTTPS in production")
    Rel(lifebalance, usda, "Searches food data when configured", "HTTPS / JSON")
    Rel(lifebalance, ai, "Requests estimates when configured", "HTTPS / JSON")
```

The user personas under `docs/requirements/` are product context only. LifeBalance does not provide clinical or postpartum-care recommendations. Google Fit, Apple HealthKit, SendGrid, and FCM are not current integrations.

Food catalog lookup is internal to LifeBalance and is distinct from the optional USDA API. AI photo estimates are matched against catalog records when possible and remain subject to user review. Docker Hub, GitHub Actions and Render are delivery infrastructure, described in the [architecture overview](./README.md); they are not extra end-user features in this context view.
