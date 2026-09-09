---
id: TASK-017
title: Fix missing Pexels/Pixabay API key crash and ensure complete video generation
status: COMPLETED
priority: high
depends_on: []
---

# Objective
Fix the unhandled `ValueError` when `pexels_api_keys` (or other video material provider API keys) is not set in `config.toml`, allowing product visual clips to be used seamlessly for video generation without crashing the engine process. Run and verify the video generation process to completion.

# Context
When `video_source` is set to `pexels` (or default) and `pexels_api_keys` is empty `[]` in `config.toml`, `material.get_api_key("pexels_api_keys")` raises an unhandled `ValueError`. Because this exception occurs outside the search `try...except` block in `search_videos_pexels` (and similar provider functions in `material.py`), the CLI process terminates abruptly with `exit code 1`.

Even though product image clips (e.g. 21 clips) are successfully processed, the pipeline crashes before reaching the video composition phase.

# Requirements
1. Safely handle missing API keys in `search_videos_pexels`, `search_videos_pixabay`, `search_videos_coverr` in `engine/app/services/material.py`.
2. Move `get_api_key` calls inside `try...except (ValueError, Exception)` blocks so that key configuration errors log a warning and return empty video candidate lists `[]` rather than crashing the python execution.
3. Ensure `get_video_materials` in `engine/app/services/task.py` cleanly falls back to `product_clips` when B-roll API keys are missing or video downloads return empty lists.
4. Improve task error reporting when neither product clips nor B-roll materials can be downloaded, setting a user-friendly error message in task state instead of unhandled exception.
5. Re-trigger/run the video generation task for the active job (`5769e111-03b6-4b60-b711-6a16764d8dcf`) or run CLI test to verify full video generation success.

# Acceptance Criteria
- Engine CLI does not crash with `ValueError: pexels_api_keys is not set` when `pexels_api_keys` is empty.
- When product clips exist, video generation proceeds and completes successfully even if external video search API keys are missing.
- Unit/integration tests for material searching and task execution pass cleanly without regression.
- Video generation CLI runs through to successful completion.

# Verification
- Run engine tests (`pytest`).
- Execute CLI video generation to confirm full video rendering success.

# Files Likely Affected
- `engine/app/services/material.py`
- `engine/app/services/task.py`
