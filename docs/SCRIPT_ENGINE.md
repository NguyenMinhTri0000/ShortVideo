# Script Engine 2.0

## 1. Overview & Architecture

Script Engine 2.0 acts as the core intelligence bridge between **Content Strategy (Content Ideas)** and **Video Generation**.

```
Product + Product Research
         ↓
  Content Strategy (10-20 Content Ideas)
         ↓
  🔥 Script Engine 2.0 (VideoScript)
         ↓
Legacy Renderer Adapter (Narration Concatenation)
         ↓
Existing Video Generation Engine → Final MP4 Video
```

The Script Engine transforms high-level marketing angles into structured, production-ready short-video scripts optimized for TikTok, YouTube Shorts, and Instagram Reels.

---

## 2. Input Data & Context Synthesis

Script Engine 2.0 consumes 4 key context components:

1. **Product**: Basic metadata (name, brand, price, currency, category).
2. **Product Research**: Factual research findings (features, benefits, USP, pain points, use cases, pros & cons).
3. **Content Brief**: Strategy parameters (target audience, main pain point, recommended hook, CTA).
4. **Content Idea**: Selected strategy angle (`title`, `contentType`, `marketingAngle`, `targetAudience`, `painPoint`, `keyMessage`, `hook`, `recommendedCTA`, `description`).

---

## 3. Data Models & Output Schema

### VideoScript Data Model

| Field | Type | Description |
|-------|------|-------------|
| `id` | String | Unique script identifier (UUID) |
| `productId` | String | Foreign key to Product |
| `contentIdeaId` | String? | Foreign key to ContentIdea |
| `title` | String | Script title |
| `duration` | Int | Total video duration in seconds (default: 30-45s) |
| `language` | String | Language code (default: `"vi"`) |
| `hook` | String | High-converting 1-3s opening line |
| `scenes` | Json | Array of `ScriptScene` objects |
| `cta` | String | Call to Action |
| `status` | String | Script status (`"ready"`, `"draft"`, `"generating"`, `"failed"`) |
| `createdAt` | DateTime | Timestamp of creation |
| `updatedAt` | DateTime | Timestamp of last update |

### Scene Structure (`ScriptScene`)

Each scene contains:

- `sceneNumber` (number): Sequential scene index (1-based).
- `startTime` (number): Scene start time in seconds.
- `endTime` (number): Scene end time in seconds.
- `duration` (number): Scene duration (`endTime - startTime`).
- `narration` (string): Conversational, TTS-friendly Vietnamese voiceover text.
- `onScreenText` (string): Concise (3-8 words), uppercase text overlay for mobile viewing.
- `visualDirection` (string): Detailed shot instruction corresponding to the narration.
- `mediaType` (enum): Preferred media source (`"product_image"`, `"product_video"`, `"stock_video"`, `"stock_image"`, `"ai_image"`, `"text_only"`).

Example JSON:

```json
{
  "title": "2.5 triệu mua nồi Philips có đáng không?",
  "duration": 38,
  "hook": "2.5 triệu cho một chiếc nồi chiên, liệu có thực sự đáng tiền?",
  "scenes": [
    {
      "sceneNumber": 1,
      "startTime": 0,
      "endTime": 4,
      "duration": 4,
      "narration": "2.5 triệu cho một chiếc nồi chiên, liệu có thực sự đáng tiền?",
      "onScreenText": "2.5 TRIỆU CÓ ĐÁNG?",
      "visualDirection": "Show product hero image with fast zoom",
      "mediaType": "product_image"
    },
    {
      "sceneNumber": 2,
      "startTime": 4,
      "endTime": 12,
      "duration": 8,
      "narration": "Dung tích 6.2 lít với công nghệ Rapid Air giúp giòn bên ngoài, mềm bên trong mà giảm tới 90% dầu mỡ.",
      "onScreenText": "6.2L - GIẢM 90% DẦU MỠ",
      "visualDirection": "Show close-up of digital control panel and cooking basket",
      "mediaType": "product_video"
    }
  ],
  "cta": "Xem ngay ưu đãi giá tốt nhất ở đường link bên dưới nhé!"
}
```

---

## 4. Short-Form Video Optimization Rules

1. **Target Duration**: 30 to 45 seconds (allows range 15 to 60 seconds).
2. **Hook**: Must occur in the first 1-3 seconds. Never starts with generic filler like *"Xin chào mọi người..."*.
3. **Voiceover (TTS)**: Natural, conversational Vietnamese. Avoids unnatural abbreviations, awkward jargon, or complex symbols.
4. **On-Screen Text**: Concise 3-8 words emphasizing key takeaways; readable on mobile.
5. **Visual Direction**: Explicit shot guidance matched to narration, favoring product-specific media (`product_image`, `product_video`) for product features.
6. **Factual Accuracy**: Factual claims are strictly grounded in Product Research. Never invents non-existent specifications.

---

## 5. Timing Validation & Normalization Rules

The system validates and normalizes all generated scripts:

- `startTime >= 0`
- `endTime > startTime`
- `duration = endTime - startTime`
- **Sequential Non-Overlapping**: `scene[i].startTime == scene[i-1].endTime`
- Total script duration equals the sum of scene durations.

If LLM output contains timing gaps or calculation errors, `ScriptEngineService` automatically recalculates sequential timestamps based on word counts (approx. 2.8 - 3 words per second, minimum 3s per scene).

---

## 6. API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/content-ideas/:id/generate-script` | Generates a new VideoScript from a ContentIdea |
| `GET`  | `/api/content-ideas/:id/scripts` | Gets all scripts generated for a ContentIdea |
| `GET`  | `/api/products/:id/scripts` | Gets all scripts generated for a Product |
| `GET`  | `/api/scripts/:id` | Gets details for a specific VideoScript |
| `POST` | `/api/scripts/:id/generate-video` | Converts script into legacy format and enqueues video rendering job |

---

## 7. Video Integration & Backward Compatibility

To preserve 100% backward compatibility with the existing video generation pipeline (`video.processor.ts` and `cli.py`):

1. `ScriptEngineService.videoScriptToLegacyText()` converts structured scenes into a plain-text narration string.
2. The service creates an `Idea` entity and a `GenerationJob` record linked to the product.
3. The job is enqueued to BullMQ queue (`video-generation`), executing the existing Python engine without altering the underlying renderer.

---

## 8. Testing

Run unit & integration tests:

```bash
docker exec videotool-backend npx jest src/modules/script-engine/script-engine.spec.ts
```
