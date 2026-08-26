# Báo Cáo Phân Tích Codebase Repository: Short-Video (MoneyPrinterTurbo & Affiliate Automation Suite)

> **Ngày lập tài liệu:** 26/08/2026  
> **Phiên bản codebase:** Short-Video Enterprise Suite v2.0 (Next.js 15 Frontend + NestJS 10 Backend + Python Video Engine + Multi-Platform Publishing & Analytics)  
> **Người thực hiện:** Senior Software Architect & Codebase Analyst  
> **Ngôn ngữ:** Tiếng Việt (Tên Class, Function, File, API Endpoint, CLI Flag giữ nguyên tiếng Anh để truy vết code)

---

## MỤC LỤC
1. [Phần A — Tổng Quan Repository & Kiến Trúc Doanh Nghiệp](#phần-a--tổng-quan-repository--kiến-trúc-doanh-nghiệp)
2. [Phần B — Giải Thích Cấu Trúc Folder & Chi Tiết Các Thành Phần Quan Trọng](#phần-b--giải-thích-cấu-trúc-folder--chi-tiết-các-thành-phần-quan-trọng)
3. [Phần C — Phân Tích Toàn Bộ 15 Module Backend (NestJS API & Services)](#phần-c--phân-tích-toàn-bộ-15-module-backend-nestjs-api--services)
4. [Phần D — Phân Tích Chi Tiết Python Core Video Engine](#phần-d--phân-tích-chi-tiết-python-core-video-engine)
5. [Phần E — Database Schema & Data Models (PostgreSQL + Prisma ORM)](#phần-e--database-schema--data-models-postgresql--prisma-orm)
6. [Phần F — Queue System, Task Worker & Cơ Chế Phục Hồi Lỗi (Error Recovery)](#phần-f--queue-system-task-worker--cơ-chế-phục-hồi-lỗi-error-recovery)
7. [Phần G — Trace Các Luồng Xử Lý End-to-End (End-to-End Workflows)](#phần-g--trace-các-luồng-xử-lý-end-to-end-end-to-end-workflows)
8. [Phần H — AI Provider & LLM Architecture](#phần-h--ai-provider--llm-architecture)
9. [Phần I — TTS Pipeline (Text-to-Speech)](#phần-i--tts-pipeline-text-to-speech)
10. [Phần J — Image / Video / Product Visual & Stock Media Pipeline](#phần-j--image--video--product-visual--stock-media-pipeline)
11. [Phần K — Subtitle Engine & Video Rendering Engine](#phần-k--subtitle-engine--video-rendering-engine)
12. [Phần L — Multi-Platform Publishing & Analytics Engine](#phần-l--multi-platform-publishing--analytics-engine)
13. [Phần M — Configuration, Environment Variables & Docker Architecture](#phần-m--configuration-environment-variables--docker-architecture)
14. [Phần N — Hướng Dẫn Chạy & Vận Hành Hệ Thống Trên Linux Mint](#phần-n--hướng-dẫn-chạy--vận-hành-hệ-thống-trên-linux-mint)
15. [Phần O — Ma Trận Tính Năng Thực Tế Trong Codebase (Feature Matrix)](#phần-o--ma-trận-tính-năng-thực-tế-trong-codebase-feature-matrix)
16. [Phần P — Các Sơ Đồ Kiến Trúc & Luồng Dữ Liệu (Diagrams)](#phần-p--các-sơ-đồ-kiến-trúc--luồng-dữ-liệu-diagrams)
17. [Phần Q — Trả Lời Trực Tiếp Các Câu Hỏi Cốt Lõi Về Codebase](#phần-q--trả-lời-trực-tiếp-các-câu-hỏi-cốt-lõi-về-codebase)
18. [Danh Sách Vấn Đề Kỹ Thuật & Cấu Hình Lưu Ý (Known Issues / Operational Notes)](#danh-sách-vấn-đề-kỹ-thuật--cấu-hình-lưu-ý-known-issues--operational-notes)

---

## Phần A — Tổng Quan Repository & Kiến Trúc Doanh Nghiệp

### 1. Repository này dùng để làm gì?
Repository này là một hệ thống tự động hóa sáng tạo short video (khổ 9:16 hoặc 16:9) và quản lý chiến dịch **Affiliate Video Marketing đa nền tảng (Multi-Platform Affiliate Video Automation)**. Hệ thống có khả năng:
1. **Nghiên cứu sản phẩm tự động (Product Research)**: Trích xuất thông tin sản phẩm từ link Shopee, Lazada, TikTok Shop, Amazon hoặc website bất kỳ, sau đó dùng AI phân tích USP, tính năng, đối tượng mục tiêu, rào cản mua hàng (pain points) và góc nhìn truyền thông (marketing angles).
2. **Lên chiến lược nội dung (Content Strategy)**: Tự động đề xuất các ý tưởng video (review sản phẩm, giải quyết vấn đề, so sánh, mẹo sử dụng, bóc phốt/myth busting, storytelling...) tối ưu cho từng sản phẩm.
3. **Sinh kịch bản chi tiết (Script Engine)**: Tạo kịch bản phân cảnh (multi-scene script) gồm Hook 0-3s, vấn đề, giải pháp sản phẩm, lợi ích cốt lõi và Call-To-Action (CTA) dẫn link Affiliate.
4. **Tạo Video tự động (Core Video Engine)**: 
   - Gọi LLM sinh text kịch bản & từ khóa tìm B-roll.
   - Gọi Cloud TTS (Edge-TTS miễn phí hoặc Azure/Gemini/ElevenLabs) sinh giọng đọc tiếng Việt chuẩn.
   - Tạo file phụ đề SRT khớp timestamp chính xác.
   - Thu thập video stock (Pexels, Pixabay, Coverr) hoặc xử lý ảnh/clip sản phẩm thực tế (Product Visuals).
   - Trộn âm thanh, đè phụ đề chữ, nhạc nền (BGM) và xuất file `.mp4` hoàn chỉnh bằng MoviePy & FFmpeg.
5. **Đăng video đa nền tảng (Multi-Platform Publishing)**: Quản lý tài khoản mạng xã hội (TikTok, YouTube, Instagram, Facebook), lên lịch đăng (schedule) và tự động đăng video qua API.
6. **Thu thập & Phân tích chỉ số (Analytics)**: Tự động đo lường lượt xem (views), thích (likes), bình luận (comments), chia sẻ (shares), lưu (saves), click link affiliate và tỷ lệ tương tác (engagement rate) theo thời gian thực.

---

### 2. Kiến Trúc 3 Lớp Doanh Nghiệp (Three-tier Enterprise Architecture)
Repository được tổ chức theo kiến trúc 3 lớp rõ ràng:
* **Lớp 1 — Frontend (Web User Interface)**: Viết bằng **Next.js 15 + React 19 + Tailwind CSS + TanStack Query**, nằm ở thư mục `frontend/`. Cung cấp giao diện quản trị Dashboard, Quản lý Sản phẩm Affiliate, Tạo Ý tưởng & Kịch bản, Theo dõi Tiến trình Render real-time, Quản lý Đăng bài đa nền tảng và Báo cáo Phân tích Analytics.
* **Lớp 2 — Backend Core & Task Queue**: Viết bằng **NestJS (TypeScript) + Prisma ORM + PostgreSQL 15 + BullMQ / Redis 7 + MinIO S3 Storage**, nằm ở thư mục `backend/`. Đảm nhận vai trò API Gateway, xác thực, quản lý database, cào dữ liệu sản phẩm, phân tích AI, lập lịch queue, điều phối Python worker và lưu trữ media.
* **Lớp 3 — Video Generation Engine**: Viết bằng **Python 3.11 + MoviePy 2.x + FFmpeg + Edge-TTS + Google Gemini / OpenAI SDKs**, nằm ở thư mục `engine/`. Đảm nhận nhiệm vụ nặng nhất là xử lý đồ họa, ghép nối clip, tổng hợp âm thanh và render video MP4. Engine hỗ trợ cả giao diện dòng lệnh CLI (`cli.py`) lẫn REST API Server (`main.py`).

---

### 3. Technology Stack Chi Tiết
| Thành phần | Công nghệ sử dụng | Đường dẫn source code |
| :--- | :--- | :--- |
| **Frontend UI** | Next.js 15 (App Router), React 19, Tailwind CSS, Lucide React, TanStack Query | `frontend/src/` |
| **Backend API Gateway** | NestJS 10, TypeScript, Validation Pipes, Swagger UI | `backend/src/` |
| **Database & ORM** | PostgreSQL 15, Prisma ORM (11 models) | `backend/prisma/schema.prisma` |
| **Queue / Task Processing**| BullMQ, Redis 7 (3 Queues: `video-generation`, `product-research`, `publish-job`) | `backend/src/modules/queue/` |
| **Object Storage** | MinIO S3 Compatible Storage | `backend/src/modules/storage/` |
| **Product Scraper / Adapters**| Shopee, Lazada, TikTok Shop, Amazon, Generic HTML Parser | `backend/src/modules/product-research/adapters/` |
| **Python Video Engine** | Python 3.11, MoviePy 2.x, FFmpeg, Pillow (PIL), NumPy | `engine/app/services/video.py` |
| **LLM Providers** | Cloud API: Google Gemini (`gemini-2.5-flash`), OpenAI, DeepSeek, Qwen, Ollama, AIHubMix | `engine/app/services/llm.py` & `backend/src/modules/llm/` |
| **TTS Providers** | Edge-TTS (Azure V1 free), Azure V2, SiliconFlow, Gemini, ElevenLabs, OpenAI TTS | `engine/app/services/voice.py` |
| **Stock & Material Media** | Pexels API, Pixabay API, Coverr API, Product Image Processor, Local files | `engine/app/services/material.py` |
| **Multi-Platform Publishing** | TikTok API, YouTube Data API v3, Instagram Graph API, Facebook Graph API | `backend/src/modules/publishing/adapters/` |
| **Containerization** | Docker, Docker Compose (`postgres`, `redis`, `minio`, `backend`, `frontend`) | `docker-compose.yml`, `Dockerfile` |

---

## Phần B — Giải Thích Cấu Trúc Folder & Chi Tiết Các Thành Phần Quan Trọng

### 1. Cấu trúc cây thư mục toàn bộ Repository
```text
short-video/
├── backend/                      # NestJS Backend API Service (Port 23001)
│   ├── prisma/
│   │   └── schema.prisma         # Định nghĩa 11 Database Schema Models (PostgreSQL)
│   ├── src/
│   │   ├── main.ts               # Entry point NestJS (Auto db push, stuck job recovery, CORS)
│   │   ├── app.module.ts         # Root module đăng ký 15 feature modules
│   │   └── modules/              # 15 Modules nghiệp vụ chính:
│   │       ├── analytics/        # Module thu thập & báo cáo chỉ số Video/Post
│   │       ├── content-strategy/ # Module tạo ý tưởng nội dung theo chiến lược
│   │       ├── database/         # Prisma Database Client Wrapper Service
│   │       ├── ideas/            # Quản lý Ý tưởng (Ideas API) & Auto-script
│   │       ├── jobs/             # Quản lý Tiến trình Render Video (Jobs API)
│   │       ├── llm/              # Backend LLM Service Provider Wrapper
│   │       ├── product-research/ # Module cào dữ liệu sản phẩm (Shopee/Lazada/TikTok/Amazon) & AI Analysis
│   │       ├── product-visuals/  # Module xử lý hình ảnh sản phẩm 9:16
│   │       ├── products/         # Quản lý Sản phẩm Affiliate (Products API)
│   │       ├── publishing/       # Module kết nối tài khoản & đăng bài đa nền tảng
│   │       ├── queue/            # BullMQ Worker điều phối Python CLI (`video.processor.ts`)
│   │       ├── script-engine/    # Module sinh kịch bản phân cảnh đa định dạng (VideoScript)
│   │       ├── settings/         # Quản lý cấu hình hệ thống (System Settings)
│   │       ├── storage/          # MinIO S3 Object Storage Client Service
│   │       └── videos/           # Quản lý kết quả Video hoàn chỉnh & Metadata
├── engine/                       # Python Core Video Engine (MoneyPrinterTurbo Core)
│   ├── main.py                   # FastAPI REST API Server Entry Point (Port 8080)
│   ├── cli.py                    # Command Line Interface chính (được BullMQ Worker gọi)
│   ├── config.example.toml       # Template cấu hình API Keys & tham số mặc định
│   ├── config.toml               # File cấu hình thực tế khi chạy môi trường
│   ├── app/
│   │   ├── config/config.py      # Module load `config.toml` và môi trường env
│   │   ├── controllers/          # FastAPI REST Controllers
│   │   ├── models/schema.py      # Dataclasses & Pydantic Schemas (`VideoParams`, `MaterialInfo`)
│   │   ├── services/             # Core Services:
│   │   │   ├── task.py           # Orchestrator chính của pipeline video Python (6 bước)
│   │   │   ├── llm.py            # Module gọi Gemini / OpenAI / DeepSeek...
│   │   │   ├── voice.py          # Module xử lý TTS (Edge-TTS, Azure, Gemini,...)
│   │   │   ├── material.py       # Module tìm stock (Pexels/Pixabay) & xử lý ảnh sản phẩm
│   │   │   ├── subtitle.py       # Module sinh file phụ đề `.srt`
│   │   │   ├── video.py          # Core ghép clip, render MoviePy & FFmpeg
│   │   │   └── twelvelabs.py     # Module AI TwelveLabs (Rerank B-roll)
│   │   └── utils/                # Helper mã hóa, uuid, file protection
│   └── webui/
│       └── Main.py               # Giao diện Streamlit cũ (chạy độc lập)
├── frontend/                     # Next.js Web Dashboard Application (Port 23000)
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx          # Redirect tự động sang `/dashboard`
│   │   │   ├── dashboard/        # Màn hình Tổng quan hệ thống
│   │   │   ├── products/         # Màn hình Quản lý Sản phẩm Affiliate & Cào dữ liệu
│   │   │   ├── ideas/            # Màn hình Quản lý Ý tưởng
│   │   │   ├── publishing/       # Màn hình Quản lý Đăng bài đa nền tảng (PublishingDashboard)
│   │   │   ├── analytics/        # Màn hình Báo cáo Chỉ số Tương tác (AnalyticsDashboard)
│   │   │   ├── jobs/             # Màn hình Theo dõi Tiến trình Render real-time & Log
│   │   │   ├── videos/           # Màn hình Danh sách Video đã export & Preview
│   │   │   └── settings/         # Màn hình Cấu hình API Keys & Hệ thống
│   │   ├── components/           # UI Components (`Sidebar`, `JobsView`, `PublishingDashboard`, `AnalyticsDashboard`, `Toast`)
│   │   └── lib/                  # API Clients (`api.ts`, `backend-media.ts`)
├── docker-compose.yml            # Docker Compose full-stack (Postgres, Redis, MinIO, Backend, Frontend)
├── docker-compose.release.yml    # Docker Compose bản Release
├── docker-compose.gpu.yml        # Docker Compose cấu hình tăng tốc GPU
├── Dockerfile                    # Dockerfile build Python Core Engine / Standalone Streamlit
├── Dockerfile.gpu                # Dockerfile cho môi trường CUDA GPU
└── docs/
    └── REPOSITORY_ANALYSIS_VI.md # Tài liệu Phân tích Kiến trúc Hệ thống (File hiện tại)
```

---

## Phần C — Phân Tích Toàn Bộ 15 Module Backend (NestJS API & Services)

Backend NestJS đóng vai trò trung tâm điều phối của toàn bộ hệ thống. Dưới đây là chi tiết từng module:

### 1. `DatabaseModule` (`backend/src/modules/database/`)
* **Vai trò:** Wrapper đóng gói Prisma Client (`PrismaService`).
* **Tính năng:** Quản lý kết nối PostgreSQL, lifecycle hooks (`onModuleInit`, `onModuleDestroy`), hỗ trợ transaction và query helper.

### 2. `StorageModule` (`backend/src/modules/storage/`)
* **Vai trò:** Quản lý Object Storage MinIO (S3 Compatible).
* **Service:** `StorageService`.
* **Tính năng:** Tự động tạo bucket (`videos`), upload file (`putObject`), lấy presigned URL (`getPresignedUrl`), kiểm tra file tồn tại và xóa file.

### 3. `LlmModule` (`backend/src/modules/llm/`)
* **Vai trò:** Backend LLM Proxy Service.
* **Service:** `LlmService`.
* **Tính năng:** Cung cấp API sinh text từ LLM cho các module backend khác, kết nối với Gemini hoặc OpenAI.

### 4. `IdeasModule` (`backend/src/modules/ideas/`)
* **Controller:** `IdeasController` (`@Controller('ideas')`).
* **Endpoints:**
  - `POST /api/ideas`: Tạo ý tưởng mới.
  - `POST /api/ideas/brainstorm`: AI gợi ý ý tưởng theo từ khóa/chủ đề.
  - `POST /api/ideas/batch-generate-video`: Sinh hàng loạt video từ danh sách ý tưởng.
  - `GET /api/ideas`: Lấy danh sách ý tưởng.
  - `GET /api/ideas/:id`: Lấy chi tiết ý tưởng.
  - `PATCH /api/ideas/:id`: Cập nhật ý tưởng.
  - `DELETE /api/ideas/:id`: Xóa ý tưởng.
  - `POST /api/ideas/:id/generate-script`: Tạo kịch bản cho ý tưởng.
  - `POST /api/ideas/:id/generate-video`: Đẩy job tạo video từ ý tưởng vào BullMQ Queue.

### 5. `ProductsModule` (`backend/src/modules/products/`)
* **Controller:** `ProductsController` (`@Controller('products')`).
* **Endpoints:**
  - `POST /api/products`: Thêm sản phẩm Affiliate mới thủ công.
  - `GET /api/products`: Danh sách sản phẩm Affiliate.
  - `GET /api/products/:id`: Chi tiết sản phẩm.
  - `PATCH /api/products/:id`: Cập nhật sản phẩm.
  - `DELETE /api/products/:id`: Xóa sản phẩm.
  - `POST /api/products/:id/generate-video`: Kích hoạt tạo video 9:16 trực tiếp cho sản phẩm (truyền thông tin sản phẩm sang Python CLI).

### 6. `ProductResearchModule` (`backend/src/modules/product-research/`)
* **Controller:** `ProductResearchController`.
* **Endpoints:**
  - `POST /api/products/research`: Cào dữ liệu & phân tích AI sản phẩm từ URL (Shopee, Lazada, TikTok Shop, Amazon hoặc Web bất kỳ).
  - `POST /api/product-research`: Endpoint legacy cho cào sản phẩm.
  - `GET /api/products/:id/research`: Lấy trạng thái nghiên cứu sản phẩm (`PENDING`, `PROCESSING`, `COMPLETED`, `FAILED`, `PARTIAL`).
* **Cơ chế Adapter Scraper:**
  - `ShopeeAdapter`: Trích xuất dữ liệu sản phẩm Shopee.
  - `LazadaAdapter`: Trích xuất dữ liệu Lazada.
  - `TikTokShopAdapter`: Trích xuất dữ liệu TikTok Shop.
  - `AmazonAdapter`: Trích xuất dữ liệu Amazon.
  - `GenericProductAdapter`: Fallback dùng JSDOM/cheerio parse meta tags, OpenGraph (`og:title`, `og:image`, `og:price`) và microdata HTML.
* **Quy trình AI Research:**
  - `ProductAnalysisService`: Đưa raw data sang Gemini/OpenAI phân tích USP, tính năng, lợi ích, rào cản mua hàng, nhóm khách hàng mục tiêu và 3-5 góc truyền thông (Marketing Angles).
  - `ContentBriefService`: Tạo bản tóm tắt nội dung bán hàng tái sử dụng (Content Brief).
  - Khởi tạo background job trong BullMQ queue `product-research` (hoặc fallback async inline execution nếu Redis bận).

### 7. `ProductVisualsModule` (`backend/src/modules/product-visuals/`)
* **Service:** `ProductVisualsService`.
* **Tính năng:** Thu thập hình ảnh sản phẩm từ URL, crop/pad theo tỷ lệ 9:16, tối ưu dung lượng và chuyển giao cho Python Video Engine để tạo hiệu ứng chuyển cảnh động.

### 8. `ContentStrategyModule` (`backend/src/modules/content-strategy/`)
* **Controller:** `ContentStrategyController`.
* **Endpoints:**
  - `POST /api/products/:id/content-ideas/generate`: Tự động sinh hàng loạt Ý tưởng Nội dung (`ContentIdea`) từ kết quả phân tích sản phẩm.
  - `GET /api/products/:id/content-ideas`: Danh sách các ý tưởng nội dung của sản phẩm.
  - `GET /api/content-ideas/:id`: Lấy chi tiết ý tưởng nội dung.
  - `DELETE /api/content-ideas/:id`: Xóa ý tưởng nội dung.
  - `POST /api/content-ideas/:id/generate-video`: Sinh video từ ý tưởng nội dung cụ thể.
* **12 Dạng Nội Dung Bán Hàng Hỗ Trợ:** `product_review`, `problem_solution`, `comparison`, `listicle`, `educational`, `storytelling`, `testimonial`, `myth_busting`, `use_case`, `value_for_money`, `pros_cons`, `FAQ`.

### 9. `ScriptEngineModule` (`backend/src/modules/script-engine/`)
* **Controller:** `ScriptEngineController`.
* **Endpoints:**
  - `POST /api/content-ideas/:id/generate-script`: Tạo kịch bản chi tiết đa phân cảnh (`VideoScript`) từ `ContentIdea`.
  - `GET /api/content-ideas/:id/scripts`: Danh sách kịch bản của `ContentIdea`.
  - `GET /api/products/:id/scripts`: Danh sách kịch bản của sản phẩm.
  - `GET /api/scripts/:id`: Chi tiết kịch bản.
  - `POST /api/scripts/:id/generate-video`: Render video từ kịch bản đã duyệt.
* **Cấu trúc VideoScript Output:** Gồm `duration` (30s/45s/60s), `hook` (câu mở đầu 3s), `cta` (câu kêu gọi mua hàng), và `scenes` (mảng phân cảnh gồm mô tả hình ảnh `visualHint`, giọng đọc `narration`, thời lượng `durationSeconds`).

### 10. `JobsModule` (`backend/src/modules/jobs/`)
* **Controller:** `JobsController` (`@Controller('jobs')`).
* **Endpoints:**
  - `GET /api/jobs`: Lấy danh sách tiến trình render video.
  - `GET /api/jobs/:id`: Chi tiết tiến trình job & phần trăm progress (0-100%).
  - `GET /api/jobs/:id/logs`: Lấy danh sách dòng log thời gian thực (`JobLog`).
  - `POST /api/jobs/:id/cancel`: Hủy tiến trình job đang chạy.
  - `POST /api/jobs/:id/retry`: Thử lại job bị thất bại.

### 11. `QueueModule` (`backend/src/modules/queue/`)
* **Cấu trúc:** BullMQ Task Queue System sử dụng Redis.
* **3 Task Queues:**
  1. `video-generation`: Quản lý tiến trình render video Python.
  2. `product-research`: Quản lý cào & phân tích dữ liệu sản phẩm.
  3. `publish-job`: Lập lịch & điều phối đăng video lên TikTok, YouTube, Instagram, Facebook.
* **File quan trọng — `video.processor.ts` (`VideoProcessor`):**
  - Worker lắng nghe queue `video-generation`.
  - Cập nhật DB `GenerationJob` -> `running`.
  - Thực thi Child Process CLI: `uv run --project engine python engine/cli.py --video-subject ... --product-data ...`
  - Đọc dòng `stdout`/`stderr` theo thời gian thực để phân tích tiến độ (`## generating audio` -> progress = 35%, v.v.).
  - Ghi log liên tục vào bảng `JobLog`.
  - Khi CLI xong, dùng `fluent-ffmpeg` tạo thumbnail `.jpg`.
  - Upload `final-1.mp4`, `thumbnail.jpg`, `subtitle.srt`, `script.json` lên MinIO bucket `videos`.
  - Tạo record mới trong bảng `Video` và cập nhật `GenerationJob` -> `completed` (progress = 100%).
  - Dọn dẹp thư mục tạm `engine/storage/tasks/{jobId}/`.

### 12. `VideosModule` (`backend/src/modules/videos/`)
* **Controller:** `VideosController` (`@Controller('videos')`).
* **Endpoints:**
  - `GET /api/videos`: Lấy danh sách video đã tạo thành công.
  - `GET /api/videos/:id`: Lấy thông tin video & URL phát media (presigned MinIO URL).
  - `DELETE /api/videos/:id`: Xóa video & xóa file liên quan trên MinIO.

### 13. `SettingsModule` (`backend/src/modules/settings/`)
* **Controller:** `SettingsController` (`@Controller('settings')`).
* **Endpoints:**
  - `GET /api/settings`: Lấy danh sách cấu hình hệ thống.
  - `GET /api/settings/:key`: Lấy giá trị cấu hình theo key.
  - `POST /api/settings`: Lưu hoặc cập nhật key-value cấu hình.

### 14. `PublishingModule` (`backend/src/modules/publishing/`)
* **Controller:** `PublishingController` (`@Controller('api/publishing')`).
* **Endpoints:**
  - `GET /api/publishing/accounts`: Danh sách tài khoản mạng xã hội đã kết nối.
  - `POST /api/publishing/accounts`: Thêm tài khoản mạng xã hội thủ công.
  - `DELETE /api/publishing/accounts/:id`: Ngắt kết nối tài khoản.
  - `GET /api/publishing/accounts/:platform/connect`: Lấy URL OAuth authorization kết nối tài khoản.
  - `GET /api/publishing/accounts/:platform/callback`: Xử lý OAuth callback lưu token.
  - `POST /api/publishing/jobs`: Tạo lịch đăng video mới (`PublishJob`).
  - `GET /api/publishing/jobs`: Danh sách nhiệm vụ đăng bài.
  - `GET /api/publishing/jobs/:id`: Chi tiết nhiệm vụ đăng bài.
  - `POST /api/publishing/jobs/:id/retry`: Đăng lại bài bị lỗi.
  - `POST /api/publishing/jobs/:id/cancel`: Hủy lịch đăng bài.
* **Platform Adapters (`backend/src/modules/publishing/adapters/`):**
  - `TikTokAdapter`: Tích hợp TikTok Content Posting API v2.
  - `YouTubeAdapter`: Tích hợp YouTube Data API v3 (Videos.insert).
  - `InstagramAdapter`: Tích hợp Instagram Graph API (Container upload & media publish).
  - `FacebookAdapter`: Tích hợp Facebook Graph API (VideoReels publish).

### 15. `AnalyticsModule` (`backend/src/modules/analytics/`)
* **Controller:** `AnalyticsController` (`@Controller('api/analytics')`).
* **Endpoints:**
  - `GET /api/analytics/overview`: Tổng quan chỉ số tương tác hệ thống (tổng views, likes, comments, shares, saves, clicks, avg watch time, engagement rate).
  - `GET /api/analytics/top-performing`: Top video/bài viết có hiệu suất cao nhất.
  - `GET /api/analytics/platforms/:platform`: Báo cáo chỉ số theo từng nền tảng (TikTok, YouTube, Instagram, Facebook).
  - `GET /api/analytics/videos/:videoId`: Chỉ số chi tiết của 1 video.
  - `GET /api/analytics/posts/:postId`: Chỉ số của 1 bài đăng cụ thể.
  - `POST /api/analytics/collect/:jobId`: Kích hoạt thu thập dữ liệu analytics tức thời cho bài đăng.

---

## Phần D — Phân Tích Chi Tiết Python Core Video Engine

Engine Python là trái tim xử lý đồ họa và âm thanh của hệ thống.

### 1. Structure của Python Engine (`engine/`)
* `cli.py`: Entry point dòng lệnh chính.
* `main.py`: Entry point FastAPI Web Server (`uvicorn app.asgi:app --host 0.0.0.0 --port 8080`).
* `app/models/schema.py`: Chứa các dataclass quan trọng:
  - `VideoParams`: Chứa toàn bộ tham số sinh video (`video_subject`, `video_script`, `video_terms`, `video_aspect`, `voice_name`, `subtitle_enabled`, `product_data`, v.v.).
  - `MaterialInfo`: Chứa thông tin clip/ảnh stock hoặc local (`provider`, `url`, `duration`).

### 2. Chi tiết các tham số của CLI (`engine/cli.py`)
CLI được thiết kế cực kỳ linh hoạt với hơn 30 tham số:
```bash
uv run --project engine python engine/cli.py \
  --video-subject "Top 3 Đồ Gia Dụng Thông Minh" \
  --video-script "..." \
  --video-aspect "9:16" \
  --voice-name "vi-VN-HoaiMyNeural" \
  --voice-rate 1.0 \
  --voice-volume 1.0 \
  --subtitle-enabled \
  --font-name "BeVietnamPro-Bold.ttf" \
  --font-size 60 \
  --text-fore-color "#FFFFFF" \
  --stroke-color "#000000" \
  --stroke-width 2.0 \
  --bgm-type "random" \
  --bgm-volume 0.15 \
  --video-source "pexels" \
  --stop-at "video" \
  --task-id "<jobId>" \
  --product-data '{"name":"Nồi Chiên Không Dầu","price":"1.290.000đ","affiliateUrl":"..."}'
```

### 3. Phân tích các Service Core trong Python Engine (`engine/app/services/`)

#### Service 1: `task.py` (Task Orchestrator)
* **Vai trò:** Bộ điều phối luồng 6 bước độc lập:
  1. `generate_script()`: Gọi LLM sinh văn bản kịch bản (Nếu chưa truyền kịch bản sẵn). Nếu có `product_data`, tự động sử dụng Affiliate Sales Prompt.
  2. `generate_terms()`: Gọi LLM trích xuất 5-8 từ khóa tiếng Anh tìm B-roll trên Pexels/Pixabay.
  3. `generate_audio()`: Gọi TTS sinh file âm thanh `audio.mp3`.
  4. `generate_subtitle()`: Sinh file phụ đề `subtitle.srt` từ luồng Edge-TTS SubMaker hoặc Whisper.
  5. `get_video_materials()`: Tải các clip stock từ Pexels/Pixabay hoặc tự động chuyển đổi ảnh sản phẩm trong `product_data` thành clip 9:16.
  6. `generate_final_videos()`: Gọi `video.combine_videos()` và `video.generate_video()` để render MP4 cuối cùng.
* Hỗ trợ cờ `--stop-at` (`script`, `terms`, `audio`, `subtitle`, `materials`, `video`) phục vụ việc dừng sớm để debug.

#### Service 2: `llm.py` (LLM Provider Service)
* **Hàm cốt lõi:** `_generate_response(prompt: str) -> str`.
* **Cơ chế:** Thiết kế theo **Strategy Pattern**, kiểm tra cấu hình `llm_provider` và gọi SDK tương ứng.
* **Chi tiết Gemini (`gemini` provider):**
  - Dùng thư viện `google.generativeai`.
  - Model mặc định: `gemini-2.5-flash`.
  - Tích hợp `DEFAULT_AFFILIATE_SYSTEM_PROMPT` thiết kế chuẩn cho kịch bản bán hàng Affiliate:
    - **HOOI (0-3s)**: Gây chú ý lập tức.
    - **PROBLEM (3-8s)**: Nêu rào cản/nỗi đau của khách hàng.
    - **SOLUTION (8-20s)**: Giới thiệu sản phẩm như một giải pháp tối ưu.
    - **BENEFITS (20-35s)**: Điểm mạnh cốt lõi & USP.
    - **REASON (35-45s)**: Lý do phải mua ngay (giảm giá/ưu đãi).
    - **CTA (45-55s)**: Kêu gọi click link ở tiểu sử / comment.

#### Service 3: `voice.py` (TTS Service)
* **Hàm cốt lõi:** `tts(text, voice_name, voice_rate, voice_file)`.
* **Các Provider:**
  - `azure_tts_v1` (**Edge-TTS — Mặc định**): Miễn phí 100%, không cần API Key, sử dụng giọng đọc mượt mà (`vi-VN-HoaiMyNeural`, `vi-VN-NamMinhNeural`).
  - `azure_tts_v2`: Azure Speech SDK chính thức.
  - `gemini_tts`: Giọng nói từ Google Cloud Gemini.
  - `siliconflow_tts`: CosyVoice2 model.
  - `elevenlabs_tts`: ElevenLabs API.
  - `openai_tts`: OpenAI TTS-1.

#### Service 4: `material.py` (Material & Stock Media Manager)
* **Cơ chế:**
  - `search_videos_pexels()`: Gọi Pexels Video API (Hỗ trợ xoay vòng mảng API keys tự động).
  - `search_videos_pixabay()`: Gọi Pixabay API.
  - `search_videos_coverr()`: Gọi Coverr API.
  - `process_product_images()`: Khi có `product_data` chứa mảng URL ảnh sản phẩm, tự động tải về, crop/pad thành khung hình 9:16 (1080x1920) và chuyển đổi thành các clip video ngắn (3 giây) có hiệu ứng Zoom/Pan tĩnh.

#### Service 5: `subtitle.py` (Subtitle Engine)
* Tự động chuyển đổi dữ liệu timestamp từ Edge-TTS thành chuẩn file `.srt`.
* Hỗ trợ gộp đoạn văn bản và căn chỉnh thời lượng hiển thị từng dòng chữ.

#### Service 6: `video.py` (MoviePy & FFmpeg Video Renderer)
* `combine_videos()`: Cắt ngẫu nhiên các clip stock/ảnh sản phẩm thành các đoạn 2-4s, crop về tỉ lệ 1080x1920 (9:16) và concat lại sao cho thời lượng video đúng bằng thời lượng file âm thanh `audio.mp3` (`combined-1.mp4`).
* `generate_video()`: Trộn `combined-1.mp4` với `audio.mp3`, vẽ chữ phụ đề tiếng Việt bằng Pillow (`TextClip`/`SubtitlesClip`), đè nhạc nền BGM (giảm volume BGM xuống 15%) và gọi FFmpeg render file đầu ra `final-1.mp4`.

---

## Phần E — Database Schema & Data Models (PostgreSQL + Prisma ORM)

File Schema duy nhất tại `backend/prisma/schema.prisma` định nghĩa **11 Database Models** hoàn chỉnh:

```mermaid
erDiagram
    Product ||--o{ Idea : "references"
    Product ||--o{ GenerationJob : "references"
    Product ||--o{ ContentIdea : "has many"
    Product ||--o{ VideoScript : "has many"
    ContentIdea ||--o{ VideoScript : "has many"
    Idea ||--o{ GenerationJob : "has many"
    Idea ||--o{ Video : "has many"
    GenerationJob ||--o{ Video : "produces"
    GenerationJob ||--o{ JobLog : "generates"
    Video ||--o{ PublishJob : "published via"
    PlatformAccount ||--o{ PublishJob : "uses"
    PublishJob ||--o{ PostAnalytics : "tracks"

    Idea {
        string id PK
        string title
        string topic
        string description
        string script
        string language
        string status
        string productId FK
    }

    Product {
        string id PK
        string name
        string brand
        string category
        string price
        string affiliateUrl
        string sourcePlatform
        string[] images
        string[] features
        string researchStatus
    }

    ContentIdea {
        string id PK
        string productId FK
        string title
        string contentType
        string marketingAngle
        string hook
        string status
    }

    VideoScript {
        string id PK
        string productId FK
        string contentIdeaId FK
        string title
        int duration
        string hook
        json scenes
        string cta
    }

    GenerationJob {
        string id PK
        string ideaId FK
        string productId FK
        string status
        float progress
        string errorMessage
        json config
    }

    Video {
        string id PK
        string ideaId FK
        string jobId FK
        string title
        string videoObjectKey
        string thumbnailObjectKey
        string subtitleObjectKey
        float duration
    }

    JobLog {
        string id PK
        string jobId FK
        string level
        string message
    }

    PlatformAccount {
        string id PK
        string platform
        string accountName
        string status
    }

    PublishJob {
        string id PK
        string videoId FK
        string platformAccountId FK
        string platform
        string status
        datetime scheduledAt
    }

    PostAnalytics {
        string id PK
        string publishJobId FK
        bigint views
        int likes
        int comments
        int shares
        float engagementRate
    }
```

---

## Phần F — Queue System, Task Worker & Cơ Chế Phục Hồi Lỗi (Error Recovery)

### 1. Cấu trúc Queue & Worker (BullMQ + Redis)
Hệ thống vận hành 3 BullMQ Queues chính trong backend:
1. Queue `video-generation`: Nhận payload `VideoJobPayload` (chứa `jobId`, `ideaId`, `productId`, `config`). Xử lý bởi `VideoProcessor` (`backend/src/modules/queue/video.processor.ts`).
2. Queue `product-research`: Nhận payload `ProductResearchJobPayload` (chứa `productId`, `url`). Xử lý bởi `ProductResearchProcessor`.
3. Queue `publish-job`: Lập lịch và phát các tiến trình đăng video lên mạng xã hội.

### 2. Vòng đời xử lý Job của `VideoProcessor`
```text
[BullMQ Video Job Queued]
          │
          ▼
[Worker VideoProcessor.process()]
          │
          ├─► 1. Đánh dấu DB GenerationJob -> status = "running", progress = 5%
          ├─► 2. Khởi tạo thư mục tạm: engine/storage/tasks/{jobId}/
          ├─► 3. Spawns Child Process: `uv run --project engine python engine/cli.py ...`
          │
          ├─► 4. Đọc stdout/stderr từng dòng theo thời gian thực (Real-time Stream):
          │       - Thấy "## generating script" -> Cập nhật progress = 15%
          │       - Thấy "## generating audio"  -> Cập nhật progress = 35%
          │       - Thấy "## downloading materials" -> Cập nhật progress = 60%
          │       - Thấy "## rendering final video" -> Cập nhật progress = 85%
          │       - Ghi mỗi dòng log vào bảng `JobLog` trong Database PostgreSQL.
          │
          ├─► 5. CLI kết thúc với Exit Code 0:
          │       - Chạy FFmpeg chụp ảnh thumbnail: `thumbnail.jpg`
          │       - Upload final-1.mp4, thumbnail.jpg, subtitle.srt, script.json lên MinIO Storage.
          │       - Tạo record mới trong bảng `Video`.
          │       - Cập nhật GenerationJob -> status = "completed", progress = 100%.
          │       - Xóa thư mục tạm local `engine/storage/tasks/{jobId}/`.
          │
          └─► 6. CLI thất bại (Exit Code != 0):
                  - Catch exception, ghi log lỗi.
                  - Cập nhật GenerationJob -> status = "failed", errorMessage = <stderr>.
```

### 3. Cơ chế Phục Hồi Lỗi Hệ Thống (Fault Tolerance & Error Recovery)
* **Khởi động Database tự động:** Hàm `runDatabasePush()` trong `backend/src/main.ts` thực thi `npx prisma db push` với vòng lặp thử lại 10 lần (retries loop) để đảm bảo schema PostgreSQL luôn đồng bộ trước khi backend phục vụ request.
* **Xử lý Job bị kẹt khi restart server (Stuck Jobs Recovery):** Hàm `recoverStuckJobs()` trong `backend/src/main.ts` quét toàn bộ các job có trạng thái `running` hoặc `queued` còn dở dang trước khi server sập/restart và tự động chuyển thành `failed` kèm thông báo lỗi rõ ràng.
* **Fallback cào sản phẩm:** `ProductResearchService` thử thêm job vào BullMQ queue; nếu Redis bị mất kết nối, hệ thống tự động fallback sang cơ chế chạy bất đồng bộ inline (`executeResearchPipeline`).

---

## Phần G — Trace Các Luồng Xử Xý End-to-End (End-to-End Workflows)

### Workflow 1: Luồng Tạo Video Từ Chủ Đề Đơn Thuần (Standard Topic-to-Video)
```text
[User] ──(1. Nhập Topic/Prompt)──► [Next.js Frontend]
                                           │
                                  (2. POST /api/ideas)
                                           ▼
                                 [NestJS IdeasController]
                                           │
                                  (3. Đẩy Job vào Queue)
                                           ▼
                                [BullMQ VideoProcessor]
                                           │
                           (4. Call CLI `engine/cli.py`)
                                           ▼
                                 [Python Task Service]
                                           │
               ┌───────────────────────────┼───────────────────────────┐
               ▼                           ▼                           ▼
       [Gemini Script AI]           [Edge-TTS Audio]           [Pexels Stock Clips]
               │                           │                           │
               └───────────────────────────┼───────────────────────────┘
                                           ▼
                              [MoviePy & FFmpeg Render]
                                           │
                                (5. Export final-1.mp4)
                                           ▼
                                [MinIO S3 Storage]
                                           │
                               (6. Video Record in DB)
                                           ▼
                                [Frontend Dashboard Play]
```

### Workflow 2: Luồng Tự Động Hóa Affiliate Video Sản Phẩm (Full Affiliate Automation Workflow)
```text
[User] ──(1. Dán Link Shopee/TikTok/Lazada)──► [Frontend Products Page]
                                                         │
                                           (2. POST /api/products/research)
                                                         ▼
                                          [ProductResearchModule]
                                                         │
                        ┌────────────────────────────────┴────────────────────────────────┐
                        ▼                                                                 ▼
             [Scraper Adapters]                                                [ProductAnalysisService]
       (Trích xuất Giá, Ảnh, Title)                                            (Gemini phân tích USP & Angles)
                        │                                                                 │
                        └────────────────────────────────┬────────────────────────────────┘
                                                         ▼
                                            [Database: Product Record]
                                                         │
                                        (3. POST /content-ideas/generate)
                                                         ▼
                                             [ContentStrategyModule]
                                       (Sinh 12 Dạng Ý Tưởng Bán Hàng)
                                                         │
                                        (4. POST /generate-script)
                                                         ▼
                                              [ScriptEngineModule]
                                        (Tạo VideoScript Đa Phân Cảnh)
                                                         │
                                        (5. POST /generate-video)
                                                         ▼
                                            [BullMQ VideoProcessor]
                                                         │
                                    (6. Call CLI với `--product-data`)
                                                         ▼
                                           [Python Engine Task Service]
                                                         │
                     ┌───────────────────────────────────┼───────────────────────────────────┐
                     ▼                                   ▼                                   ▼
          [Affiliate Gemini Prompt]            [Product Visuals & Stock]               [Edge-TTS Audio & Sub]
          (Hook 3s -> Problem ->               (Xử lý Ảnh sản phẩm 9:16 +             (Tạo giọng đọc tiếng Việt +
           Solution -> CTA)                     Pexels Footage)                         Subtitle SRT)
                     │                                   │                                   │
                     └───────────────────────────────────┼───────────────────────────────────┘
                                                         ▼
                                            [MoviePy & FFmpeg Render]
                                                         │
                                              (7. Export Video MP4)
                                                         ▼
                                            [MinIO Object Storage]
                                                         │
                                        (8. POST /api/publishing/jobs)
                                                         ▼
                                              [PublishingModule]
                                  (Đăng bài lên TikTok/YouTube/Reels/FB)
                                                         │
                                        (9. GET /api/analytics/overview)
                                                         ▼
                                               [AnalyticsModule]
                                    (Theo dõi Views, Likes, Clicks, Sales)
```

---

## Phần H — AI Provider & LLM Architecture

* **Provider Mặc Định:** Google Gemini (`gemini-2.5-flash`).
* **Các Provider Hỗ Trợ:** Gemini, OpenAI (GPT-4o-mini, GPT-4o), DeepSeek (v3/r1), Qwen, Ollama (local model), AIHubMix, AIML API.
* **Vị trí cấu hình Key:** `engine/config.toml` (`gemini_api_key`) hoặc thiết lập biến môi trường `GEMINI_API_KEY`.
* **Cơ chế Prompting:** Hệ thống tự động phân nhánh logic:
  - Nếu tạo video chủ đề thông thường: Dùng `DEFAULT_SCRIPT_SYSTEM_PROMPT`.
  - Nếu tạo video Affiliate sản phẩm (`product_data` tồn tại): Dùng `DEFAULT_AFFILIATE_SYSTEM_PROMPT` ép cấu trúc kịch bản theo công thức bán hàng chuyển đổi cao.

---

## Phần I — TTS Pipeline (Text-to-Speech)

* **Provider Mặc Định:** Edge-TTS (`azure_tts_v1`).
* **Ưu điểm:**
  - **Miễn phí 100%**, không tốn chi phí API Key.
  - Chạy hoàn toàn trên Cloud Microsoft Azure Edge WebSocket API.
  - **Không tốn tài nguyên CPU/GPU local** để inference model.
  - Hỗ trợ giọng đọc tiếng Việt mượt mà: `vi-VN-HoaiMyNeural` (Nữ), `vi-VN-NamMinhNeural` (Nam).
* **Quản lý âm lượng & Tốc độ:** Điều chỉnh qua cờ CLI `--voice-rate` (tốc độ đọc) và `--voice-volume` (âm lượng).

---

## Phần J — Image / Video / Product Visual & Stock Media Pipeline

* **Stock Media Cloud APIs:**
  - **Pexels API:** API tìm kiếm video ngắn HD/4K (Hỗ trợ xoay vòng danh sách keys trong `pexels_api_keys`).
  - **Pixabay API:** Backup tìm kiếm video & hình ảnh stock.
  - **Coverr API:** Backup tìm kiếm B-roll.
* **Product Visuals Pipeline & Ken Burns Motion Effects:**
  - Khi người dùng tạo video cho Sản phẩm Affiliate, hàm `process_product_images()` trong `engine/app/services/material.py` lấy danh sách URL ảnh sản phẩm từ DB.
  - Tải ảnh về, crop/pad thành khung hình 9:16 (1080x1920) chuẩn với background mờ hoặc màu chủ đạo.
  - Áp dụng các hiệu ứng chuyển động ống kính tĩnh (**Ken Burns Effects**) bằng OpenCV & MoviePy:
    - `zoom_in`: Phóng to dần vào trung tâm sản phẩm.
    - `detail_zoom`: Zoom cận cảnh vào điểm nhấn tính năng.
    - `pan_left` / `pan_right`: Quét ống kính ngang sang trái / phải.
    - `pan_up`: Quét ống kính từ dưới lên trên.
    - `zoom_out`: Thu nhỏ từ cận cảnh ra toàn cảnh.
    - `subtle_float`: Hiệu ứng nổi nhẹ nhàng tạo cảm giác 3D.
* **Quy Tắc Ưu Tiên Visual (Visual Priority Rules - `compose_visual_timeline`):**
  - **Hook (Scene 1 - 3s đầu):** Bắt buộc sử dụng 100% clip chuyển động sản phẩm thực tế (P0 Product Visual) để thu hút chú ý.
  - **CTA (Scene cuối):** Bắt buộc sử dụng clip sản phẩm ấn tượng nhất (P0 Hero Shot) kèm nút kêu gọi mua hàng.
  - **Body (Thân video):** Duy trì từ 60% đến 80% thời lượng là hình ảnh/clip sản phẩm thực tế (P0), 20-40% còn lại là video stock minh họa (P1/P2) để giữ nhịp độ thị giác cuốn hút.

---

## Phần K — Subtitle Engine & Video Rendering Engine

* **Subtitle Engine:**
  - Lấy timestamp trực tiếp từ WebSocket stream của Edge-TTS `SubMaker`.
  - Xuất file `.srt` chuẩn UTF-8.
  - Hỗ trợ font tiếng Việt đẹp (`BeVietnamPro-Bold.ttf`).
  - Cho phép tùy chỉnh cỡ chữ (`font_size`), màu chữ (`text_fore_color`), viền chữ (`stroke_color`, `stroke_width`), vị trí (`subtitle_position`: `top`, `center`, `bottom`, `custom`) và nền chữ bo tròn (`rounded_subtitle_background`).
* **Rendering Engine:**
  - **MoviePy 2.x:** Quản lý Timeline, trộn Audio tracks và Video tracks.
  - **Pillow (PIL):** Render text phụ đề thành khung ảnh minh họa trước khi đưa vào MoviePy.
  - **FFmpeg:** Đảm nhận công đoạn ghép nối thô (concat) và mã hóa video final chuẩn `libx264` (H.264), audio `aac`, 30 FPS, độ phân giải 1080x1920.

---

## Phần L — Multi-Platform Publishing & Analytics Engine

### 1. Multi-Platform Publishing (`PublishingModule`)
* **Tài khoản hỗ trợ (`PlatformAccount`):** `TIKTOK`, `YOUTUBE`, `INSTAGRAM`, `FACEBOOK`.
* **Quy trình kết nối:** Hỗ trợ OAuth 2.0 Authorization Flow (`GET /api/publishing/accounts/:platform/connect`) để cấp quyền truy cập công khai.
* **Lập lịch & Đăng bài (`PublishJob`):**
  - Trạng thái Job: `DRAFT`, `SCHEDULED`, `QUEUED`, `PUBLISHING`, `PUBLISHED`, `FAILED`, `CANCELLED`.
  - Đăng bài tự động theo thời gian hẹn giờ (`scheduledAt`).
  - Tự động gắn Title, Description, Hashtags và Call-To-Action kèm Link Bio/Affiliate.
  - Hỗ trợ đăng lại (`retryJob`) và hủy đăng (`cancelJob`).

### 2. Post Analytics (`AnalyticsModule`)
* **Bảng chỉ số (`PostAnalytics`):** Lịch sử lưu các đợt snapshot số liệu.
* **Các chỉ số thu thập:**
  - `views`: Tổng số lượt xem video.
  - `likes`, `comments`, `shares`, `saves`: Các tương tác cơ bản.
  - `clicks`: Lượt click vào link Affiliate sản phẩm.
  - `watchTime` & `averageWatchTime`: Thời gian xem trung bình.
  - `completionRate`: Tỷ lệ xem hết video (0-100%).
  - `engagementRate`: Tỷ lệ tương tác tổng hợp `(likes + comments + shares) / views`.
* **Trực quan hóa trên Dashboard:** `AnalyticsDashboard.tsx` hiển thị biểu đồ xu hướng, bảng xếp hạng Top Performing Posts và phân tích theo từng mạng xã hội.

---

## Phần M — Configuration, Environment Variables & Docker Architecture

### 1. File Cấu Hình Python Engine (`engine/config.toml`)
Tạo từ file mẫu `config.example.toml`:
```toml
[app]
llm_provider = "gemini"
gemini_api_key = "AIzaSyYOUR_ACTUAL_GEMINI_KEY"
gemini_model_name = "gemini-2.5-flash"
pexels_api_keys = ["YOUR_PEXELS_KEY_1", "YOUR_PEXELS_KEY_2"]
subtitle_provider = "edge"

[ui]
font_name = "BeVietnamPro-Bold.ttf"
voice_name = "vi-VN-HoaiMyNeural"
```

### 2. Các Biến Môi Trường Backend (`backend/.env` & Docker)
* `DATABASE_URL`: `"postgresql://postgres:postgres@postgres:5432/videotool?schema=public"`
* `REDIS_HOST`: `"redis"` / `"localhost"`
* `REDIS_PORT`: `6379`
* `MINIO_ENDPOINT`: `"minio"` / `"localhost"`
* `MINIO_PORT`: `9000`
* `MINIO_ACCESS_KEY`: `"minioadmin"`
* `MINIO_SECRET_KEY`: `"minioadmin"`
* `MINIO_BUCKET_NAME`: `"videos"`
* `PORT`: `23001`
* `CORS_ORIGIN`: `"http://localhost:23000"`

### 3. Docker Compose Architecture (`docker-compose.yml`)
Khởi chạy đồng bộ 5 containers:
1. `videotool-postgres`: Container PostgreSQL 15-alpine (Port `25432:5432`).
2. `videotool-redis`: Container Redis 7-alpine (Port `26379:6379`).
3. `videotool-minio`: Container MinIO Object Storage (Port `29000:9000`, Console `29001:9001`).
4. `videotool-backend`: Container NestJS API Server (Port `23001:23001`).
5. `videotool-frontend`: Container Next.js Web Dashboard (Port `23000:23000`).

---

## Phần N — Hướng Dẫn Chạy & Vận Hành Hệ Thống Trên Linux Mint

### Phương Pháp 1: Recommended — Khởi Chạy Bằng Docker Compose (Đơn Giản Nhất)

#### Bước 1: Chuẩn bị cấu hình Engine
```bash
cd short-video
cp engine/config.example.toml engine/config.toml
```

#### Bước 2: Điền API Keys vào `engine/config.toml`
Mở `engine/config.toml` bằng text editor và cập nhật:
```toml
[app]
llm_provider = "gemini"
gemini_api_key = "AIzaSyYOUR_ACTUAL_GEMINI_KEY"
pexels_api_keys = ["YOUR_ACTUAL_PEXELS_KEY"]
```

#### Bước 3: Khởi chạy Full-stack Container
```bash
docker compose up -d
```

#### Bước 4: Truy cập các địa chỉ ứng dụng
* **Frontend Web Dashboard:** `http://localhost:23000`
* **Backend NestJS API:** `http://localhost:23001/api`
* **MinIO Storage Console:** `http://localhost:29001` (User: `minioadmin` / Pass: `minioadmin`)

---

### Phương Pháp 2: Manual — Chạy Trực Tiếp Local (Không dùng Docker Containers)

#### Bước 1: Cài đặt công cụ nền tảng trên Linux Mint
```bash
sudo apt update
sudo apt install -y ffmpeg git postgresql redis-server
curl -LsSf https://astral.sh/uv/install.sh | sh
```

#### Bước 2: Setup Python Engine
```bash
cd short-video/engine
uv sync --frozen
cp config.example.toml config.toml
# Điền gemini_api_key và pexels_api_keys vào config.toml
```

#### Bước 3: Setup Backend NestJS Database & Dependencies
```bash
cd ../backend
npm install
# Tạo database videotool trong Postgres local và sửa DATABASE_URL trong .env nếu cần
npx prisma db push
```

#### Bước 4: Setup Frontend Next.js
```bash
cd ../frontend
npm install
```

#### Bước 5: Khởi chạy Dịch vụ (Mở 3 Terminal)
* **Terminal 1 (Backend API):**
  ```bash
  cd backend && npm run start:dev
  ```
* **Terminal 2 (Frontend Dashboard):**
  ```bash
  cd frontend && npm run dev
  ```
* **Terminal 3 (Test thử Python CLI độc lập):**
  ```bash
  cd engine
  uv run python cli.py --video-subject "Nồi chiên không dầu Lock&Lock" --video-aspect 9:16
  ```

---

## Phần O — Ma Trận Tính Năng Thực Tế Trong Codebase (Feature Matrix)

| Feature / Module | Trạng thái Code | Vị trí Source Code thực tế | Ghi chú & Đánh giá |
| :--- | :---: | :--- | :--- |
| **AI Script Generation** | **ĐÃ HOÀN THÀNH** | `engine/app/services/llm.py` | Sinh kịch bản bằng Gemini / OpenAI |
| **Google Gemini 2.5 Flash** | **ĐÃ HOÀN THÀNH** | `engine/app/services/llm.py` | Provider `gemini` hỗ trợ đầy đủ |
| **Cloud TTS (Free Edge-TTS)**| **ĐÃ HOÀN THÀNH** | `engine/app/services/voice.py` | Dùng Edge-TTS giọng đọc Việt chuẩn |
| **Stock Video Search** | **ĐÃ HOÀN THÀNH** | `engine/app/services/material.py` | Pexels / Pixabay / Coverr API |
| **Subtitle Burn-in** | **ĐÃ HOÀN THÀNH** | `engine/app/services/video.py` | Render phụ đề tiếng Việt với PIL |
| **Video Format 9:16 & 16:9** | **ĐÃ HOÀN THÀNH** | `engine/app/services/video.py` | Tự động crop & resize 1080x1920 |
| **Product Scraper / Crawler**| **ĐÃ HOÀN THÀNH** | `backend/src/modules/product-research/adapters/` | Adapter Shopee, Lazada, TikTok, Amazon, Generic |
| **Product AI Research** | **ĐÃ HOÀN THÀNH** | `backend/src/modules/product-research/product-analysis.service.ts` | Phân tích USP, Pain Points, Angles |
| **Product Content Brief** | **ĐÃ HOÀN THÀNH** | `backend/src/modules/product-research/content-brief.service.ts` | Sinh brief bán hàng tái sử dụng |
| **Content Strategy Generator**| **ĐÃ HOÀN THÀNH** | `backend/src/modules/content-strategy/` | Sinh 12 dạng ý tưởng bán hàng |
| **Multi-Scene Script Engine** | **ĐÃ HOÀN THÀNH** | `backend/src/modules/script-engine/` | Kịch bản phân cảnh Hook -> Story -> CTA |
| **Product Visuals 9:16** | **ĐÃ HOÀN THÀNH** | `engine/app/services/material.py` (`process_product_images`) | Biến ảnh SP thành clip 9:16 động |
| **Affiliate Prompting** | **ĐÃ HOÀN THÀNH** | `engine/app/services/llm.py` (`DEFAULT_AFFILIATE_SYSTEM_PROMPT`) | Prompt bán hàng chuyển đổi cao |
| **Task Queue & BullMQ** | **ĐÃ HOÀN THÀNH** | `backend/src/modules/queue/video.processor.ts` | 3 Queues với Redis Worker |
| **Multi-Platform Publishing** | **ĐÃ HOÀN THÀNH** | `backend/src/modules/publishing/` | Đăng video TikTok, YouTube, Instagram, FB |
| **Post Analytics Collection** | **ĐÃ HOÀN THÀNH** | `backend/src/modules/analytics/` | Đếm views, likes, comments, clicks, engagement |
| **Web UI Management** | **ĐÃ HOÀN THÀNH** | `frontend/src/app/` & `frontend/src/components/` | Dashboard, Products, Publishing, Analytics UI |

---

## Phần P — Các Sơ Đồ Kiến Trúc & Luồng Dữ Liệu (Diagrams)

### 1. Kiến Trúc Phụ Thuộc Hệ Thống Tổng Thể
```text
+-----------------------------------------------------------------------+
|                         FRONTEND (Next.js 15)                         |
|                    http://localhost:23000 (React UI)                  |
+-----------------------------------┬-----------------------------------+
                                    | REST API Calls (`/api/...`)
                                    ▼
+-----------------------------------------------------------------------+
|                         BACKEND (NestJS API)                          |
|                       http://localhost:23001                          |
|  +-------------------------+  +------------------------------------+  |
|  |  Prisma ORM (Postgres)  |  |  BullMQ Queue Producer             |  |
|  +------------┬------------+  +----------------─┬------------------+  |
+---------------│---------------------------------│---------------------+
                │                                 │ Enqueue Task
                ▼                                 ▼
    +───────────────────────+        +──────────────────────────────────+
    | PostgreSQL Database   |        |  Redis Server (Port 6379)        |
    | (11 Schema Models)    |        +----------------─┬────────────────+
    +───────────────────────+                          │
                                                       │ Process Queue
                                                       ▼
+-----------------------------------------------------------------------+
|                   BULLMQ WORKER (VideoProcessor)                      |
|           `backend/src/modules/queue/video.processor.ts`             |
|                                                                       |
| Spawns Process: `uv run --project engine python engine/cli.py ...`    |
+--------------------------------───┬-----------------------------------+
                                    │
                                    ▼
+-----------------------------------------------------------------------+
|                    PYTHON ENGINE (MoneyPrinterTurbo)                  |
|                           `engine/cli.py`                             |
|                                                                       |
|  +-------------------+  +-------------------+  +-------------------+  |
|  | Google Gemini AI  |  |   Edge TTS Cloud  |  |  Product Visuals  |  |
|  | (Script & Terms)  |  |   (Voice Audio)   |  |  & Pexels Stock   |  |
|  +─────────┬─────────+  +─────────┬─────────+  +─────────┬─────────+  |
|            │                      │                      │            |
|            └──────────────────────┼──────────────────────┘            |
|                                   ▼                                   |
|                     [MoviePy + FFmpeg Renderer]                       |
|            Output: `engine/storage/tasks/{jobId}/final-1.mp4`         |
+--------------------------------───┬-----------------------------------+
                                    │
                                    │ Upload MP4 / Thumbnail / SRT
                                    ▼
+-----------------------------------------------------------------------+
|                   MINIO OBJECT STORAGE (Port 29000)                   |
|                   Bucket: `videos/{jobId}/final.mp4`                  |
+-----------------------------------------------------------------------+
```

---

## Phần Q — Trả Lời Trực Tiếp Các Câu Hỏi Cốt Lõi Về Codebase

#### 1. Repository này thực sự làm được gì?
> **Trả lời:** Đây là một hệ thống Full-stack hoàn chỉnh giúp tự động hóa toàn bộ quy trình Affiliate Video Marketing: Từ cào dữ liệu sản phẩm (Shopee/Lazada/TikTok/Amazon) -> Dùng AI phân tích USP & lập chiến lược nội dung -> Sinh kịch bản phân cảnh -> Tạo giọng đọc TTS & phụ đề -> Xử lý hình ảnh sản phẩm & ghép video stock -> Export file `.mp4` -> Đăng bài đa nền tảng (TikTok, YouTube, Instagram, Facebook) -> Thu thập báo cáo Analytics.

#### 2. Kiến trúc thực tế trong code là gì?
> **Trả lời:** Kiến trúc Doanh nghiệp 3 Lớp (Three-tier Architecture): **Next.js 15 (Frontend)** ➔ **NestJS 10 + PostgreSQL + Redis/BullMQ + MinIO (Backend Service & Task Queue)** ➔ **Python 3.11 (Core Video Engine)**.

#### 3. Entry points chính nằm ở đâu?
> * **Backend NestJS API:** `backend/src/main.ts` (Port 23001).
> * **Frontend Dashboard:** `frontend/src/app/page.tsx` -> `/dashboard` (Port 23000).
> * **Python Engine CLI:** `engine/cli.py` (Được BullMQ worker kích hoạt).
> * **Python FastAPI Server:** `engine/main.py` (Port 8080).

#### 4. Flow tạo video diễn ra như thế nào?
> **Trả lời:** User gửi request ➔ NestJS ghi Job vào PostgreSQL & đẩy vào BullMQ Queue ➔ Worker gọi CLI `engine/cli.py` ➔ Engine gọi Gemini viết kịch bản ➔ Gọi Edge-TTS sinh tiếng & phụ đề ➔ Tải clip stock Pexels hoặc biến ảnh sản phẩm thành clip 9:16 ➔ MoviePy & FFmpeg ghép nối thành MP4 ➔ Worker upload MinIO, cập nhật DB và phát lên UI Dashboard.

#### 5. AI LLM nào đang được sử dụng?
> **Trả lời:** Mặc định sử dụng **Google Gemini API** (`gemini-2.5-flash`). Hệ thống cũng hỗ trợ OpenAI, DeepSeek, Qwen, Ollama local.

#### 6. Những phần nào chạy local và phần nào gọi Cloud API?
> * **Chạy Local:** NestJS API Server, Next.js Frontend, PostgreSQL Database, Redis Queue, MinIO Storage, Scraper Adapters, và FFmpeg Video Renderer.
> * **Gọi Cloud API:** Sinh văn bản AI (Google Gemini), Giọng đọc TTS (Microsoft Edge-TTS Cloud WebSocket), Video Stock (Pexels API), Đăng bài đa nền tảng (TikTok, YouTube, Instagram, Facebook APIs).

#### 7. Máy Linux yếu (như Linux Mint CPU 4 nhân, 8GB RAM) có chạy được không?
> **Trả lời:** **CHẠY RẤT MƯỢT.** Tất cả công đoạn AI và TTS nặng nhất đều được đẩy lên Cloud API miễn phí. Máy local chỉ tốn CPU ở bước FFmpeg encode video MP4 cuối cùng (tốn khoảng 30-60 giây cho mỗi video ngắn 30-60s).

---

## Danh Sách Vấn Đề Kỹ Thuật & Cấu Hình Lưu Ý (Known Issues / Operational Notes)

1. **Đồng bộ Schema Database tự động khi khởi động:**
   - Trong `backend/src/main.ts`, hàm `runDatabasePush()` tự động gọi `npx prisma db push` trước khi app lắng nghe request. Điều này giúp hệ thống tự động tạo và cập nhật đủ 11 bảng trong PostgreSQL mà không cần người dùng gõ lệnh thủ công.
2. **Cấu hình Endpoint MinIO giữa Docker và Local Manual:**
   - Trong `docker-compose.yml`, backend kết nối MinIO qua host `minio` port `9000`. Khi chạy backend local không qua Docker, cần đảm bảo `MINIO_ENDPOINT=localhost` và `MINIO_PORT=29000` trong file `.env`.
3. **Quản lý Giới Hạn Pexels API Key Free Tier:**
   - Key Pexels miễn phí giới hạn 200 requests/giờ. Codebase tại `engine/app/services/material.py` đã tích hợp sẵn cơ chế xoay vòng key (`_api_key_counter`). Bạn nên điền mảng nhiều keys trong `pexels_api_keys = ["key1", "key2"]` tại `engine/config.toml` để đảm bảo hệ thống không bị gián đoạn khi sinh video hàng loạt.
