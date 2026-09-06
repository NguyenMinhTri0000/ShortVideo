---
id: TASK-009
title: Add navigation button to video generation queue after Script 2.0 video creation
status: COMPLETED
priority: high
depends_on: []
---

# Objective
Provide a clear, seamless user interface mechanism to jump/navigate directly to the video generation queue (`/jobs`) after initiating video creation from Script 2.0 (Kịch bản 2.0).

# Context
In `frontend/src/app/products/page.tsx`, when users click "Tạo Video Từ Kịch Bản 2.0", `handleGenerateVideoFromScript` sends the request to the Video Generation Engine. Currently, it displays a standard browser `alert()` and closes the modal, leaving users without a direct, one-click shortcut to check the video status in the queue (`/jobs`).

# Requirements
1. Upgrade `frontend/src/app/products/page.tsx` (and `Script 2.0` creation flow) to present a modern custom success modal/dialog upon successfully queuing a video from Script 2.0.
2. The modal/toast dialog must feature:
   - Clear confirmation message that Script 2.0 video generation has been queued.
   - Primary action button: "Xem hàng đợi Video (Jobs)" or "Đến danh sách hàng chờ" that navigates to `/jobs` using Next.js router / Link.
   - Secondary action button: "Đóng" / "Ở lại trang" to dismiss.
3. Ensure proper state updates (`queryClient.invalidateQueries`) and smooth user navigation without breaking existing flows.

# Acceptance Criteria
- [ ] Clicking "Tạo Video Từ Kịch Bản 2.0" shows the success prompt/modal with the navigation button.
- [ ] Clicking "Xem hàng đợi Video (Jobs)" (or "Đến danh sách hàng chờ") redirects the user to `/jobs`.
- [ ] Clicking "Đóng" dismisses the modal and remains on the current page.
- [ ] Frontend builds without TypeScript errors (`npm run build` or `npx tsc --noEmit`).
- [ ] ESLint zero-regression check passes (errors <= 833).

# Verification
- Run TypeScript build check on `frontend`.
- Run frontend linter check to ensure baseline compliance.

# Files Likely Affected
- `frontend/src/app/products/page.tsx`
