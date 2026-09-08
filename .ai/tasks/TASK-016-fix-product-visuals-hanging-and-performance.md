---
id: TASK-016
title: Fix Product Visual Processing Hang and Optimize Motion Clip Rendering Performance
status: COMPLETED
priority: high
depends_on: []
---

# Objective
Fix video task hanging at `get_video_materials` ("## processing product visuals (images & videos) for affiliate video"), add thread pool concurrent image/video downloads with stream timeouts, optimize MoviePy motion clip rendering speed (`preset="ultrafast"`, `threads=4`, pre-scaling PIL canvas), add progress logging, and guard `process_product_visuals` with try/except fallback.

# Context
When running affiliate video generation tasks, `get_video_materials()` logs `## processing product visuals (images & videos) for affiliate video` and then freezes/hangs.
Root causes identified:
1. `process_product_images` downloads image URLs sequentially over `requests.get()` without stream read timeouts, blocking on slow/unresponsive CDN socket reads.
2. `_create_motion_clip_from_image` opens high-resolution raw product images (e.g., 4000x4000) and applies heavy GaussianBlur/resizing, and calls MoviePy `final_clip.write_videofile()` on single-threaded CPU with default `medium` preset. Evaluated over 10-15 required clips, this takes 5-10 minutes with zero log output, appearing completely hung to users.
3. `write_videofile` without log/stderr management can cause ffmpeg process pipe deadlock.
4. `process_product_visuals()` in `task.py` was unhandled by try/except, causing silent deadlocks or unhandled exceptions.

# Requirements
1. **Concurrent Image/Video Downloading with Timeouts**:
   - In `engine/app/services/material.py` (`process_product_images` and `process_product_videos`), use `concurrent.futures.ThreadPoolExecutor` for parallel downloading.
   - Enforce explicit connection and read timeouts on `requests.get(..., timeout=(10, 15))`.
2. **Optimize Motion Clip Generation Speed**:
   - Pre-scale input images to target resolution before applying PIL filters.
   - In `_create_motion_clip_from_image`, pass `preset="ultrafast"`, `threads=4`, and `ffmpeg_params=["-pix_fmt", "yuv420p"]` to `write_videofile()`.
   - Parallelize image clip creation where appropriate or optimize loop execution.
3. **Progress Logging & Defensive Fallbacks**:
   - Log explicit progress lines during product image/video processing (e.g., `logger.info("Downloading product visual 1/5...")`, `logger.info("Rendering product clip 1/5...")`).
   - Wrap `process_product_visuals` in `task.py` with try/except, logging errors clearly and falling back to B-roll materials if product visual processing fails or yields no valid clips.

# Acceptance Criteria
- [x] Product visual image & video downloading runs concurrently with strict timeouts.
- [x] Motion clip rendering uses pre-scaling and `preset="ultrafast"` ffmpeg settings for high performance.
- [x] Task execution displays progress log lines during product visual generation.
- [x] `task.py` catches errors in `process_product_visuals` and falls back gracefully to B-roll videos without hanging.
- [x] All engine unit tests pass.

# Verification
- Run `pytest engine/` to verify tests pass.
- Build backend and frontend check.

# Files Likely Affected
- `engine/app/services/material.py`
- `engine/app/services/task.py`
