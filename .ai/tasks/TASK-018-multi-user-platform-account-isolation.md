---
id: TASK-018
title: Implement multi-user authentication and per-user platform account isolation
status: COMPLETED
priority: high
depends_on: []
---

# Objective
Enable multi-user authentication and user account switching so that each system User account owns and manages its own connected social platform accounts (YouTube, TikTok, Facebook, Instagram). For example, User 1 has YouTube 1 and TikTok 1, while User 2 has YouTube 2 and TikTok 2.

# Context
Currently, `PlatformAccount` has a `userId` relation in Prisma schema (`schema.prisma`), but `PublishingService` and `PublishingController` perform queries globally without filtering by `userId`. Additionally, there is no User authentication or user-switching mechanism in the NestJS backend or Next.js frontend, causing all connected platform accounts to be shared across all sessions.

# Requirements
1. **Backend Auth & User Management Module**:
   - Create an `AuthModule` (or `UsersModule`) in NestJS (`backend/src/modules/auth`) providing endpoints:
     - `GET /api/auth/users`: List available system user accounts (creating default seed users like User 1 and User 2 if none exist).
     - `POST /api/auth/login` / `POST /api/auth/register`: Authenticate/create system users.
     - `GET /api/auth/me`: Get active user profile based on `x-user-id` header or session token.
2. **Per-User Platform Account Isolation**:
   - Update `PublishingController` and `PublishingService`:
     - Extract `userId` from request headers (`x-user-id`) or query/params.
     - Filter `getAccounts(userId)` so each user only sees their own connected `PlatformAccount` entries.
     - Pass `userId` when creating accounts (`createAccount`) or handling OAuth callbacks (`handleOAuthCallback`).
     - Pass `userId` state in OAuth authorization URL (`getOAuthUrl`) to preserve user context across OAuth redirects.
     - Filter `PublishJobs` by `userId` (jobs created by or belonging to the user's platform accounts).
3. **Frontend User Switching & Account Display**:
   - Create a User Switcher component in `Sidebar.tsx` / Header so users can select between system accounts (User 1, User 2, etc.).
   - Update frontend API request helper (`frontend/src/lib/api.ts` or `PublishingDashboard.tsx`) to pass `X-User-Id` header on all API calls.
   - Update `PublishingDashboard.tsx` to automatically re-fetch and render connected accounts when active user changes.
4. **Automated Verification & Unit Tests**:
   - Add unit/integration tests in `publishing.service.spec.ts` and `auth.service.spec.ts` to verify per-user platform account isolation.
   - Ensure User 1 cannot view, delete, or publish using User 2's platform accounts.

# Acceptance Criteria
- User 1 and User 2 can be authenticated/selected in the application.
- Platform accounts (YouTube, TikTok, Instagram, Facebook) connected by User 1 are visible only to User 1.
- Platform accounts connected by User 2 are visible only to User 2.
- Unit/integration tests pass cleanly verifying per-user account isolation.
- `npm run build` and `npm run test` succeed without regressions.

# Verification
- Run backend unit tests (`npm run test` in `/backend`).
- Verify API endpoints for user accounts and per-user platform account filtering.
- Run baseline-aware linter checks.

# Files Likely Affected
- `backend/prisma/schema.prisma`
- `backend/src/modules/auth/` (NEW)
- `backend/src/modules/publishing/publishing.controller.ts`
- `backend/src/modules/publishing/publishing.service.ts`
- `backend/src/modules/publishing/publishing.service.spec.ts`
- `backend/src/app.module.ts`
- `frontend/src/components/Sidebar.tsx`
- `frontend/src/components/PublishingDashboard.tsx`
- `frontend/src/lib/api.ts`
