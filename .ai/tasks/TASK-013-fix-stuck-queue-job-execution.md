---
id: TASK-013
title: Fix stuck queue job execution on job cancellation and handle orphan process cleanup
status: COMPLETED
priority: high
depends_on: []
---

# Objective
Fix the issue where cancelling a video generation job leaves BullMQ queue stuck in active state, preventing subsequent queued jobs from processing, and leaves orphan python/ffmpeg processes running in background.

# Context
When a job is cancelled in the UI:
1. `jobsService.cancel(id)` updates DB status to `cancelled` and calls `queueService.cancelJob(id)`.
2. `queueService.cancelJob` calls `job.discard()` for active jobs, but `discard()` in BullMQ does not remove/fail the job from Redis active set nor does it immediately resolve/reject the worker's processing Promise.
3. `killActiveProcess` only kills the immediate `pyProcess` child process with `SIGKILL`, leaving grandchild processes like `ffmpeg` running. Furthermore, if NestJS backend restarts, the in-memory `activeProcesses` map is lost, making `killActiveProcess` ineffective for surviving orphan processes.
4. Because `@Processor('video-generation', { concurrency: 1 })` waiting for the process Promise to settle, BullMQ holds 1/1 worker concurrency indefinitely, causing next jobs in queue (`Waiting` state) to sit at 0% indefinitely.

# Requirements
1. **Process Tree Termination**: Implement robust process tree killing (killing process group or searching child PIDs using SIGKILL) in `video.processor.ts` / `queue.service.ts` so python + ffmpeg processes are guaranteed killed on cancellation.
2. **BullMQ Active Job Cleanup**: In `cancelJob`, if a job is in `active` or `waiting` state, properly move it to failed or remove it from BullMQ queue, and trigger worker Promise rejection so the concurrency lock is immediately freed.
3. **Queue & DB Recovery on Startup / Processing**:
   - In `VideoProcessor`, check DB status or cancellation flag before and during processing. If job is already `cancelled` in DB or cancelled during execution, abort processing immediately.
   - On module startup or queue service init, sync BullMQ active jobs with DB states to purge orphaned active jobs in Redis.
4. **Verification**:
   - Verify active jobs in BullMQ and DB can be cancelled cleanly.
   - Verify queued jobs resume processing automatically after cancellation.

# Acceptance Criteria
- [ ] Cancelling an active or queued job terminates all child processes (python + ffmpeg).
- [ ] Cancelling an active job removes it from BullMQ `Active` queue state so the concurrency slot (1/1) is immediately freed.
- [ ] Subsequent queued jobs in BullMQ automatically start processing (progress increases > 0% to completion).
- [ ] System handles backend restart gracefully without leaving orphan active jobs blocking BullMQ.

# Verification
- Run tests in backend (`npm test`).
- Clean up current stuck active job in Redis/DB.
- Verify queued job processes successfully.

# Files Likely Affected
- `backend/src/modules/queue/queue.service.ts`
- `backend/src/modules/queue/video.processor.ts`
- `backend/src/modules/jobs/jobs.service.ts`
