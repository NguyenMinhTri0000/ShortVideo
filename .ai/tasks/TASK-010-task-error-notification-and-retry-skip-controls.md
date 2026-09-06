---
id: TASK-010
title: Add granular task error reporting and retry/skip controls
status: COMPLETED
priority: high
depends_on: []
---

# Objective
Enhance video generation task execution to record detailed step-level error messages in the task state, present clear error alerts with diagnostic details in the UI, and provide user options to retry the task or skip failing optional steps.

# Context
Currently, when a step in `engine/app/services/task.py` fails (such as audio generation, subtitle creation, or product image downloading), the task state is updated to `TASK_STATE_FAILED` with generic or missing error messages. The UI displays generic failure status without showing specific diagnostic logs or providing actionable control buttons to retry or skip optional steps (e.g. skip product images, skip subtitles, or fallback to broll).

# Requirements
1. Update `engine/app/services/task.py` and `engine/app/services/state.py`:
   - Store detailed error message (`error_msg`, `error_step`, `can_skip`, `can_retry`) in task state when `TASK_STATE_FAILED` occurs.
   - Support graceful retry and skip mechanisms for optional steps (e.g., subtitle fallback to Whisper/silent, product images fallback to local/broll materials).
2. Update backend task status APIs/types (`backend/src/modules/videos/` or relevant job status controllers) to expose `errorMsg`, `errorStep`, `canRetry`, `canSkip` to the frontend.
3. Update frontend jobs/video queue interface (`frontend/src/app/jobs/page.tsx` or job detail modal/cards):
   - Display actionable error callouts showing the exact error summary (e.g. HTTP 404 image download failure or subtitle creation error).
   - Add "Thử lại" (Retry) and "Bỏ qua bước này / Skip step" or "Tải lại với B-roll fallback" buttons for failed/warning tasks.

# Acceptance Criteria
- [ ] Engine records `error_msg` and `error_step` on task failures.
- [ ] Backend status API returns detailed error details for failed tasks.
- [ ] Frontend job management page (`/jobs`) displays actionable error details and clear "Thử lại" / Retry controls.
- [ ] Code builds without errors and ESLint baseline policy is maintained (errors <= 833).

# Verification
- Run backend and engine verification.
- Run frontend type check / lint.

# Files Likely Affected
- `engine/app/services/task.py`
- `engine/app/services/state.py`
- `engine/app/services/material.py`
- `backend/src/modules/videos/` (or job modules)
- `frontend/src/app/jobs/page.tsx`
