---
id: TASK-019
title: Fix connected platform account UI filtering and accountId generation fallback
status: IN_PROGRESS
priority: high
depends_on: []
---

# Objective
Fix the issue where newly connected platform accounts (e.g. manually added YouTube, TikTok, Facebook, Instagram channels or OAuth channels) display as "NOT CONNECTED" in the UI despite being successfully saved in the backend.

# Context
In `PublishingDashboard.tsx` (line 433), connected accounts were filtered using:
`a.status === "ACTIVE" && a.accountId && !["facebook_page", "instagram_account", "tiktok_user", "youtube_channel"].includes(a.accountId)`
When accounts were created without an explicit `accountId` (such as via manual entry or default OAuth fallbacks), `a.accountId` was `null` or matched a placeholder string, causing `accList` to evaluate to empty `[]`. As a result, the UI displayed "NOT CONNECTED" even though the database recorded the account.

Additionally, in `PublishingService.createAccount` (`publishing.service.ts`), `accountId` was stored as `null` if omitted, and `status` became `NOT_CONFIGURED` if no token was supplied.

# Requirements
1. **Backend `accountId` & Status Fallback**:
   - In `PublishingService.createAccount` (`publishing.service.ts`), generate a unique fallback `accountId` (e.g. `${platform.toLowerCase()}_acc_${Date.now()}`) if `dto.accountId` is not provided.
   - Set account `status` to `ACTIVE` whenever an account is manually created or connected.
2. **Frontend Account Filtering Fix**:
   - In `PublishingDashboard.tsx`, update the filter logic for `accList` so that any account belonging to the platform with status `ACTIVE` (or not `DISCONNECTED`) is rendered.
   - Ensure connected accounts are properly listed under their respective platform cards and select options.
3. **Verification**:
   - Run backend unit tests (`npm run test`).
   - Run production builds (`npm run build` in `/backend` and `/frontend`).

# Acceptance Criteria
- Manually created or OAuth-connected platform accounts appear under the platform card as "CONNECTED".
- The account name and actions (disconnect/delete) render properly.
- All backend tests and frontend builds pass cleanly.

# Files Likely Affected
- `backend/src/modules/publishing/publishing.service.ts`
- `backend/src/modules/publishing/publishing.service.spec.ts`
- `frontend/src/components/PublishingDashboard.tsx`
