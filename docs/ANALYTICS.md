# Cross-Platform Analytics System

The **Cross-Platform Analytics** module collects, aggregates, and visualizes engagement and view metrics for published short videos across TikTok, YouTube Shorts, Instagram Reels, and Facebook Reels.

---

## 1. Core Principles

1. **Non-destructive Snapshots**: Analytics data is never overwritten. Every fetch creates a new immutable `PostAnalytics` snapshot with a timestamp (`collectedAt`).
2. **Background Collection**: Handled asynchronously via BullMQ `analytics-queue` at configurable intervals (1h, 6h, 24h, 48h, 7d).
3. **Decoupled Architecture**: Analytics functions independently of product research modules. Any video—old or new—supports analytics collection.

---

## 2. Collected Metrics

| Metric | Description | Nullable Support |
| :--- | :--- | :--- |
| `views` | Total video views / plays | Yes (defaults to 0) |
| `likes` | Total likes / reactions | Yes |
| `comments` | Total comments | Yes |
| `shares` | Total shares | Yes |
| `saves` | Total bookmarks / saved posts | Yes |
| `clicks` | Affiliate link clicks | Yes |
| `watchTime` | Total watch time (seconds) | Yes |
| `averageWatchTime` | Average watch time per view | Yes |
| `completionRate` | Video completion rate (%) | Yes |
| `engagementRate` | `(likes + comments + shares) / views` | Calculated |

---

## 3. Analytics Collector Schedule

When a video post transitions to `PUBLISHED`:
1. Initial collection job queued for **1 hour**.
2. Subsequent automatic snapshots scheduled for **6 hours**, **24 hours**, **48 hours**, and **7 days**.
3. Manual snapshot refresh triggered via `POST /api/analytics/collect/:jobId`.

---

## 4. Analytics APIs & Filtering

* `GET /api/analytics/overview` – High level summary, totals, best performing video, best platform, and platform comparison breakdown.
* `GET /api/analytics/top-performing` – Ranked list of top videos sorted by `views`, `likes`, `comments`, `shares`, or `engagementRate`.
* `GET /api/analytics/platforms/:platform` – Platform-specific analytics.
* `GET /api/analytics/videos/:videoId` – Multi-platform history and snapshots for a specific video.
* `GET /api/analytics/posts/:postId` – Time-series snapshot history for a post.
* `POST /api/analytics/collect/:jobId` – Trigger on-demand snapshot collection.

### Filter Parameters
* `dateRange`: `today`, `last7days`, `last30days`, `last90days`, `custom`
* `startDate`, `endDate`: ISO date strings (for `custom` range)
* `platform`: Filter by `TIKTOK`, `YOUTUBE`, `INSTAGRAM`, `FACEBOOK`
* `videoId`: Filter by specific video ID
