# Content Strategy / Content Idea Generator

The **Content Strategy & Content Idea Generator** is an engine layer placed between **Product Research** and **Video Script Generation**.

It allows AI to analyze researched product data to determine **WHAT content** to make before deciding **HOW** the video should be scripted.

---

## Architecture & Workflow

### Workflow Comparison

#### Legacy Workflow:
```
Product → Generate Video
```

#### New AI Content Strategy Workflow:
```
Product
   ↓
Product Research (Extract + AI Analysis + Content Brief)
   ↓
AI Content Strategy Service
   ↓
Multiple Content Ideas (10-20 distinct angles)
   ↓
User selects an idea
   ↓
Script Generation (Product + ContentIdea + ContentBrief)
   ↓
Existing Video Generator Pipeline (BullMQ + engine/cli.py)
```

---

## Data Model

The `ContentIdea` entity is defined in `backend/prisma/schema.prisma` and related to `Product`:

```prisma
model ContentIdea {
  id              String   @id @default(uuid())
  productId       String
  product         Product  @relation(fields: [productId], references: [id], onDelete: Cascade)
  title           String
  description     String
  contentType     String   // product_review, problem_solution, comparison, listicle, educational, storytelling, testimonial, myth_busting, use_case, value_for_money, pros_cons, FAQ
  marketingAngle  String
  targetAudience  String
  painPoint       String
  keyMessage      String
  hook            String
  recommendedCTA  String
  priority        Int      @default(1)
  status          String   @default("draft") // draft, selected, generated, archived
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@map("content_ideas")
}
```

### Supported Content Types (`contentType`)
- `product_review`: Honest overall review & key features walkthrough
- `problem_solution`: Focuses on customer pain point & product as solution
- `comparison`: Compares with traditional solutions or alternatives
- `listicle`: Top 3 reasons / 3 life hacks using the product
- `educational`: Practical tips, usage tutorials, how-to guide
- `storytelling`: Real-life scenario / relatable situation monologue
- `testimonial`: Customer review perspective and real reaction
- `myth_busting`: Dispels common misconceptions about the product
- `use_case`: Specific situation or environment usage scenario
- `value_for_money`: Price vs quality / ROI analysis
- `pros_cons`: Straightforward breakdown of advantages and limitations
- `FAQ`: Answers most frequently asked customer questions

---

## Content Strategy Service (`ContentStrategyService`)

Located at: `backend/src/modules/content-strategy/content-strategy.service.ts`

### Quality & Diversity Design
For every researched product, `ContentStrategyService`:
1. Collects all researched product data (`features`, `benefits`, `usp`, `painPoints`, `pros`, `cons`, `targetAudience`, `useCases`, `contentBrief`, `price`).
2. Enforces **AI Safety & Factual Accuracy**: AI strictly uses facts from Product Research (no hallucinated specifications, prices, or fake model numbers).
3. Generates **10 to 20 structured Content Ideas** covering diverse `contentType` angles.
4. Validates JSON schema output and stores draft items in the database.

---

## REST API Endpoints

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/products/:id/content-ideas/generate` | Generates 10-20 AI content ideas for a product |
| `GET` | `/api/products/:id/content-ideas` | Lists all content ideas generated for a product |
| `GET` | `/api/content-ideas/:id` | Gets details of a single content idea |
| `DELETE` | `/api/content-ideas/:id` | Deletes a content idea |
| `POST` | `/api/content-ideas/:id/generate-video` | Triggers existing video generation pipeline from selected idea |

---

## Script & Video Generator Integration

When a user selects a `ContentIdea` and triggers `POST /api/content-ideas/:id/generate-video`:
1. `ContentStrategyService` fetches the `ContentIdea` and associated `Product`.
2. It builds a rich prompt context containing:
   - **Content Strategy**: Title, content type, marketing angle, target audience, pain point, key message, opening 3s hook line, recommended CTA.
   - **Product Research**: Product name, brand, category, price, features, benefits, USP, target audience.
3. An `Idea` entity is created with status `ready`.
4. A `GenerationJob` entity is created with status `queued`.
5. The job is enqueued into BullMQ's `'video-generation'` queue (`QueueService.addVideoJob()`).
6. The existing `VideoProcessor` worker executes `engine/cli.py` to generate voiceover, script, subtitles, and render the final 9:16 short video.

### Backward Compatibility
- Old direct video generation flow (`POST /api/products/:id/generate-video` & `POST /api/ideas/:id/generate-video`) continues working without changes.

---

## Testing

Run the dedicated NestJS test suite:

```bash
npx jest content-strategy.spec.ts
```

Test suite covers:
1. `ContentIdea` entity creation and relation mapping.
2. `ContentStrategyService` generation pipeline logic.
3. AI structured JSON cleaning and schema validation.
4. Controller REST endpoints.
5. Integration test flow: Product → Generate Ideas → Save Ideas → Select Idea → Trigger Video Generation.
