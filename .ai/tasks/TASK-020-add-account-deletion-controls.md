---
id: TASK-020
title: Add account deletion controls to Target Platforms & Accounts UI
status: COMPLETED
priority: high
depends_on: []
---

# Objective
Add account deletion controls (`Trash2` button with delete confirmation) directly on account items under the "Target Platforms & Accounts" list in `PublishingDashboard.tsx` so users can easily delete duplicate or accidentally added platform accounts.

# Context
Users can connect multiple accounts or add accounts manually. If duplicate or incorrect accounts are added (e.g. "Nguyen Minh Tri [YOUTUBE]" added twice), users need a quick delete action next to each account entry in the target accounts selection list as well as on the platform overview cards.

# Requirements
1. **Target Accounts Deletion UI**:
   - Add a Delete button (`Trash2` icon with `e.stopPropagation()`) next to each account item in the "Target Platforms & Accounts" list in `PublishingDashboard.tsx`.
   - Show confirm dialog before deletion ("Bạn có chắc chắn muốn xóa/ngắt kết nối tài khoản này không?").
   - Call `api.delete('/publishing/accounts/:id')` and immediately refresh account lists (`fetchData()`).
2. **Platform Overview Cards Deletion UI**:
   - Ensure the delete button is clearly visible and accessible on account items in the platform overview cards section.
3. **Verification**:
   - Run backend unit tests (`npm run test`).
   - Verify frontend build (`npm run build` in `/frontend`).

# Acceptance Criteria
- Delete button appears next to each account item in the Target Platforms & Accounts selection list.
- Clicking delete prompts user confirmation and successfully deletes the account from the backend DB.
- Account list refreshes automatically upon deletion.
- Frontend builds cleanly without error.

# Files Likely Affected
- `frontend/src/components/PublishingDashboard.tsx`
