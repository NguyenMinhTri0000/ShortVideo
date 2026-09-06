---
id: TASK-008
title: Fix TypeScript Build Error in ContentStrategyService
status: COMPLETED
priority: high
depends_on: []
---

# Objective
Fix the TypeScript compilation error TS2322 in `content-strategy.service.ts` where `item.priority` can be `undefined`, breaking `npm run build` and Docker image build for `backend`.

# Context
During `docker compose up -d --build`, backend build failed with:
`src/modules/content-strategy/content-strategy.service.ts:251:7 - error TS2322: Type '{ ... priority: number | undefined; ... }[]' is not assignable to type 'ContentIdeaResponse[]'.`

# Requirements
1. Ensure `priority` in `fallbackIdeas.map` defaults to `(index + 1)` or `item.priority ?? (index + 1)` so it is strictly `number`.
2. Run `npm run build` in `backend/` to verify zero TypeScript compilation errors.
3. Verify Docker build succeeds.

# Acceptance Criteria
- `npm run build` in `/backend` completes with exit code 0.
- Docker build for `videotool-backend` completes successfully.

# Verification
- Execute `npm run build` in `/backend`.
