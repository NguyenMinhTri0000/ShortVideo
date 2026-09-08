---
id: TASK-014
title: Add feature to enable/disable subtitle generation step in video creation pipeline
status: COMPLETED
priority: high
depends_on: []
---

# Objective
Provide an explicit configuration to enable/disable the subtitle generation step during video generation, preventing unnecessary Whisper/Edge-TTS execution when subtitles are disabled, and updating the UI pipeline stepper to accurately reflect skipped subtitle generation.

# Context
Subtitle generation (using Whisper or Edge-TTS) is time-consuming (from ~30 seconds up to several minutes depending on GPU/CPU and audio duration).
Currently, even when `subtitle_enabled` is set to `false`, `generate_subtitle()` in `engine/app/services/task.py` prints `## generating subtitle` before returning, causing `video.processor.ts` to log state transitions to `generating_subtitle` and the frontend UI stepper (`JobsView.tsx`) to highlight the "Phụ đề" step.

# Requirements
1. **Engine Subtitle Skip**:
   - In `engine/app/services/task.py`, check `params.subtitle_enabled` at the beginning of `generate_subtitle()` BEFORE logging `## generating subtitle`.
   - If disabled, log `## subtitle generation disabled, skipping...` and return `""` immediately without emitting `## generating subtitle` status logs.
2. **Frontend UI Stepper Adaptability**:
   - In `frontend/src/components/JobsView.tsx`, update `PipelineStepper` to dynamically adjust the step timeline based on job configuration (`job.config?.subtitle_enabled`).
   - When subtitles are disabled (`subtitle_enabled === false` or `subtitle_enabled === "false"`), omit the "Phụ đề" step from `PIPELINE_STEPS` so the progress stepper transitions directly from `Giọng đọc` to `Tư liệu` / `Render`.
3. **Frontend Settings & Config Modal Alignment**:
   - Ensure `configSubtitleEnabled` in `ideas/page.tsx` initializes or falls back cleanly using default settings.
   - Clarify the subtitle toggle label and help text in UI forms.

# Acceptance Criteria
- [x] Disabling subtitles skips Whisper / Edge-TTS processing in Python engine without printing `## generating subtitle`.
- [x] Backend does not update job status to `generating_subtitle` when subtitles are disabled.
- [x] Frontend `JobsView.tsx` stepper dynamically removes/skips the "Phụ đề" step when viewing a job created with `subtitle_enabled: false`.
- [x] Video generation completes successfully without errors when subtitle generation is disabled.
- [x] Backend and Frontend builds and tests pass.

# Verification
- Run backend tests and linting.
- Run frontend typecheck/build.
- Verify python engine task execution logic.

# Files Likely Affected
- `engine/app/services/task.py`
- `frontend/src/components/JobsView.tsx`
- `frontend/src/app/ideas/page.tsx`
- `backend/src/modules/queue/video.processor.ts`
