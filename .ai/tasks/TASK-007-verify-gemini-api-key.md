---
id: TASK-007
title: Verify Gemini API Key Functionality
status: COMPLETED
priority: high
depends_on: []
---

# Objective
Test and verify whether the Gemini API key currently configured in the database (`system_settings`) and/or environment is active, authorized, and able to generate AI content successfully.

# Context
The user requested: "Kiểm tra API key của Gemini đã hoạt động được chưa?"
The database setting `llm_provider` is set to `gemini`, `gemini_model_name` is set to `gemini-3.6-flash` (or valid model such as `gemini-2.5-flash` / `gemini-1.5-flash`), and `gemini_api_key` is stored in `system_settings`. We need to verify if calling Gemini API with this key works or if model names/API endpoints return valid completions or errors.

# Requirements
1. Extract `gemini_api_key` and configured Gemini model name from `system_settings` database table.
2. Test direct API call to Gemini API endpoints (e.g. `generativelanguage.googleapis.com` or backend `LlmService` endpoint).
3. If `gemini-3.6-flash` is used, handle fallback/sanitization to standard active models (`gemini-2.5-flash`, `gemini-1.5-flash`, `gemini-2.0-flash`) if 3.6 is an alias or invalid model name.
4. Report detailed status (HTTP response code, model tested, test generation payload/response, success/failure reason).

# Acceptance Criteria
- Executed empirical API call against Google Gemini API using the stored API key.
- Verified response from API (successful response text or exact error code e.g. 400, 401, 403, 404).
- Documented findings clearly for the user.

# Verification
- Run verification script calling Google Gemini REST API / SDK with the stored key.
