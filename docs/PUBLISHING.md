# Multi-Platform Publishing System

The **Multi-Platform Publishing** module enables automated, asynchronous publishing and scheduling of generated short videos to major social video platforms: **TikTok**, **YouTube Shorts**, **Instagram Reels**, and **Facebook Reels**.

---

## 1. Core Architecture

```
                                  PublishingManager (Service)
                                              │
                      ┌───────────────────────┼───────────────────────┐
                      ▼                       ▼                       ▼
               TikTokAdapter           YouTubeAdapter          InstagramAdapter       FacebookAdapter
```

The core `PublishingManager` (`PublishingService`) contains no platform-specific code. Platform interactions are delegated to dedicated `PlatformAdapter` implementations via the unified interface:

```typescript
export interface PlatformAdapter {
  readonly platform: PlatformType;
  isConfigured(): boolean;
  publish(account: PlatformAccount, params: PublishParams): Promise<PublishResult>;
  getPostStatus(account: PlatformAccount, platformPostId: string): Promise<PublishResult>;
  fetchAnalytics(account: PlatformAccount, platformPostId: string): Promise<PlatformMetrics>;
  getAuthUrl?(redirectUri: string, state?: string): OAuthAuthUrlResult;
  handleCallback?(code: string, redirectUri: string): Promise<OAuthTokenResult>;
  refreshAuthToken?(account: PlatformAccount): Promise<OAuthTokenResult>;
}
```

---

## 2. Platform Support & Credentials

| Platform | Supported Formats | Auth Type | Configured Env Variables Required | Functional Status |
| :--- | :--- | :--- | :--- | :--- |
| **TikTok** | Direct Post / Pull URL | OAuth 2.0 | `TIKTOK_CLIENT_ID`, `TIKTOK_CLIENT_SECRET` | Fully Implemented (marked `NOT_CONFIGURED` if keys missing) |
| **YouTube Shorts** | Resumable Video Insert | OAuth 2.0 | `YOUTUBE_CLIENT_ID`, `YOUTUBE_CLIENT_SECRET` | Fully Implemented (marked `NOT_CONFIGURED` if keys missing) |
| **Instagram Reels** | Content Publishing Graph API | Graph OAuth | `INSTAGRAM_CLIENT_ID`, `INSTAGRAM_CLIENT_SECRET` | Fully Implemented (marked `NOT_CONFIGURED` if keys missing) |
| **Facebook Reels** | Video Reels Graph API | Graph OAuth | `FACEBOOK_CLIENT_ID`, `FACEBOOK_CLIENT_SECRET` | Fully Implemented (marked `NOT_CONFIGURED` if keys missing) |

---

## 3. Security & Token Encryption

* Access and Refresh tokens are **encrypted at rest** in PostgreSQL using AES-256-GCM via `EncryptionService`.
* `EncryptionService.sanitizeAccount()` strips tokens from all API outputs, exposing only `hasAccessToken: boolean` and status metadata.
* Secrets and tokens are never logged.

---

## 4. Publishing Flow & Scheduling

1. **User Action**: User selects a generated video, targets platform accounts, customizes metadata (title, caption, hashtags, privacy), and chooses **Publish Now** or **Schedule**.
2. **Job Creation**: Creates a distinct `PublishJob` record for **each** selected platform.
3. **Queue Dispatch**: Pushes the job into the BullMQ `publishing-queue` with calculated delay (`scheduledAt - Date.now()`).
4. **Execution**: `PublishingProcessor` fetches video object stream from MinIO/S3 and delegates to the appropriate platform adapter.
5. **Confirmation**: Saves `platformPostId`, `platformUrl`, `publishedAt`, and `status = "PUBLISHED"`. Automatically triggers background analytics collection.

---

## 5. Duplicate Protection & Retry Mechanism

* **Duplicate Protection**: Rejects creation if an active job (`SCHEDULED`, `QUEUED`, `PUBLISHING`, `PUBLISHED`) already exists for the same `videoId` + `platformAccountId` unless `allowDuplicate=true` is set.
* **Retry System**: Failed jobs record `errorCode`, `errorMessage`, `retryCount`, and `lastAttemptAt`. Users can trigger manual retries via `POST /api/publishing/jobs/:id/retry`.

---

## 6. API Endpoints

* `GET /api/publishing/accounts` – List connected accounts (sanitized).
* `POST /api/publishing/accounts` – Connect new account.
* `DELETE /api/publishing/accounts/:id` – Disconnect account.
* `GET /api/publishing/accounts/:platform/connect` – Get OAuth auth URL.
* `GET /api/publishing/accounts/:platform/callback` – OAuth callback handler.
* `POST /api/publishing/jobs` – Create publish job(s).
* `GET /api/publishing/jobs` – Filter jobs by platform, status, or video.
* `GET /api/publishing/jobs/:id` – Retrieve detailed job status.
* `POST /api/publishing/jobs/:id/retry` – Retry failed publish job.
* `POST /api/publishing/jobs/:id/cancel` – Cancel scheduled/queued publish job.
