---
id: TASK-005
title: Sanitize invalid Gemini model names and add global exception handling for content generation
status: COMPLETED
priority: high
depends_on: []
---

# Objective
Automatically sanitize invalid/deprecated Gemini model names (such as `gemini-3.6-flash`) stored in database system settings to valid active models (`gemini-2.0-flash`), and add top-level fail-safe exception handling to prevent uncaught HTTP 500 errors.

# Context
The user's database `system_settings` table contains `gemini_model_name` = `"gemini-3.6-flash"`.
When `LlmService.getActiveProviderConfig()` queries `system_settings`, it returns `"gemini-3.6-flash"` instead of falling back to default.
Google Gemini API returns `404 NotFound` ("models/gemini-3.6-flash is not found"), causing LLM requests to fail.
Furthermore, unhandled exceptions during DB insertion or API invocation cause NestJS to throw HTTP status 500.

# Requirements
- In `LlmService.getActiveProviderConfig()`, sanitize the model name: if the configured Gemini model is invalid or matches known typos/invalid names like `gemini-3.6-flash`, normalize it automatically to `gemini-2.0-flash`.
- In `generateContentIdeas` and `executeStrategyPipeline`, wrap all execution blocks in top-level try-catch so that if any unexpected error occurs, a meaningful HTTP response / error details or fallback content ideas are returned, preventing raw HTTP 500 errors.
- Automatically heal database system settings if an invalid Gemini model string is detected.

# Acceptance Criteria
- `getActiveProviderConfig()` normalizes `gemini-3.6-flash` to `gemini-2.0-flash`.
- `POST /products/:id/content-ideas/generate` never crashes with uncaught 500.
- All unit tests pass.

# Verification
- Run `npm test` in `/backend`.

# Files Likely Affected
- `backend/src/modules/llm/llm.service.ts`
- `backend/src/modules/content-strategy/content-strategy.service.ts`
- `backend/src/modules/content-strategy/content-strategy.controller.ts`
