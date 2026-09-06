---
id: TASK-012
title: Fix CLI execution exit code null false failure and enhance video processor completion check
status: COMPLETED
priority: high
depends_on: []
---

# Objective
Fix false failure error `"CLI execution failed with exit code null"` in `VideoProcessor` when Python video engine finishes successfully, and expand rendering progress log match patterns.

# Context
In `backend/src/modules/queue/video.processor.ts`, `pyProcess.on('close', (code, signal))` evaluated `code !== 0`.
When the Python engine process finished or stdio closed under process wrappers like `uv`, Node's `close` callback receives `code = null`. In JavaScript, `null !== 0` evaluates to `true`, triggering a false job failure error: `"CLI execution failed with exit code null"`.
The job was failed despite `final-1.mp4` being created and the Python task logging `SUCCESS`.

# Requirements
1. **Completion Check Improvement**:
   - In `backend/src/modules/queue/video.processor.ts`, treat process completion as successful if `code === 0` OR if the generated video file `final-1.mp4` exists in `taskStorageDir`.
2. **Signal & Error Diagnostics**:
   - Log `signal` alongside `code` in error logging.
   - When fetching `lastErrorLog`, exclude messages containing `'SUCCESS'` to ensure true error messages are surfaced when actual failures occur.
3. **Progress Tracking during Video Rendering**:
   - Add log pattern matches for `concatenating`, `video combining completed`, `combining video` so job progress updates appropriately during long ffmpeg/moviepy video rendering steps.

# Acceptance Criteria
- [x] `video.processor.ts` logic updated to handle `code === null` when `final-1.mp4` exists.
- [x] Additional ffmpeg log patterns recognized for progress reporting.
- [x] Backend typecheck (`npm run build` or `npx tsc --noEmit`) passes cleanly.
- [x] Verification Gate passes without lint regression.

# Files Likely Affected
- `backend/src/modules/queue/video.processor.ts`
