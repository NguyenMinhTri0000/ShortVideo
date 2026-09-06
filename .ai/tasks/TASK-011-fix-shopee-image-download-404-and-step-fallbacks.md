---
id: TASK-011
title: Fix Shopee CDN image download HTTP 404 and implement robust step fallbacks
status: COMPLETED
priority: high
depends_on: ["TASK-010"]
---

# Objective
Fix product image download failures (HTTP 404 / 403 / anti-scraping on Shopee `susercontent.com` URLs) in `material.py`, add custom User-Agent / Referer headers, URL normalization, and implement robust material / subtitle fallback so video generation does not fail completely when product image URLs are unreachable.

# Context
Shopee image URLs like `https://down-vn.img.susercontent.com/file/...` or `https://cf.shopee.vn/file/...` may return HTTP 404 or HTTP 403 when downloaded with default `requests.get` without User-Agent headers, or when parameters/extensions are omitted. If images cannot be downloaded, `process_product_images()` returns `[]`, which currently causes the task to fail completely if no local broll is provided. Furthermore, subtitle generation should gracefully handle missing TTS markers or transcription timeouts.

# Requirements
1. Update `engine/app/services/material.py`:
   - Add browser-like User-Agent and Referer headers (e.g., `https://shopee.vn/`) to image HTTP requests.
   - Handle Shopee image URL patterns (append standard extension `_tn` / `.jpg` if missing or retry standard alternate CDN domains).
   - If image downloads fail or return 404, fallback to generating dynamic colored background text slides or fetching B-roll / solid aesthetic materials rather than setting `TASK_STATE_FAILED`.
2. Update `engine/app/services/task.py`:
   - Enforce fallbacks in `get_video_materials()`: if product images fail to download completely, generate fallback placeholder materials or switch to B-roll automatically with a warning in `task_status`.
   - In `generate_subtitle()`, ensure subtitle generation errors return empty string or fallback to whisper silently instead of crashing the task pipeline.

# Acceptance Criteria
- [ ] Shopee `susercontent.com` image downloads use proper User-Agent/Referer headers and handling.
- [ ] Task pipeline automatically falls back to B-roll / fallback visual slides when product image URLs return 404/errors, allowing video creation to complete successfully.
- [ ] Detailed warnings are stored in task metadata when fallbacks occur.
- [ ] Verification tests pass.

# Verification
- Run engine tests for image processing and material generation.

# Files Likely Affected
- `engine/app/services/material.py`
- `engine/app/services/task.py`
