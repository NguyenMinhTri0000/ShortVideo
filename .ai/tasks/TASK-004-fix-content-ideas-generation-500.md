---
id: TASK-004
title: Fix HTTP 500 error on AI content ideas generation
status: COMPLETED
priority: high
depends_on: []
---

# Objective
Fix the HTTP 500 internal server error when generating content ideas via AI (`POST /products/:id/content-ideas/generate`).

# Context
When the user clicks "Tạo Ý Tưởng Nội Dung (AI)" on the Frontend (`products/page.tsx`), a request is dispatched to `POST /products/:id/content-ideas/generate`. The backend responds with status 500 ("Request failed with status code 500").
Possible root causes:
1. Default LLM fallback model in `llm.service.ts` / `content-strategy.service.ts` setting `gemini-3.6-flash` (non-existent Gemini model name) or missing API key handling causing uncaught exceptions.
2. Prisma database deletion cascade/foreign key constraints when running `contentIdea.deleteMany({ where: { productId, status: 'draft' } })`.
3. Missing or invalid response structure handling in `executeStrategyPipeline`.

# Requirements
- Ensure `POST /products/:id/content-ideas/generate` handles all potential exception paths gracefully and never fails with an uncaught HTTP 500 error.
- Fix invalid model default name (`gemini-3.6-flash` -> `gemini-2.0-flash` or standard supported model).
- Safeguard `deleteMany` and DB operations against foreign key conflict or record relation issues.
- Ensure proper rule-based fallback generation when LLM calls fail or API keys are unconfigured.

# Acceptance Criteria
- `POST /products/:id/content-ideas/generate` returns HTTP 200 with generated content ideas (either from LLM or rule-based fallback) even if LLM API is unavailable/misconfigured.
- Code passes all unit tests and baseline-aware linting verification gates.

# Verification
- Run `npm test` in `/backend`.
- Run baseline-aware ESLint check in `/backend`.

# Files Likely Affected
- `backend/src/modules/content-strategy/content-strategy.service.ts`
- `backend/src/modules/llm/llm.service.ts`
- `backend/src/modules/content-strategy/content-strategy.controller.ts`
