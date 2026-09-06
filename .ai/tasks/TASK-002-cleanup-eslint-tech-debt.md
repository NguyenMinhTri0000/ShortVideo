---
id: TASK-002
title: Clean up existing ESLint technical debt
status: TODO
priority: medium
depends_on: []
---

# Objective
Systematically refactor TypeScript types and eliminate pre-existing ESLint technical debt (833 errors across backend and frontend) without introducing regressions or modifying application runtime behavior.

# Context
The baseline quality audit (`.ai/baseline.md`) identified 833 pre-existing ESLint errors (806 in `/backend`, 27 in `/frontend`) accumulated prior to setting up the Google Antigravity Autonomous Workflow. This task tracks the dedicated cleanup of that technical debt.

# Requirements
1. Refactor `@typescript-eslint/no-explicit-any` errors in `frontend/` (27 errors across `ideas/page.tsx`, `products/page.tsx`, `AnalyticsDashboard.tsx`, `PublishingDashboard.tsx`).
2. Refactor `@typescript-eslint/no-unsafe-assignment`, `@typescript-eslint/no-explicit-any`, and `@typescript-eslint/unbound-method` errors in `backend/` (806 errors).
3. Ensure `npm --prefix backend run lint` and `npm --prefix frontend run lint` both finish with exit code `0`.
4. Ensure zero regressions in unit tests (`npm test`, `pytest`) and builds (`nest build`, `next build`).

# Implementation Notes
- This task runs independently and does NOT block unrelated feature development tasks unless explicitly listed in their `depends_on` array.
- Do NOT use `eslint-disable` or `@ts-ignore` comments to bypass rules. Replace `any` with proper interfaces, generics, or unknown types.

# Acceptance Criteria
- [ ] Backend ESLint errors reduced to 0 (`npm --prefix backend run lint` exits with 0).
- [ ] Frontend ESLint errors reduced to 0 (`npm --prefix frontend run lint` exits with 0).
- [ ] All automated unit tests (`npm test`, `pytest`) continue to pass with exit code 0.
- [ ] Production builds (`nest build`, `next build`) compile cleanly with exit code 0.

# Verification
- `npm --prefix backend run lint` -> Exit Code 0
- `npm --prefix frontend run lint` -> Exit Code 0
- `npm --prefix backend test` -> Exit Code 0
- `pytest engine/test/` -> Exit Code 0

# Files Likely Affected
- `backend/src/**/*`
- `frontend/src/**/*`
- `.ai/baseline.md`
- `.ai/current-state.md`
