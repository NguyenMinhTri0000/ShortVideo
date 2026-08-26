# Product Research Engine Documentation

The **Product Research Engine** is a core module in the AI Affiliate Short-Video Generation System. It transforms raw product URLs into normalized factual data, AI marketing insights, and reusable Content Briefs used for short video production.

---

## 1. System Architecture

```
Product URL
    │
    ▼
POST /products/research
    │
    ▼
ProductResearchService (Creates Pending Product Record & Enqueues Job)
    │
    ▼
BullMQ Worker ('product-research' Queue) / Inline Fallback
    │
    ▼
ProductSourceAdapter Lookup
    ├── ShopeeAdapter
    ├── LazadaAdapter
    ├── TikTokShopAdapter
    ├── AmazonAdapter
    └── GenericProductAdapter (Fallback)
    │
    ▼
Layered Web Extraction Strategy
    ├── 1. JSON-LD / Schema.org Product (@type: Product, offers, aggregateRating)
    ├── 2. OpenGraph metadata (og:title, og:image, og:price)
    ├── 3. Standard HTML Meta tags
    └── 4. HTML DOM Fallbacks (Specifications tables, images, ratings)
    │
    ▼
AI Product Analysis (ProductAnalysisService)
    ├── Structured JSON Prompt
    ├── Factual vs. AI Marketing Insights Separation
    └── Safe Retries on JSON Syntax Errors
    │
    ▼
Product Content Brief (ContentBriefService)
    │
    ▼
PostgreSQL Database Update (Product Record marked as completed / partial)
```

---

## 2. Product Data Model

The `Product` database model in Prisma (`backend/prisma/schema.prisma`):

| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | String (UUID) | Primary Key |
| `name` | String | Extracted or AI product name |
| `brand` | String? | Product brand (e.g. Philips, Samsung) |
| `category` | String? | Categorization (e.g. Kitchen Appliance) |
| `description` | String? | Clean product description |
| `price` | String? | Formatted current price |
| `originalPrice` | String? | Pre-discount price |
| `currency` | String | Currency code (default: `VND`) |
| `discountPercent` | Float? | Calculated discount percentage |
| `rating` | Float? | Customer rating score (1-5) |
| `reviewCount` | Int? | Total review count |
| `affiliateUrl` | String | Target affiliate link |
| `sourceUrl` | String? | Original product URL |
| `sourcePlatform` | String? | Adapter used (`shopee`, `lazada`, `generic`, etc.) |
| `images` | String[] | Product image URLs |
| `videos` | String[] | Embedded product video URLs |
| `features` | String[] | Key features extracted |
| `specifications` | Json? | Key-value technical specifications |
| `benefits` | String[] | Customer benefits derived by AI |
| `pros` | String[] | Product pros |
| `cons` | String[] | Product cons |
| `targetAudience` | String? | Buyer persona description |
| `useCases` | String[] | Application scenarios |
| `usp` | String[] | Unique selling points |
| `painPoints` | String[] | Customer problems solved |
| `marketingAngles` | Json? | Array of `{ title, description, hook }` |
| `contentBrief` | Json? | Reusable Content Brief object |
| `researchStatus` | String? | `pending`, `processing`, `completed`, `failed`, `partial` |
| `researchError` | String? | Error message if research failed |
| `researchedAt` | DateTime? | Timestamp when research finished |

---

## 3. API Endpoints

### 1. Research Product from URL
- **Endpoint**: `POST /products/research` (or `/product-research`)
- **Request Body**:
```json
{
  "url": "https://shopee.vn/product/123/456"
}
```
- **Response**:
```json
{
  "success": true,
  "jobId": "102",
  "product": {
    "id": "uuid-string",
    "name": "Đang nghiên cứu sản phẩm...",
    "researchStatus": "processing"
  }
}
```

### 2. Get Product Research Status & Data
- **Endpoint**: `GET /products/:id/research`
- **Response**: Full `ProductResearchResult` object containing updated status and extracted/analyzed product metadata.

### 3. Product CRUD
- `GET /products`: List all products.
- `GET /products/:id`: Get single product details.
- `DELETE /products/:id`: Delete product.
- `POST /products/:id/generate-video`: Trigger video generation using product research context.

---

## 4. How to Add a New Platform Adapter

To support a new platform (e.g. Tiki, eBay, etc.):

1. Create a new adapter class in `backend/src/modules/product-research/adapters/`:
```typescript
import { ProductSourceAdapter } from './product-source.adapter';
import type { RawProductData } from '../types/product-research.types';

export class CustomAdapter extends ProductSourceAdapter {
  readonly name = 'custom_platform';

  canHandle(url: string): boolean {
    return url.includes('custom-platform.com');
  }

  async extract(url: string): Promise<RawProductData> {
    // Custom DOM or API extraction logic
  }
}
```

2. Register the adapter in `ProductResearchService` constructor (`product-research.service.ts`):
```typescript
this.adapters = [
  new ShopeeAdapter(),
  new CustomAdapter(), // <--- Insert before generic fallback
  new GenericProductAdapter(),
];
```

---

## 5. Running Tests

To run the automated Product Research test suite:
```bash
docker exec videotool-backend npm test -- backend/src/modules/product-research/product-research.spec.ts
```
