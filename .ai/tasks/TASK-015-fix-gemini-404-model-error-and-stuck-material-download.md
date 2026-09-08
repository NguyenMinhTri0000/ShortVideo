---
id: TASK-015
title: Fix Gemini 404 Model Error and Stuck Video Material Download Loop
status: COMPLETED
priority: high
depends_on: []
---

# Objective
Fix the engine task hang issue where `generate_terms` returning an error string causes `get_video_materials` to iterate character-by-character over the error message, firing hundreds of HTTP requests and freezing video generation, and fix Gemini `gemini-2.0-flash` 404 model unavailable errors by setting standard active Gemini models and implementing automatic model fallbacks.

# Context
When running video generation, `gemini-2.0-flash` returned `404 POST https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent... This model models/gemini-2.0-flash is no longer available`.
`generate_terms()` in `engine/app/services/llm.py` caught this and returned the string `"Error: 404 POST..."`.
Because `generate_terms()` returned a `str` instead of a `List[str]`, downstream `get_video_materials()` passed the error string to `download_videos()`, which iterated character-by-character over every letter (`'E'`, `'r'`, `'r'`, `'o'`, `'r'`, `':'`, `' '`...), attempting Pexels/Pixabay searches for each letter and hanging video processing indefinitely without throwing a fatal exception.

# Requirements
1. **Fix Gemini Model 404 & Active Fallback**:
   - Update `_DEFAULT_GEMINI_MODEL` in `engine/app/services/llm.py` from `gemini-2.0-flash` to active standard model `gemini-1.5-flash` (or `gemini-2.5-flash`).
   - Add model fallback handling in `_generate_response_gemini()`: if the configured Gemini model returns 404 or model unavailable error, automatically try fallback models (`gemini-1.5-flash`, `gemini-2.5-flash`, `gemini-1.5-pro`).
2. **Prevent Error String Leakage in `generate_terms`**:
   - Fix `generate_terms()` in `engine/app/services/llm.py` so that it NEVER returns a raw error string `"Error: ..."`.
   - If terms generation fails, log the error clearly and return fallback terms derived from `video_subject` or an empty list `[]`.
3. **Defensive Type Checking in Material Search**:
   - In `engine/app/services/material.py` (`download_videos` and `_download_videos_by_script_order`) and `engine/app/services/task.py`, guard `search_terms` against non-list inputs:
     - If `search_terms` is a `str`, wrap it in a single-element list `[search_terms]` or fallback if it starts with `"Error"`.
     - Filter out single-character search terms or invalid strings.
4. **Backend Model Normalization**:
   - Ensure `LlmService` in `backend/src/modules/llm/llm.service.ts` normalizes Gemini model names to active supported models.

# Acceptance Criteria
- [x] `generate_terms()` returns a valid `List[str]` even if LLM fails, never a raw `str` error message.
- [x] `download_videos()` handles `search_terms` safely without iterating over individual characters of a string.
- [x] Gemini API requests use active model (`gemini-1.5-flash` / `gemini-2.5-flash`) and fall back gracefully on 404 errors.
- [x] All engine unit tests pass.

# Verification
- Run `pytest engine/` to verify unit tests.
- Run `npm --prefix backend test` or build check to ensure backend stability.

# Files Likely Affected
- `engine/app/services/llm.py`
- `engine/app/services/material.py`
- `engine/app/services/task.py`
- `backend/src/modules/llm/llm.service.ts`
