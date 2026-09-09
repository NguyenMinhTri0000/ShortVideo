---
id: TASK-021
title: AI Video Publishing Metadata Generator (Title, Caption, Hashtags) in Create Publishing Job
status: COMPLETED
priority: high
depends_on: []
---

# Objective
Add an AI-powered Title, Caption, and Hashtag generator for video publishing jobs under the "Create Publishing Job" tab in the Publishing Dashboard.

# Context
Users publishing videos across TikTok, YouTube Shorts, Reels, and Facebook need engaging titles, captivating captions, and relevant hashtags.
Currently, in `PublishingDashboard.tsx`, post title, caption, and hashtags must be manually typed or pre-filled with raw video titles.

# Requirements
1. **Backend Endpoint**:
   - Add `POST /publishing/generate-metadata` in `PublishingController`.
   - Accept payload `GeneratePublishingMetadataDto` (`videoId`, `title`, `script`, `topic`, `tone`, `platform`, `language`).
   - Look up video, script, and idea details if `videoId` is provided.
   - Integrate with `LlmService` to generate structured metadata: `title`, `caption`, `hashtags` (array & string).
   - Support graceful fallback error messages if LLM key is missing or generation fails.

2. **Frontend UI Integration**:
   - In `PublishingDashboard.tsx` under "Create Publishing Job", add a prominent "✨ AI Generate Title & Caption" button in the Post Metadata section.
   - Allow optional tone selection (e.g. "Viral", "Engaging", "Sales", "Informative") and topic prompt override.
   - When clicked, fetch generated metadata from backend and auto-fill Title, Caption/Description, and Hashtags fields.
   - Provide loading state, success toast/feedback, and option to regenerate.

3. **Testing & Quality Assurance**:
   - Add NestJS unit tests for `generateMetadata` endpoint and service method.
   - Add React testing library unit tests in `PublishingDashboard.test.tsx` for AI metadata generation.
   - Ensure zero ESLint regression (`npm run lint`).

# Acceptance Criteria
- [ ] `POST /publishing/generate-metadata` returns `{ title, caption, hashtags }` generated via active AI LLM provider.
- [ ] Front-end "Create Publishing Job" tab features an "AI Generate" button that populates Title, Caption, and Hashtags with AI suggestions.
- [ ] Handles video script/title context automatically if a video is selected.
- [ ] Backend tests and Frontend tests pass without regressions.
- [ ] Zero ESLint errors introduced (error count <= 833).

# Verification Plan
- Unit tests: `npm test` in backend and frontend.
- Manual API & UI flow check.
- Lint check: `npm run lint`.

# Files Likely Affected
- `backend/src/modules/publishing/publishing.controller.ts`
- `backend/src/modules/publishing/publishing.service.ts`
- `backend/src/modules/publishing/publishing.module.ts`
- `backend/src/modules/llm/llm.service.ts`
- `frontend/src/components/PublishingDashboard.tsx`
- `frontend/src/components/__tests__/PublishingDashboard.test.tsx`
