---
id: TASK-006
title: Harden content strategy pipeline against TypeErrors and unhandled 500 errors
status: COMPLETED
priority: high
depends_on: []
---

# Objective
Harden `buildResearchContext`, `buildFallbackIdeas`, and `executeStrategyPipeline` in `ContentStrategyService` to safely handle non-array product properties (`features`, `benefits`, `painPoints`, `usp`, etc.) and ensure top-level exception handling catches all errors, returning clear responses instead of raw HTTP 500 errors.

# Context
If a `Product` record in the database has non-array types for `features`, `benefits`, `painPoints`, `usp`, `pros`, `cons`, or `useCases`, calling `.join()` or `.[0]` throws an uncaught `TypeError: product.features.join is not a function`.
Because `buildResearchContext` was invoked outside the LLM `try/catch` block, any TypeError crashed `executeStrategyPipeline` and caused NestJS to return HTTP status 500 ("Request failed with status code 500").

# Requirements
- Implement helper functions `safeArrayJoin` and `firstArrayItem` to safely process product attributes regardless of whether they are arrays, strings, null, or undefined.
- Move `buildResearchContext` inside the LLM execution `try/catch` block in `executeStrategyPipeline`.
- Wrap the entire `executeStrategyPipeline` and `generateContentIdeas` in top-level try/catch blocks so no unhandled exception can bubble up as a 500 error.
- Verify all unit tests pass.

# Acceptance Criteria
- Products with null/string/non-array research attributes generate ideas without throwing TypeErrors.
- `POST /products/:id/content-ideas/generate` never returns unhandled HTTP 500 error.
- All unit tests in `/backend` pass.

# Verification
- Run `npm test` in `/backend`.

# Files Likely Affected
- `backend/src/modules/content-strategy/content-strategy.service.ts`
- `backend/src/modules/content-strategy/content-strategy.controller.ts`
- `backend/src/modules/content-strategy/content-strategy.spec.ts`
