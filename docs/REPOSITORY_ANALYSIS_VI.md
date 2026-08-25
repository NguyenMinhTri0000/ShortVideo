# Báo Cáo Phân Tích Codebase Repository: Short-Video (MoneyPrinterTurbo) & Hướng Dẫn Phát Triển Hệ Thống Affiliate Video Automation

> **Ngày lập tài liệu:** 25/08/2026  
> **Phiên bản codebase:** MoneyPrinterTurbo v1.3.0 (Tích hợp Next.js Frontend + NestJS Backend + Python Engine)  
> **Người thực hiện:** Senior Software Architect & Codebase Analyst  
> **Ngôn ngữ:** Tiếng Việt (Tên Class, Function, File, Command giữ nguyên tiếng Anh để truy vết code)

---

## MỤC LỤC
1. [Phần A — Tổng Quan Repository](#phần-a--tổng-quan-repository)
2. [Phần B — Giải Thích Cấu Trúc Folder & Các File Quan Trọng](#phần-b--giải-thích-cấu-trúc-folder--các-file-quan-trọng)
3. [Phần C — Trace Toàn Bộ Flow Tạo Một Video (End-to-End Flow)](#phần-c--trace-toàn-bộ-flow-tạo-một-video-end-to-end-flow)
4. [Phần D — AI Provider Architecture (LLM)](#phần-d--ai-provider-architecture-llm)
5. [Phần E — TTS Pipeline (Text-to-Speech)](#phần-e--tts-pipeline-text-to-speech)
6. [Phần F — Image / Video / Stock Media Pipeline](#phần-f--image--video--stock-media-pipeline)
7. [Phần G — Subtitle Engine](#phần-g--subtitle-engine)
8. [Phần H — Video Rendering Engine](#phần-h--video-rendering-engine)
9. [Phần I — Database Và Storage Architecture](#phần-i--database-và-storage-architecture)
10. [Phần J — Configuration & Environment Variables](#phần-j--configuration--environment-variables)
11. [Phần K — Hướng Dẫn Chạy Repository Trên Linux Mint](#phần-k--hướng-dẫn-chạy-repository-trên-linux-mint)
12. [Phần L — Ma Trận Tính Năng Hiện Tại (Feature Matrix)](#phần-l--ma-trận-tính-năng-hiện-tại-feature-matrix)
13. [Phần M — Phân Tích Khoảng Cách (Gap Analysis): Hệ Thống Affiliate Còn Thiếu Gì?](#phần-m--phân-tích-khoảng-cách-gap-analysis-hệ-thống-affiliate-còn-thiếu-gì)
14. [Phần N — Kiến Trúc Hệ Thống Mục Tiêu (Affiliate Video Automation)](#phần-n--kiến-trúc-hệ-thống-mục-tiêu-affiliate-video-automation)
15. [Phần O — Tôi Cần Sửa Code Ở Đâu? (Exact Code Modification Mapping)](#phần-o--tôi-cần-sửa-code-ở-đâu-exact-code-modification-mapping)
16. [Phần P — Những Phần TUYỆT ĐỐI KHÔNG Nên Sửa](#phần-p--những-phần-tuyệt-đối-không-nên-sửa)
17. [Phần Q — Đề Xuất Roadmap Implementation (Phase 0 đến Phase 10)](#phần-q--đề-xuất-roadmap-implementation-phase-0-đến-phase-10)
18. [Phần R — Giải Thích Cho Người Không Biết Codebase / Không Rành Python](#phần-r--giải-thích-cho-người-không-biết-codebase--không-rành-python)
19. [Phần S — Các Sơ Đồ Kiến Trúc & Luồng Dữ Liệu (Diagrams)](#phần-s--các-sơ-đồ-kiến-trúc--luồng-dữ-liệu-diagrams)
20. [Phần T — Trả Lời Trực Tiếp 10 Câu Hỏi Cốt Lõi](#phần-t--trả-lời-trực-tiếp-10-câu-hỏi-cốt-lõi)
21. [Danh Sách Vấn Đề Kỹ Thuật (Known Issues / Technical Debt)](#danh-sách-vấn-đề-kỹ-thuật-known-issues--technical-debt)

---

## Phần A — Tổng Quan Repository

### 1. Repository này dùng để làm gì?
Repository này (gốc là dự án **MoneyPrinterTurbo**) là một hệ thống tự động hóa tạo short video (video ngắn 9:16 hoặc 16:9) từ một chủ đề (topic) hoặc kịch bản (script) cho trước. Hệ thống tự động điều phối chuỗi công việc:
1. Gọi LLM sinh kịch bản văn bản (Script) và các từ khóa tìm kiếm hình ảnh/video (Search Terms).
2. Gọi TTS (Text-to-Speech) để tạo file âm thanh đọc kịch bản.
3. Sinh file phụ đề SRT (từ thời gian biểu của TTS hoặc phân tích âm thanh qua Whisper).
4. Tìm kiếm và tải video stock bản quyền miễn phí từ Pexels, Pixabay, Coverr (hoặc lấy từ folder local).
5. Ghép nối video clip, đè nhạc nền (BGM), ghi phụ đề, và xuất file `.mp4` hoàn chỉnh.

### 2. Sự khác biệt giữa README và Kiến Trúc Thực Tế Trong Codebase
* **README**: Tập trung giải thích việc chạy dự án Python thuần thông qua Streamlit WebUI (`webui/Main.py`) hoặc FastAPI (`main.py`) hoặc CLI (`cli.py`).
* **Codebase Thực Tế**: Dự án đã được nâng cấp thành **Kiến trúc Doanh nghiệp Full-stack 3 Lớp (Three-tier Enterprise Architecture)** gồm:
  - **Lớp 1 (Frontend)**: Next.js + React + Tailwind CSS (nằm ở thư mục `frontend/`).
  - **Lớp 2 (Backend Core & Queue)**: NestJS API Gateway + PostgreSQL + Prisma ORM + BullMQ / Redis Task Queue (nằm ở thư mục `backend/`).
  - **Lớp 3 (Video Engine)**: Python Engine với MoviePy, FFmpeg, Edge-TTS, Pexels API, LLM SDKs (nằm ở thư mục `engine/`).

### 3. Technology Stack Tổng Thể
| Thành phần | Công nghệ sử dụng | Location |
| :--- | :--- | :--- |
| **Frontend** | Next.js 15, React 19, Tailwind CSS, TanStack Query | `frontend/` |
| **Backend API** | NestJS (TypeScript), Prisma ORM | `backend/src/` |
| **Database** | PostgreSQL 15 | Managed via Prisma (`backend/prisma/schema.prisma`) |
| **Queue / Worker** | BullMQ + Redis 7 | `backend/src/modules/queue/` |
| **Object Storage** | MinIO (S3 compatible) | `backend/src/modules/storage/` |
| **Video Engine** | Python 3.11, MoviePy 2.x, FFmpeg, Pillow, NumPy | `engine/app/services/video.py` |
| **LLM Provider** | Cloud API: Google Gemini, OpenAI, DeepSeek, Qwen, AIHubMix,... | `engine/app/services/llm.py` |
| **TTS Provider** | Edge TTS (Azure V1 free), Azure V2, SiliconFlow, Gemini, ElevenLabs | `engine/app/services/voice.py` |
| **Stock Media** | Pexels API, Pixabay API, Coverr API, Local files | `engine/app/services/material.py` |
| **Docker** | Docker Compose (`backend`, `frontend`, `postgres`, `redis`, `minio`) | `docker-compose.yml` |

---

## Phần B — Giải Thích Cấu Trúc Folder & Các File Quan Trọng

### 1. Cấu trúc tổng thể repository
```text
short-video/
├── backend/                  # NestJS backend service
│   ├── prisma/
│   │   └── schema.prisma     # Định nghĩa Database Schema (PostgreSQL)
│   ├── src/
│   │   ├── main.ts           # Entry point của NestJS API Server (Port 23001)
│   │   ├── app.module.ts     # Root module của backend
│   │   └── modules/
│   │       ├── database/     # Prisma database client wrapper
│   │       ├── ideas/        # Quản lý Ý tưởng (Ideas API) & Auto-script
│   │       ├── jobs/         # Quản lý Tiến trình tạo Video (Jobs API)
│   │       ├── llm/          # API wrapper cho LLM (Backend layer)
│   │       ├── queue/        # BullMQ Worker điều phối Python CLI (`video.processor.ts`)
│   │       ├── settings/     # Lưu trữ cấu hình hệ thống
│   │       ├── storage/      # MinIO S3 Object Storage Client
│   │       └── videos/       # Quản lý kết quả Video hoàn chỉnh
├── engine/                   # Python Core Video Engine (MoneyPrinterTurbo Core)
│   ├── main.py               # FastAPI Server (Port 8080)
│   ├── cli.py                # Command Line Interface chính được backend kích hoạt
│   ├── config.example.toml   # Mẫu file cấu hình API Key & Tham số
│   ├── config.toml           # File cấu hình thực tế khi chạy local
│   ├── app/
│   │   ├── config/config.py  # Loader đọc `config.toml` và env
│   │   ├── controllers/      # REST API Controllers (FastAPI)
│   │   ├── models/           # Data Schemas (Pydantic / Dataclasses)
│   │   ├── services/
│   │   │   ├── task.py       # Orchestrator chính của pipeline video Python
│   │   │   ├── llm.py        # Module tích hợp Gemini / OpenAI / DeepSeek...
│   │   │   ├── voice.py      # Module xử lý TTS (Edge-TTS, Azure, Gemini,...)
│   │   │   ├── material.py   # Module tìm kiếm & download video stock (Pexels, Pixabay)
│   │   │   ├── subtitle.py   # Module tạo & chỉnh sửa phụ đề SRT
│   │   │   ├── video.py      # Core ghép nối video, render FFmpeg & MoviePy
│   │   │   └── twelvelabs.py # Tích hợp AI TwelveLabs (Rerank B-roll)
│   │   └── utils/            # Helper bảo mật file & mã hóa
│   └── webui/
│       └── Main.py           # Giao diện Streamlit cũ (chạy độc lập nếu không dùng NestJS)
├── frontend/                 # Next.js Web App (Dashboard UI)
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx      # Redirect sang `/dashboard`
│   │   │   ├── dashboard/    # Trang Tổng quan hệ thống
│   │   │   ├── ideas/        # Trang Tạo & Quản lý ý tưởng
│   │   │   ├── jobs/         # Trang Theo dõi tiến trình render real-time
│   │   │   ├── videos/       # Trang Xem lại danh sách Video đã export
│   │   │   └── settings/     # Trang Cấu hình API Keys & TTS
│   │   ├── components/       # UI Components (JobsView, Sidebar, Toast,...)
│   │   └── lib/              # Client API call (`api.ts`, `backend-media.ts`)
├── docker-compose.yml        # Docker Compose khởi chạy full-stack (Postgres, Redis, MinIO, Backend, Frontend)
└── docs/                     # Thư mục tài liệu
```

---

### 2. Phân tích chi tiết các file quan trọng

#### File 1: `backend/src/modules/queue/video.processor.ts`
* **Vai trò:** Lớp Worker lắng nghe queue `video-generation` từ BullMQ.
* **Class:** `VideoProcessor` (kế thừa `WorkerHost`).
* **Function quan trọng:** `process(job: Job<VideoJobPayload>): Promise<unknown>`
* **Cơ chế hoạt động:**
  - Nhận job request từ NestJS API.
  - Cập nhật trạng thái job trong PostgreSQL (`GenerationJob` -> `running`).
  - Dùng Child Process (`spawn`) chạy lệnh:  
    `uv run --project engine python engine/cli.py --video-subject <subject> --task-id <jobId> ...`
  - Đọc `stdout` / `stderr` theo thời gian thực để phân tích tiến độ (ví dụ: thấy `## generating audio` -> cập nhật `progress = 35%`).
  - Ghi log từng dòng vào bảng `JobLog`.
  - Khi Python CLI hoàn thành (exit code 0), dùng `fluent-ffmpeg` chụp ảnh thumbnail từ `final-1.mp4`.
  - Upload `final-1.mp4`, `thumbnail.jpg`, `subtitle.srt`, `script.json` lên MinIO bucket.
  - Tạo record trong bảng `Video` và cập nhật `GenerationJob` -> `completed`.
  - Dọn dẹp thư mục tạm `engine/storage/tasks/{jobId}`.
* **Được gọi bởi:** BullMQ Worker Scheduler.
* **Gọi tới:** Lệnh CLI hệ thống (`uv run`), `PrismaService`, `StorageService`.

#### File 2: `engine/cli.py`
* **Vai trò:** Entry point của dòng lệnh Python Engine.
* **Function quan trọng:**
  - `parse_args()`: Parse tham số truyền từ backend (subject, script, voice_name, aspect_ratio,...).
  - `build_video_params(args)`: Chuyển đổi args thành đối tượng `VideoParams`.
  - `run_cli()`: Khởi tạo `task_id` và gọi `tm.start(task_id, params, stop_at)`.
* **Được gọi bởi:** `backend/src/modules/queue/video.processor.ts`.
* **Gọi tới:** `engine/app/services/task.py`.

#### File 3: `engine/app/services/task.py`
* **Vai trò:** "Bộ não" điều phối (Orchestrator) toàn bộ luồng tạo video của Python Engine.
* **Function quan trọng:**
  - `generate_script()`: Gọi LLM lấy kịch bản nếu user chưa nhập.
  - `generate_terms()`: Gọi LLM bóc tách từ khóa tìm kiếm B-roll từ kịch bản.
  - `generate_audio()`: Gọi TTS sinh âm thanh đọc kịch bản.
  - `generate_subtitle()`: Sinh file phụ đề `.srt` từ TTS alignment hoặc Whisper.
  - `get_video_materials()`: Tải video stock từ Pexels/Pixabay/Coverr hoặc kiểm tra file local.
  - `generate_final_videos()`: Gọi `video.combine_videos()` và `video.generate_video()` để render MP4.
  - `start()`: Hàm tổng sắp thứ tự từng bước 1 -> 6 và hỗ trợ cờ `stop_at`.
* **Được gọi bởi:** `engine/cli.py` hoặc FastAPI controller `engine/app/controllers/v1/video.py`.
* **Gọi tới:** `llm.py`, `voice.py`, `material.py`, `subtitle.py`, `video.py`.

#### File 4: `engine/app/services/llm.py`
* **Vai trò:** Abstraction Layer cho tất cả dịch vụ AI LLM (Gemini, OpenAI, DeepSeek, Qwen,...).
* **Function quan trọng:**
  - `_generate_response(prompt: str) -> str`: Kiểm tra `config.app.get("llm_provider")` và gọi SDK tương ứng.
  - `generate_script(...)`: Xây dựng Prompt sinh kịch bản dựa trên chủ đề, ngôn ngữ, số đoạn.
  - `generate_terms(...)`: Xây dựng Prompt yêu cầu LLM trích xuất 5–8 từ khóa tiếng Anh phục vụ tìm B-roll trên Pexels.
* **Chi tiết Gemini (`gemini` provider):**
  - Sử dụng thư viện `google.generativeai`.
  - Cấu hình qua `config.toml`: `gemini_api_key`, `gemini_model_name` (mặc định `gemini-2.5-flash`).
  - Hỗ trợ đổi `base_url` nếu qua proxy.
* **Được gọi bởi:** `engine/app/services/task.py`.

#### File 5: `engine/app/services/voice.py`
* **Vai trò:** Xử lý chuyển đổi văn bản thành giọng nói (TTS) và căn chỉnh thời gian phụ đề.
* **Function quan trọng:**
  - `tts(text, voice_name, voice_rate, voice_file)`: Router phân phối đến provider tương ứng (`azure_tts_v1`, `azure_tts_v2`, `gemini_tts`, `siliconflow_tts`, `mimo_tts`, `elevenlabs_tts`).
  - `azure_tts_v1(...)`: Mặc định gọi thư viện **`edge_tts`** (Miễn phí hoàn toàn, không cần API Key).
  - `create_subtitle(...)`: Sử dụng đối tượng `SubMaker` từ Edge-TTS để tạo timestamp cho phụ đề.
* **Được gọi bởi:** `engine/app/services/task.py`.

#### File 6: `engine/app/services/material.py`
* **Vai trò:** Phụ trách tìm kiếm và download clip B-roll từ Cloud API.
* **Function quan trọng:**
  - `search_videos_pexels(search_term, minimum_duration, video_aspect)`: Gọi Pexels Video Search API.
  - `search_videos_pixabay(...)`: Gọi Pixabay Video API.
  - `search_videos_coverr(...)`: Gọi Coverr Video API.
  - `download_videos(...)`: Quản lý vòng lặp tải clip về thư mục tạm `engine/storage/tasks/{task_id}/materials/`.
* **Được gọi bởi:** `engine/app/services/task.py`.

#### File 7: `engine/app/services/video.py`
* **Vai trò:** Core Render Engine xử lý đồ họa, cắt ghép clip và ghi đè âm thanh/phụ đề.
* **Function quan trọng:**
  - `combine_videos()`: Cắt ngắn các clip B-roll, thay đổi tỉ lệ (Crop/Resize 9:16), nối lại thành clip dài bằng thời lượng audio (`combined-1.mp4`).
  - `generate_video()`: Ghép `combined-1.mp4` với `audio.mp3`, ghi phụ đề chữ bằng MoviePy/Pillow (`TextClip`/`SubtitlesClip`), thêm nhạc nền BGM và xuất file `final-1.mp4`.
* **Được gọi bởi:** `engine/app/services/task.py`.

---

## Phần C — Trace Toàn Bộ Flow Tạo Một Video (End-to-End Flow)

Dưới đây là luồng thực thi chi tiết từ khi người dùng nhập thông tin trên giao diện cho đến khi file video `.mp4` được upload lên MinIO và hiển thị trên màn hình:

```text
[User trên Browser]
       │ (1) Nhập Topic / Chọn Voice / Chọn Khung hình (9:16)
       ▼
[Frontend: Next.js]
       │ (2) POST /api/ideas (tạo ý tưởng) hoặc POST /api/jobs (tạo job)
       ▼
[Backend API: NestJS Controller] (`backend/src/modules/ideas/ideas.controller.ts`)
       │ (3) Tạo record Idea & GenerationJob trong PostgreSQL (Status: "queued")
       │ (4) Dispatch job vào BullMQ Queue ("video-generation")
       ▼
[Queue Worker: VideoProcessor] (`backend/src/modules/queue/video.processor.ts`)
       │ (5) Chuyển Job status -> "running"
       │ (6) Spawns Child Process:
       │     `uv run --project engine python engine/cli.py --video-subject "..." --task-id "<jobId>"`
       ▼
[Python Engine CLI] (`engine/cli.py`)
       │ (7) Parse CLI Arguments & tạo object `VideoParams`
       │ (8) Gọi `tm.start(task_id, params)`
       ▼
[Python Task Service] (`engine/app/services/task.py`)
       ├─► [LLM Module] (`engine/app/services/llm.py`)
       │     │ (9) Sinh Kịch Bản: Gọi Gemini API (`gemini-2.5-flash`)
       │     │ (10) Sinh Term Tìm Kiếm: Gemini bóc tách từ khóa (ví dụ: "coffee maker, espresso pouring")
       │     └─ Output: Save vào `engine/storage/tasks/{jobId}/script.json`
       │
       ├─► [TTS Module] (`engine/app/services/voice.py`)
       │     │ (11) Tạo Audio: Gọi Edge-TTS (`azure_tts_v1`) sinh giọng đọc
       │     └─ Output: Save vào `engine/storage/tasks/{jobId}/audio.mp3`
       │
       ├─► [Subtitle Module] (`engine/app/services/subtitle.py` & `voice.py`)
       │     │ (12) Tạo Phụ đề: Trích xuất timestamp từ Edge-TTS `SubMaker`
       │     └─ Output: Save vào `engine/storage/tasks/{jobId}/subtitle.srt`
       │
       ├─► [Material Module] (`engine/app/services/material.py`)
       │     │ (13) Tải B-roll: Gọi Pexels/Pixabay API theo `search_terms`
       │     └─ Output: Save các file clip vào `engine/storage/tasks/{jobId}/materials/`
       │
       └─► [Video Engine] (`engine/app/services/video.py`)
             │ (14) Nối Video: Crop/Resize 1080x1920 (9:16), nối clip -> `combined-1.mp4`
             │ (15) Render Cuối: Trộn `combined-1.mp4` + `audio.mp3` + `subtitle.srt` + BGM -> `final-1.mp4`
             └─ Output: `engine/storage/tasks/{jobId}/final-1.mp4`
       ▼
[Python Engine CLI Hoàn Thành] (Exit Code 0)
       ▼
[Queue Worker: VideoProcessor] (Tiếp tục xử lý sau CLI)
       │ (16) Đọc log `stdout`/`stderr` phát hiện CLI xong
       │ (17) Dùng FFmpeg chụp thumbnail từ `final-1.mp4` -> `thumbnail.jpg`
       │ (18) Upload `final-1.mp4`, `thumbnail.jpg`, `subtitle.srt`, `script.json` lên MinIO Storage
       │ (19) Ghi record mới vào bảng `Video` trong PostgreSQL
       │ (20) Cập nhật trạng thái `GenerationJob` -> "completed" (progress = 100%)
       │ (21) Xóa thư mục tạm `engine/storage/tasks/{jobId}/`
       ▼
[Frontend Dashboard]
       │ (22) React Query Polling API phát hiện Job completed -> Reload giao diện & Play Video từ MinIO
```

---

## Phần D — AI Provider Architecture (LLM)

### 1. Danh sách các Provider hỗ trợ hiện tại
Codebase hỗ trợ rất nhiều LLM Provider thông qua lớp trừu tượng `_generate_response()` trong file `engine/app/services/llm.py`:
* **Cloud API Trực tiếp:** `gemini`, `openai`, `azure`, `qwen`, `moonshot`, `deepseek`, `minimax`, `volcengine`, `mimo`, `ernie`, `modelscope`, `grok`, `groq`, `cloudflare`, `pollinations`.
* **Cloud Gateway / Aggregator:** `aihubmix`, `aimlapi`, `evolink`, `oneapi`, `litellm`.
* **Local Inference:** `ollama` (Chạy model local qua Ollama server).
* **Reverse-engineered (Cảnh báo không dùng):** `g4f` (mặc định bị disable).

### 2. Phân tích chi tiết vị trí & cơ chế gọi Google Gemini
* **File chứa logic gọi Gemini:** `engine/app/services/llm.py` (từ dòng 398 đến dòng 450).
* **Nơi cấu hình API Key:**
  - File `config.toml` (hoặc `config.example.toml` mẫu):
    ```toml
    [app]
    llm_provider = "gemini"
    gemini_api_key = "AIzaSy..."
    gemini_model_name = "gemini-2.5-flash"
    gemini_base_url = "" # Để trống nếu gọi trực tiếp Google Cloud API
    ```
* **Cơ chế Abstraction:**
  Hệ thống **đã có lớp trừu tượng (Abstraction Interface)** hoàn chỉnh. Hàm `_generate_response(prompt)` hoạt động theo pattern **Strategy**:
  ```python
  # Trong engine/app/services/llm.py
  llm_provider = config.app.get("llm_provider", "openai")
  if llm_provider == "gemini":
      import google.generativeai as genai
      genai.configure(api_key=api_key, transport="rest")
      model = genai.GenerativeModel(model_name=model_name, ...)
      response = model.generate_content(prompt)
      return _normalize_text_response(generated_text, llm_provider)
  ```
* **Khả năng thay đổi Provider:** Cực kỳ dễ dàng. Chỉ cần đổi giá trị `llm_provider = "gemini"` trong `config.toml` hoặc chọn provider qua UI API mà không cần sửa một dòng code nào của video engine.

---

## Phần E — TTS Pipeline (Text-to-Speech)

### 1. Các TTS Provider đang hỗ trợ trong Codebase
Codebase tại `engine/app/services/voice.py` hỗ trợ các provider:
1. **Edge TTS (Azure V1 - Mặc định):** Sử dụng thư viện Python `edge_tts`. **Miễn phí 100%**, không cần API Key, không giới hạn ký tự khắt khe, chất lượng giọng tiếng Việt (`vi-VN-HoaiMyNeural`, `vi-VN-NamMinhNeural`) rất mượt.
2. **Azure TTS V2:** Dùng Azure Speech SDK chính thức (Cần `speech_key` và `speech_region`).
3. **SiliconFlow TTS:** Dùng model `CosyVoice2`.
4. **Gemini TTS:** Dùng giọng Gemini Cloud (`gemini:Zephyr-Female`, `gemini:Puck-Male`,...).
5. **Xiaomi MiMo TTS:** Dùng `mimo-v2.5-tts`.
6. **ElevenLabs TTS:** Dùng ElevenLabs API (`elevenlabs:{voice_id}`).
7. **OpenAI TTS:** Dùng `tts-1` / `tts-1-hd`.
8. **Chatterbox TTS:** Tự host server Chatterbox.

### 2. Đánh giá tính phù hợp với máy yếu & Yêu cầu Cloud/Free TTS
> **ĐÁNH GIÁ:** Architecture TTS của dự án **CỰC KỲ PHÙ HỢP** với yêu cầu của bạn.
* Mặc định dự án dùng **Edge TTS (`azure_tts_v1`)** hoàn toàn chạy trên Cloud của Microsoft, **không tiêu tốn CPU/GPU local**, **không cần tải model local**, và **không tốn tiền API key**.
* File âm thanh xuất ra lưu tại `engine/storage/tasks/{task_id}/audio.mp3`.
* Pipeline đọc duration trực tiếp từ file MP3 thông qua `AudioFileClip` hoặc `pydub` để căn chỉnh độ dài video B-roll.

---

## Phần F — Image / Video / Stock Media Pipeline

### 1. Cơ chế tìm kiếm & Tải Footage B-roll
Tất cả logic tìm kiếm media nằm ở `engine/app/services/material.py` và `engine/app/services/video.py`:

```text
1. LLM tách Kịch bản -> 5-8 từ khóa (search_terms)
                         ↓
2. material.download_videos() duyệt từng term
                         ↓
3. Gọi API Cloud (Pexels / Pixabay / Coverr)
                         ↓
4. Download video clips về folder: `engine/storage/tasks/{task_id}/materials/`
                         ↓
5. video.combine_videos() xử lý Crop 9:16 & Cắt ngắn từng clip
                         ↓
6. Nối các clip đã cắt thành video dài bao phủ toàn bộ thời lượng Audio
```

### 2. Hướng dẫn tùy biến logic cho Affiliate Product Video
Hiện tại, dự án dùng từ khóa tổng quan để tải B-roll ngẫu nhiên. Để biến hệ thống thành Affiliate Video, bạn sẽ cần:
1. Cho phép đầu vào là danh sách hình ảnh/video thực tế của **Sản phẩm** (Product Footage/Images).
2. Khi `params.video_source == "local"`, hệ thống gọi hàm `video.preprocess_video()` ở `engine/app/services/video.py`.
3. Bạn có thể mở rộng logic này để tải hình ảnh sản phẩm từ URL Affiliate/Shopee/TikTok Shop, sau đó dùng Pillow/MoviePy biến ảnh tĩnh thành video clip ngắn (Dynamic Zoom / Pan effect) để ghép vào pipeline.

---

## Phần G — Subtitle Engine

### 1. Cơ chế tạo phụ đề
Hệ thống hỗ trợ 2 chế độ tạo phụ đề (cấu hình qua `subtitle_provider` trong `config.toml`):
* **Mode `edge` (Mặc định - Khuyên dùng):** Trích xuất timestamp từ luồng WebSocket của Edge-TTS (`SubMaker`). Chạy cực nhanh trên Cloud, **không tốn GPU**, không cần tải model local.
* **Mode `whisper` (Local model):** Dùng `faster-whisper` phiên bản local để tự transcode file audio.mp3. (Cách này yêu cầu tải model 250MB - 3GB và tốn CPU/GPU local => **Không nên dùng** với máy yếu).

### 2. Format & Styling phụ đề
* **Format xuất ra:** File chuẩn SRT (`engine/storage/tasks/{task_id}/subtitle.srt`).
* **Đốt phụ đề vào Video (Subtitle Burn-in):** Thực hiện ở `engine/app/services/video.py` hàm `generate_video()` sử dụng `SubtitlesClip` của MoviePy kết hợp với **Pillow (PIL)**.
* **Các thuộc tính Subtitle có thể Custom hiện tại:**
  - Font chữ (`font_name`): Lấy từ `engine/resource/fonts/` (Đã hỗ trợ font tiếng Việt `BeVietnamPro-Bold.ttf`).
  - Cỡ chữ (`font_size`).
  - Màu chữ (`text_fore_color` - Dạng Hex `#FFFFFF`).
  - Viền chữ (`stroke_color`, `stroke_width`).
  - Vị trí (`subtitle_position`: `top`, `center`, `bottom`, `custom`).
  - Nền phụ đề (`text_background_color`, `rounded_subtitle_background`).

### 3. Đánh giá cho Subtitle kiểu TikTok/Shorts
* Kiến trúc hiện tại của `video.py` đã hỗ trợ render viền chữ, màu chữ và nền bo tròn.
* Để làm phụ đề dạng **nổi bật từng từ (Word-by-word highlight)** kiểu TikTok/Shorts nâng cao, bạn có thể tùy biến hàm render text clip trong `video.py` mà không làm ảnh hưởng đến toàn bộ pipeline phía trên.

---

## Phần H — Video Rendering Engine

### 1. Công nghệ rendering thực tế
Repository **KHÔNG** sử dụng Remotion hay OpenCV. Hệ thống sử dụng kết hợp:
* **MoviePy 2.x:** Quản lý Timeline, sắp xếp lớp âm thanh (Audio tracks) và lớp hình ảnh/video (Video tracks).
* **FFmpeg:** Đảm nhiệm việc ghép nối thô (concat), mã hóa file (encoding), và xuất file MP4 cuối cùng.
* **Pillow (PIL):** Render text và đồ họa phụ đề chất lượng cao thành Frame Image trước khi đưa vào MoviePy.

### 2. Thông số Video mặc định
* **Độ phân giải (Resolution):** 
  - Khung dọc 9:16: `1080x1920` (Chuẩn TikTok / Shorts / Reels).
  - Khung ngang 16:9: `1920x1080`.
* **Tốc độ khung hình (FPS):** `30 FPS`.
* **Video Codec:** `libx264` (H.264 CPU software encoder - Tương thích 100% với mọi hệ thống Linux/Windows).
* **Audio Codec:** `aac`, bitrate `192k`.
* **File tạm:** Lưu ở `engine/storage/tasks/{jobId}/` (`combined-1.mp4`, `final-1.mp4`, `audio.mp3`, `subtitle.srt`).
* **File output:** Tải lên MinIO S3 storage (`videos/{jobId}/final.mp4`).

### 3. Đánh giá khả năng chạy trên Linux Mint Máy Yếu
> **KẾT LUẬN: CHẠY TỐT 100%.**
* Do toàn bộ bước nặng nhất (AI LLM, Voice TTS, Stock Media Search) đều dùng **Cloud API**, máy Linux Mint của bạn **chỉ tốn CPU ở bước FFmpeg Encode cuối cùng**.
* Một video ngắn 30-60 giây render bằng `libx264` trên CPU 4 nhân bình thường chỉ tốn khoảng 30 - 60 giây rendering. RAM chiếm dụng dưới 2GB.

---

## Phần I — Database Và Storage Architecture

### 1. Cấu trúc Database Hiện Tại (PostgreSQL + Prisma ORM)
File schema duy nhất tại `backend/prisma/schema.prisma` định nghĩa 5 bảng:

```mermaid
erDiagram
    Idea ||--o{ GenerationJob : "has many"
    Idea ||--o{ Video : "has many"
    GenerationJob ||--o{ Video : "produces"
    GenerationJob ||--o{ JobLog : "generates"

    Idea {
        string id PK
        string title
        string topic
        string description
        string script
        string language
        string[] tags
        string status
    }

    GenerationJob {
        string id PK
        string ideaId FK
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
        string script
        string videoObjectKey
        string thumbnailObjectKey
        string subtitleObjectKey
        string metadataObjectKey
    }

    JobLog {
        string id PK
        string jobId FK
        string level
        string message
    }

    SystemSetting {
        string key PK
        string value
    }
```

### 2. Đánh giá & Đề xuất Schema cho Hệ thống Affiliate Video Automation
Để phát triển hệ thống Affiliate Video, bạn **NÊN BỔ SUNG DATABASE** thay vì chỉ dùng filesystem. Dưới đây là đề xuất các Entity bổ sung (chỉ ở mức Architecture, chưa sửa code):

```prisma
// Entity Quản lý Sản Phẩm Affiliate
model Product {
  id              String   @id @default(uuid())
  title           String   // Tên sản phẩm
  productUrl      String   // Link sản phẩm gốc (Shopee, Lazada, TikTok Shop)
  affiliateUrl    String   // Link Affiliate chứa ID hoa hồng
  price           String?  // Giá bán / Giảm giá
  features        String[] // Danh sách tính năng nổi bật / USP
  images          String[] // Danh sách URL hình ảnh sản phẩm
  category        String?
  createdAt       DateTime @default(now())
  
  marketingAngles MarketingAngle[]
}

// Entity Phân tích Marketing Angle cho Sản Phẩm
model MarketingAngle {
  id          String   @id @default(uuid())
  productId   String
  product     Product  @relation(fields: [productId], references: [id], onDelete: Cascade)
  angleTitle  String   // Ví dụ: "Giải pháp cho người bận rộn", "So sánh giá"
  hookText    String   // Câu Hook 3s đầu tiên
  targetAudience String?
  scripts     Idea[]
}
```

---

## Phần J — Configuration & Environment Variables

### 1. Các biến cấu hình chính trong `engine/config.toml`
All configurations located at `engine/config.toml` (copy from `config.example.toml`):

| Biến / Section | Vai trò | Đọc ở file | Bắt buộc? | API Free / Cloud? |
| :--- | :--- | :--- | :--- | :--- |
| `[app] llm_provider` | Chọn AI provider (`gemini`, `openai`, `aihubmix`,...) | `engine/app/services/llm.py` | Bắt buộc | Có (Gemini / Free Tier) |
| `gemini_api_key` | Key gọi Google Gemini AI | `engine/app/services/llm.py` | Bắt buộc nếu dùng Gemini | Có (Miễn phí 15 RPM) |
| `gemini_model_name` | Tên model (`gemini-2.5-flash`) | `engine/app/services/llm.py` | Optional | Miễn phí |
| `pexels_api_keys` | Danh sách Key Pexels tải video B-roll | `engine/app/services/material.py` | Bắt buộc nếu dùng Pexels | Có (Free Key 200 req/hr) |
| `pixabay_api_keys` | Key Pixabay tải B-roll | `engine/app/services/material.py` | Optional | Có (Free Key) |
| `coverr_api_keys` | Key Coverr tải B-roll | `engine/app/services/material.py` | Optional | Có (Free Key) |
| `edge_tts_timeout` | Timeout cho Edge-TTS (mặc định 30s) | `engine/app/services/voice.py` | Optional | Miễn phí hoàn toàn |
| `ffmpeg_path` | Đường dẫn FFmpeg nếu không dùng mặc định | `engine/app/config/config.py` | Optional | N/A (Hệ thống) |

### 2. Các biến môi trường của Backend (`backend/.env` hoặc `docker-compose.yml`)
* `DATABASE_URL`: `postgresql://postgres:postgres@postgres:5432/videotool?schema=public`
* `REDIS_HOST`: `redis` / `localhost`
* `REDIS_PORT`: `6379`
* `MINIO_ENDPOINT`: `minio` / `localhost`
* `MINIO_ACCESS_KEY`: `minioadmin`
* `MINIO_SECRET_KEY`: `minioadmin`
* `MINIO_BUCKET_NAME`: `videos`
* `PORT`: `23001` (Port backend API)

---

## Phần K — Hướng Dẫn Chạy Repository Trên Linux Mint

Dưới đây là hướng dẫn từng bước chuẩn xác dành cho máy **Linux Mint**.

### Cách 1: Recommended — Chạy Bằng Docker Compose (Nhanh & Ổn định nhất)

#### Bước 1: Chuẩn bị file cấu hình
```bash
cd short-video
cp engine/config.example.toml engine/config.toml
```

#### Bước 2: Điền API Key vào `engine/config.toml`
Mở `engine/config.toml` và sửa:
```toml
[app]
llm_provider = "gemini"
gemini_api_key = "AIzaSyYOUR_ACTUAL_GEMINI_KEY"
pexels_api_keys = ["YOUR_ACTUAL_PEXELS_KEY"]
```

#### Bước 3: Khởi chạy Docker Compose
```bash
docker compose up -d
```

#### Bước 4: Mở trình duyệt
* **Frontend UI Dashboard:** http://localhost:23000
* **Backend API Docs (Swagger):** http://localhost:23001/api
* **MinIO Console (Storage):** http://localhost:29001 (User: `minioadmin` / Pass: `minioadmin`)

---

### Cách 2: Manual — Chạy Trực Tiếp Local (Không qua Docker containers)

Nếu máy bạn ít RAM và muốn chạy trực tiếp không qua Docker:

#### Yêu cầu cài trước trên Linux Mint:
* Python 3.11 & `uv` package manager (`curl -LsSf https://astral.sh/uv/install.sh | sh`)
* Node.js v20+ & `pnpm` hoặc `npm`
* FFmpeg (`sudo apt install ffmpeg`)
* PostgreSQL 15 & Redis server

#### Bước 1: Cài đặt dependencies cho Python Engine
```bash
cd short-video/engine
uv sync --frozen
cp config.example.toml config.toml
# Sửa gemini_api_key và pexels_api_keys trong config.toml
```

#### Bước 2: Cài đặt & Migrate Database cho Backend
```bash
cd ../backend
npm install
# Đảm bảo PostgreSQL đang chạy và DATABASE_URL đúng trong file .env
npx prisma db push
```

#### Bước 3: Cài đặt Frontend
```bash
cd ../frontend
npm install
```

#### Bước 4: Chạy các dịch vụ (Mở 3 terminal riêng)
* **Terminal 1 (Backend API):**
  ```bash
  cd backend && npm run start:dev
  ```
* **Terminal 2 (Frontend UI):**
  ```bash
  cd frontend && npm run dev
  ```
* **Terminal 3 (Test thử Python CLI trực tiếp không qua Web):**
  ```bash
  cd engine
  uv run python cli.py --video-subject "Top 3 đồ gia dụng thông minh" --video-aspect 9:16
  ```

---

## Phần L — Ma Trận Tính Năng Hiện Tại (Feature Matrix)

| Feature | Đã có? | File / Location | Có cần sửa để làm Affiliate? |
| :--- | :---: | :--- | :--- |
| **AI Script Generation** | **ĐÃ CÓ** | `engine/app/services/llm.py` -> `generate_script()` | **Nên sửa Prompt** để tối ưu bài bán hàng |
| **Google Gemini Support** | **ĐÃ CÓ** | `engine/app/services/llm.py` (Provider `gemini`) | Không cần sửa (chỉ cấu hình Key) |
| **Cloud TTS (Free)** | **ĐÃ CÓ** | `engine/app/services/voice.py` -> `azure_tts_v1()` (Edge-TTS) | Không cần sửa (Đã có giọng Việt) |
| **Stock Video Search** | **ĐÃ CÓ** | `engine/app/services/material.py` -> `search_videos_pexels()` | **Nên sửa** để hỗ trợ tải ảnh sản phẩm thực tế |
| **Custom Local Material** | **ĐÃ CÓ** | `engine/app/services/task.py` -> `get_video_materials()` | Giữ nguyên |
| **Subtitle Burn-in** | **ĐÃ CÓ** | `engine/app/services/video.py` -> `generate_video()` | **Có thể sửa** nếu muốn animation TikTok kiểu mới |
| **Video Format 9:16** | **ĐÃ CÓ** | `engine/app/services/video.py` (`VideoAspect.portrait`) | Giữ nguyên |
| **Batch Generation** | **ĐÃ CÓ** | `backend/src/modules/ideas/ideas.service.ts` & `cli.py` | Giữ nguyên / Mở rộng |
| **REST API Server** | **ĐÃ CÓ** | `backend/src/main.ts` & `engine/main.py` | Giữ nguyên |
| **Web UI Dashboard** | **ĐÃ CÓ** | `frontend/src/app/dashboard/page.tsx` | **Nên sửa** để thêm tab Quản lý Sản phẩm |
| **Database Storage** | **ĐÃ CÓ** | `backend/prisma/schema.prisma` (PostgreSQL + Prisma) | **Cần sửa** để thêm bảng Product/Affiliate |
| **Export MP4 Video** | **ĐÃ CÓ** | `backend/src/modules/queue/video.processor.ts` -> MinIO | Giữ nguyên |
| **Product Link Parser** | **CHƯA CÓ**| N/A | **CẦN THÊM MỚI (P0)** |
| **Affiliate Link Manager**| **CHƯA CÓ**| N/A | **CẦN THÊM MỚI (P0)** |
| **Product Research Agent**| **CHƯA CÓ**| N/A | **CẦN THÊM MỚI (P0)** |

---

## Phần M — Phân Tích Khoảng Cách (Gap Analysis): Hệ Thống Affiliate Còn Thiếu Gì?

So sánh giữa **Codebase Hiện Tại** và **Hệ Thống Affiliate Mục Tiêu**:

```text
CURRENT REPOSITORY (MoneyPrinterTurbo)           MY TARGET AFFILIATE SYSTEM
Topic / General Prompt                             Product Link / Affiliate Link
       ↓                                                  ↓
AI Script (Chủ đề chung chung)                     Product Scraping & Feature Extraction
       ↓                                                  ↓
Stock Media (Pexels / Pixabay)                     Marketing Angle + Hook 3s + Product Script
       ↓                                                  ↓
TTS Audio & Subtitle                               Product Images/Videos + Voiceover
       ↓                                                  ↓
Render MP4                                         Render Video với Price Badge & Affiliate CTA
```

### Phân loại mức độ ưu tiên tính năng cần làm:

#### P0 — Bắt buộc phải làm (để có MVP Affiliate Video Automation)
1. **Product Input & Storage:** Thêm bảng `Product` trong Database lưu `title`, `productUrl`, `affiliateUrl`, `price`, `images`.
2. **Product Research Module:** Module cào/thu thập dữ liệu thông số, điểm nổi bật của sản phẩm từ URL.
3. **Marketing Angle & Script Prompt Customization:** Tùy biến Prompt trong `llm.py` để Gemini tạo kịch bản theo công thức bán hàng (Hook 3s -> Pain Point -> Solution -> Product USP -> Call to Action kèm Link Affiliate).
4. **Product Media Integration:** Cho phép đưa hình ảnh sản phẩm vào luồng render video thay vì 100% video B-roll từ Pexels.

#### P1 — Quan trọng (Làm sau khi MVP hoạt động)
1. **Affiliate Overlay Template:** Đè Call-To-Action (ví dụ: "Link mua sản phẩm ở tiểu sử / comment") và Bảng giá lên video.
2. **Batch Product Generation:** Chọn 5 sản phẩm -> Tự động sinh 5 video hàng loạt.
3. **Quản lý Template Video:** Tùy chọn tone giọng, nhạc nền hot trend theo từng ngách sản phẩm.

#### P2 — Nâng cao (Có thể làm sau)
1. **Auto Posting:** Tự động đăng video lên TikTok / Shorts / Reels qua API.
2. **A/B Testing Kịch bản:** Sinh 3 phiên bản Hook khác nhau cho cùng 1 sản phẩm.
3. **Thống kê Click Affiliate & Doanh thu.**

---

## Phần N — Kiến Trúc Hệ Thống Mục Tiêu (Affiliate Video Automation)

Hệ thống mục tiêu tận dụng **100% kiến trúc 3 lớp hiện tại** của repository, chỉ mở rộng thêm Service Layer cho Affiliate:

```text
                        AFFILIATE AUTOMATION SYSTEM

                          User (Web UI Frontend)
                                   │
                                   ▼
                       [Product Manager Module]
                       (Nhập Link Shopee/TikTok)
                                   │
                                   ▼
                       [Product Research Service]
                     (Phân tích USP, Giá, Ảnh SP)
                                   │
                                   ▼
                        [Database: PostgreSQL]
                       (Lưu Product & Affiliate)
                                   │
                                   ▼
                       [AI Marketing Agent (Gemini)]
                (Sinh Hook 3s + Kịch bản Affiliate Sales)
                                   │
                                   ▼
            ┌──────────────────────┴──────────────────────┐
            ▼                                             ▼
  [Product Media Merger]                           [Edge-TTS Engine]
(Biến ảnh SP + Pexels B-roll                       (Tạo giọng đọc
 thành video clips 9:16)                           tiếng Việt chuẩn)
            │                                             │
            └──────────────────────┬──────────────────────┘
                                   ▼
                       [Core Video Engine (MoviePy)]
                   (Ghép clip + Burn Subtitle + CTA Badge)
                                   │
                                   ▼
                        [MinIO Storage / Export]
                                   │
                                   ▼
                           [Preview & Publish]
```

---

## Phần O — Tôi Cần Sửa Code Ở Đâu? (Exact Code Modification Mapping)

Đây là bảng tra cứu chính xác từng file và hàm bạn cần đụng tới khi tùy biến:

| Mục tiêu Customization | File hiện tại cần sửa | Function / Class liên quan | Hướng biến đổi code |
| :--- | :--- | :--- | :--- |
| **1. Nhập sản phẩm & Link Affiliate** | `backend/prisma/schema.prisma`<br>`backend/src/modules/ideas/` | Model `Idea`<br>`IdeasService.create()` | Thêm model `Product` vào Prisma schema và thêm API endpoint nhận `productUrl`, `affiliateUrl`. |
| **2. AI Sinh Kịch bản bán hàng (Affiliate Script)** | `engine/app/services/llm.py` | `DEFAULT_SCRIPT_SYSTEM_PROMPT`<br>`generate_script()` | Thay đổi System Prompt thành cấu trúc kịch bản bán hàng (Hook 3s -> Problem -> Product Solution -> CTA). |
| **3. Thêm Hình ảnh Sản phẩm vào Video** | `engine/app/services/material.py`<br>`engine/app/services/video.py` | `download_videos()`<br>`preprocess_video()` | Thêm logic chuyển danh sách URL hình ảnh sản phẩm thành các video clip ngắn (dùng MoviePy `ImageClip` với hiệu ứng Zoom-in). |
| **4. Thay đổi Giọng đọc / Ngôn ngữ TTS** | `engine/app/services/voice.py` | `parse_voice_name()` | Đổi voice mặc định thành giọng đọc bán hàng tiếng Việt phù hợp (`vi-VN-HoaiMyNeural` hoặc `vi-VN-NamMinhNeural`). |
| **5. Thêm Overlay Sticker / Khung Bán Hàng** | `engine/app/services/video.py` | `generate_video()` | Thêm lớp `ImageClip` đè Sticker "Mua ngay tại Link Bio" hoặc khung giá tiền vào vị trí góc dưới video. |
| **6. Giao diện Web UI Nhập Sản Phẩm** | `frontend/src/app/ideas/page.tsx` | Form React Component | Thêm ô nhập Link sản phẩm & Link Affiliate thay vì chỉ nhập Topic chung chung. |

---

## Phần P — Những Phần TUYỆT ĐỐI KHÔNG Nên Sửa

Để đảm bảo hệ thống hoạt động ổn định và **tối thiểu hóa khối lượng sửa code**, bạn **GHI NHỚ NÊN GIỮ NGUYÊN** các module sau:

1. **`backend/src/modules/queue/video.processor.ts` (BullMQ Worker):** Cơ chế quản lý queue, spawn CLI process và đọc log real-time đã hoạt động rất chuẩn xác.
2. **`backend/src/modules/storage/storage.service.ts` (MinIO S3 Client):** Logic upload file MP4, thumbnail, subtitle lên MinIO không cần thay đổi.
3. **`engine/app/services/video.py` -> `combine_videos()`:** Hàm ghép nối video thô theo tỉ lệ 9:16 và căn độ dài audio đã được tối ưu rất tốt.
4. **`engine/app/services/voice.py` -> `azure_tts_v1()` (Edge-TTS wrapper):** Giữ nguyên vì đây là dịch vụ TTS Cloud miễn phí tuyệt vời nhất cho tiếng Việt.
5. **Cấu trúc trừu tượng Provider LLM (`engine/app/services/llm.py`):** Chỉ sửa Prompt, không sửa cấu trúc gọi SDK Gemini.

---

## Phần Q — Đề Xuất Roadmap Implementation (Phase 0 đến Phase 10)

```text
Phase 0: Hiểu và Chạy thử Dự Án Hiện Tại
  └─ Cấu hình `config.toml` với Gemini Key & Pexels Key.
  └─ Chạy thử `docker compose up` hoặc chạy CLI sinh 1 video đầu tiên thành công.

Phase 1: Tùy Chỉnh Prompt Kịch Bản Bán Hàng (Affiliate Prompting)
  └─ Sửa `DEFAULT_SCRIPT_SYSTEM_PROMPT` trong `engine/app/services/llm.py`.
  └─ Test sinh kịch bản cho 1 sản phẩm cụ thể (ví dụ: "Nồi chiên không dầu").

Phase 2: Mở Rộng Schema Database Sản Phẩm
  └─ Thêm model `Product` vào `backend/prisma/schema.prisma`.
  └─ Chạy `npx prisma db push` để update PostgreSQL.

Phase 3: Xây Dựng Feature Thu Thập Thông Tin Sản Phẩm (Product Research)
  └─ Tạo module trong Backend hoặc Python Engine để cào thông tin tiêu đề, giá, hình ảnh từ Link sản phẩm.

Phase 4: Tích Hợp Media Sản Phẩm Vào Video Engine
  └─ Cập nhật `engine/app/services/material.py` để xử lý danh sách URL hình ảnh sản phẩm.
  └─ Dùng MoviePy biến ảnh sản phẩm thành video clip ngắn 9:16.

Phase 5: Thêm Overlay Call-To-Action (CTA) & Sticker Bán Hàng
  └─ Cập nhật `engine/app/services/video.py` hàm `generate_video()` đè logo/text "Link mua hàng ở Bio".

Phase 6: Tùy Chỉnh Frontend Dashboard Cho Affiliate
  └─ Sửa giao diện `frontend/src/app/ideas/page.tsx` thành màn hình "Thêm Sản Phẩm Affiliate".

Phase 7: Kiểm Thử Tạo Video Hàng Loạt (Batch Generation)
  └─ Chạy thử tạo 5-10 video cho 5 sản phẩm khác nhau.

Phase 8: Tự Động Hóa & Tối Ưu Hóa Render
  └─ Đánh giá tốc độ render trên Linux Mint và tinh chỉnh số luồng (`n_threads`).

Phase 9: Tích Hợp Đăng Tự Động (Auto Publishing - Optional)
  └─ Tích hợp TikTok Open API / YouTube Data API nếu có nhu cầu tự đăng.

Phase 10: Phân Tích Hiệu Quả & Đo Lường (Analytics - Optional)
  └─ Quản lý lượt view và click link affiliate.
```

---

## Phần R — Giải Thích Cho Người Không Biết Codebase / Không Rành Python

Nếu bạn là một Developer chưa quen làm việc với Python và codebase này, hãy nhớ **Tư duy Mô hình 3 Bước Simple**:

```text
[Input: Dữ liệu đầu vào] ──► [Processing: Xử lý] ──► [Output: Dữ liệu đầu ra]
```

Dưới đây là bảng giải thích ngắn gọn 5 hàm quan trọng nhất trong toàn bộ dự án theo tư duy này:

### 1. Hàm `generate_script()` (`engine/app/services/llm.py`)
* **Input:** Tên sản phẩm / Chủ đề (Ví dụ: `"Nồi chiên không dầu Philips"`).
* **Xử lý:** Gửi prompt sang Google Gemini API -> Nhận văn bản trả về -> Xóa bỏ ký tự thừa.
* **Output:** Chuỗi văn bản kịch bản 3-4 đoạn (Ví dụ: `"Bạn bận rộn nhưng vẫn muốn ăn ngon? Nồi chiên Philips chính là giải pháp..."`).

### 2. Hàm `tts()` (`engine/app/services/voice.py`)
* **Input:** Văn bản kịch bản từ bước 1 + Tên giọng đọc (Ví dụ: `"vi-VN-HoaiMyNeural"`).
* **Xử lý:** Kết nối WebSocket tới Microsoft Edge TTS Server -> Tải luồng audio về.
* **Output:** File âm thanh `audio.mp3` + Cấu trúc thời gian từng từ (`SubMaker`).

### 3. Hàm `search_videos_pexels()` (`engine/app/services/material.py`)
* **Input:** Từ khóa tiếng Anh (Ví dụ: `"cooking, kitchen"`) + Tỉ lệ khung hình (`9:16`).
* **Xử lý:** Gọi HTTP GET sang REST API của Pexels -> Lọc lấy danh sách link video HD dọc.
* **Output:** Mảng các đường link video `.mp4` bản quyền miễn phí.

### 4. Hàm `combine_videos()` (`engine/app/services/video.py`)
* **Input:** Danh sách các file video stock đã tải + File `audio.mp3`.
* **Xử lý:** Cắt ngẫu nhiên từng clip video stock thành đoạn 2-4 giây -> Crop thành khổ 1080x1920 -> Nối lại cho đến khi độ dài video đúng bằng độ dài file `audio.mp3`.
* **Output:** File video hình ảnh tạm `combined-1.mp4`.

### 5. Hàm `generate_video()` (`engine/app/services/video.py`)
* **Input:** Video hình `combined-1.mp4` + File tiếng `audio.mp3` + File phụ đề `subtitle.srt` + Nhạc nền BGM.
* **Xử lý:** Dùng MoviePy trộn âm thanh kịch bản và nhạc nền (nhạc nền giảm volume xuống 15%) -> Dùng Pillow vẽ chữ phụ đề tiếng Việt đè lên video -> Export.
* **Output:** File video hoàn chỉnh `final-1.mp4`.

---

## Phần S — Các Sơ Đồ Kiến Trúc & Luồng Dữ Liệu (Diagrams)

### 1. Kiến trúc phụ thuộc hệ thống (Architecture & Dependency Diagram)

```text
+-----------------------------------------------------------------------+
|                         FRONTEND (Next.js 15)                         |
|                    http://localhost:23000 (React UI)                  |
+-----------------------------------┬-----------------------------------+
                                    | REST API Calls (`/api/ideas`, `/api/jobs`)
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
    | (Store Ideas & Jobs)  |        +----------------─┬────────────────+
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
|  | Google Gemini AI  |  |   Edge TTS Cloud  |  |   Pexels Stock    |  |
|  |  (Script & Terms) |  |   (Voice Audio)   |  |   (Footage B-roll)|  |
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

### 2. Sơ đồ xử lý Video (Video Generation Pipeline Diagram)

```text
[Subject / Product Topic]
          │
          ▼
[Gemini 2.5 Flash API] ──► Generates Script Text (Văn bản)
          │
          ├───────────────────────────────┐
          ▼                               ▼
[Gemini Extract Terms]          [Edge TTS Service]
(Từ khóa Pexels B-roll)          (Tạo audio.mp3 & SubMaker)
          │                               │
          ▼                               ▼
[Pexels / Pixabay API]          [Subtitle Generator]
(Download clip .mp4)             (Xuất file subtitle.srt)
          │                               │
          └───────────────┬───────────────┘
                          ▼
            [MoviePy Video Concatenator]
            (Crop 9:16 & Concat -> combined.mp4)
                          │
                          ▼
            [Final MoviePy Synthesizer]
            (Combine Audio + Video + Subtitle + BGM)
                          │
                          ▼
                  [FFmpeg libx264]
                          │
                          ▼
                 Output: `final-1.mp4`
```

---

## Phần T — Trả Lời Trực Tiếp 10 Câu Hỏi Cốt Lõi

#### 1. Repository này thực sự làm được gì?
> **Trả lời:** Tự động tạo hoàn chỉnh 1 video ngắn 9:16 (hoặc 16:9) từ chủ đề/văn bản. Tự động viết kịch bản bằng AI, tạo giọng đọc phát âm chuẩn, tìm video minh họa bản quyền miễn phí, làm phụ đề chữ và đè nhạc nền để xuất file `.mp4`.

#### 2. Nó dùng architecture gì?
> **Trả lời:** Kiến trúc Full-stack Doanh nghiệp 3 Lớp (Three-tier Enterprise Architecture): **Next.js (Frontend UI)** -> **NestJS + PostgreSQL + Redis/BullMQ Queue (Backend Service & Storage Management)** -> **Python Engine (Core Video Generation Engine)**.

#### 3. Entry point nằm ở đâu?
> * **Backend API:** `backend/src/main.ts` (Port 23001).
> * **Frontend Dashboard:** `frontend/src/app/page.tsx` -> `/dashboard` (Port 23000).
> * **Python Engine CLI:** `engine/cli.py` (Được backend kích hoạt).
> * **Python Standalone Engine (FastAPI):** `engine/main.py` (Port 8080).

#### 4. Flow tạo video hiện tại như thế nào?
> **Trả lời:** User nhập chủ đề ở Frontend -> NestJS lưu Job vào PostgreSQL & đẩy vào BullMQ Queue -> Worker gọi `engine/cli.py` -> Python dùng Gemini viết kịch bản -> Gọi Edge-TTS tạo tiếng & phụ đề -> Tải clip B-roll từ Pexels -> Dùng MoviePy & FFmpeg ghép nối thành MP4 -> Worker upload file lên MinIO và hoàn tất.

#### 5. AI nào đang được sử dụng?
> **Trả lời:** Mặc định hỗ trợ **Google Gemini API** (`gemini-2.5-flash`), OpenAI GPT-4o-mini, DeepSeek, Qwen, cùng các cổng chuyển tiếp AIHubMix/AIML API.

#### 6. Những phần nào chạy local?
> **Trả lời:** NestJS Server, Next.js Server, PostgreSQL Database, Redis Queue, MinIO Storage, và lệnh FFmpeg Render Video final.

#### 7. Những phần nào gọi cloud API?
> **Trả lời:** Sinh văn bản AI (Google Gemini API), Sinh giọng đọc TTS (Edge-TTS Microsoft Cloud), và Tìm kiếm/Tải clip B-roll (Pexels / Pixabay Cloud API).

#### 8. Máy Linux yếu của tôi có thể chạy được không?
> **Trả lời:** **CHẠY TỐT 100%.** Vì toàn bộ các tác vụ nặng về trí tuệ nhân tạo và xử lý âm thanh đều đẩy lên Cloud API miễn phí, máy local của bạn chỉ tốn một chút RAM (dưới 2GB) và CPU để chạy FFmpeg mã hóa file video cuối cùng.

#### 9. Tôi cần implement thêm những gì để thành hệ thống affiliate?
> **Trả lời:** Cần làm thêm 4 thành phần: (1) Bảng lưu dữ liệu Sản phẩm & Link Affiliate trong DB, (2) Module cào/nhập thông số sản phẩm, (3) Điều chỉnh Prompt kịch bản Gemini thành cấu trúc bán hàng (Hook 3s -> Problem -> Solution -> CTA), và (4) Đưa hình ảnh sản phẩm thực tế vào luồng ghép video.

#### 10. Nếu bắt đầu custom ngay bây giờ, 3 file/module đầu tiên tôi nên đọc là gì và tại sao?
> **1. `engine/app/services/llm.py`:** Để đọc và thay đổi Prompt kịch bản (`DEFAULT_SCRIPT_SYSTEM_PROMPT`) thành kịch bản Affiliate bán hàng.  
> **2. `engine/app/services/task.py`:** Để nắm trọn vẹn luồng điều phối 6 bước tạo video và biết nơi chèn logic tải ảnh sản phẩm.  
> **3. `backend/prisma/schema.prisma`:** Để hiểu cấu trúc lưu trữ hiện tại và sẵn sàng mở rộng bảng `Product` lưu thông tin link affiliate.

---

## Danh Sách Vấn Đề Kỹ Thuật (Known Issues / Technical Debt)

*Qua quá trình kiểm tra chuyên sâu codebase thực tế, phân tích phát hiện một số điểm kỹ thuật cần lưu ý (Chỉ ghi nhận phân tích, chưa sửa code):*

1. **Sự khác biệt cấu hình giữa Docker Compose và chạy Local Manual:**
   - Trong `docker-compose.yml`, dịch vụ backend kết nối MinIO qua tên container `minio:9000`, nhưng môi trường local cần dùng `localhost:29000`. Khi cấu hình `.env` cho backend chạy ngoài Docker, cần đảm bảo cập nhật đúng port `29000`.
2. **Khởi tạo file `config.toml` tự động:**
   - Hàm `load_config()` trong `engine/app/config/config.py` sẽ tự động copy `config.example.toml` thành `config.toml` nếu chưa tồn tại. Tuy nhiên, nếu file `config.toml` chưa được điền `gemini_api_key` hoặc `pexels_api_keys`, Python CLI sẽ báo lỗi ngay khi bắt đầu nhiệm vụ.
3. **Giới hạn số lượng truy vấn Pexels Free Tier:**
   - API Key miễn phí của Pexels bị giới hạn 200 requests/giờ. Nếu sinh video hàng loạt với số lượng lớn trong hệ thống Affiliate, nên cấu hình mảng nhiều API Keys trong `pexels_api_keys = ["key1", "key2"]` để hệ thống tự xoay vòng key (codebase ở `material.py` đã hỗ trợ sẵn cơ chế xoay vòng key này qua biến `_api_key_counter`).

---

## Implemented Affiliate MVP

Đã triển khai thành công MVP Hệ thống Affiliate Short Video Generator trên codebase hiện tại theo đúng thiết kế 12 Phases:

### 1. Files Added & Modified
- **Database (`backend/prisma/schema.prisma`):**
  - Thêm model `Product` (`id`, `name`, `description`, `price`, `currency`, `affiliateUrl`, `features`, `benefits`, `targetAudience`, `images`, `createdAt`, `updatedAt`).
  - Thêm quan hệ optional `productId` vào model `Idea` và `GenerationJob`.
- **Backend Service (`backend/src/modules/products/`):**
  - `products.module.ts`: Khai báo module sản phẩm.
  - `products.service.ts`: Xử lý CRUD sản phẩm & hàm `generateVideo(id, config)` kết nối với Queue.
  - `products.controller.ts`: Cung cấp các API endpoint `POST /api/products`, `GET /api/products`, `GET /api/products/:id`, `PATCH /api/products/:id`, `DELETE /api/products/:id`, `POST /api/products/:id/generate-video`.
  - `backend/src/app.module.ts`: Đăng ký `ProductsModule`.
  - `backend/src/modules/queue/queue.service.ts`: Bổ sung `productId` vào `VideoJobConfig` và `VideoJobPayload`.
  - `backend/src/modules/queue/video.processor.ts`: Đọc dữ liệu `Product` từ DB và truyền `--product-data` dưới dạng JSON sang Python CLI.
- **Frontend Dashboard (`frontend/`):**
  - `frontend/src/components/Sidebar.tsx`: Thêm mục "Sản phẩm (Affiliate)" dẫn đến `/products`.
  - `frontend/src/app/products/page.tsx`: Màn hình Quản lý Sản phẩm Affiliate, hiển thị danh sách dạng Card, xem link affiliate, xóa sản phẩm, Modal thêm sản phẩm mới và nút "Tạo Video 9:16" trực tiếp.
- **Python Engine (`engine/`):**
  - `engine/app/models/schema.py`: Bổ sung trường `product_data` vào dataclass `VideoParams`.
  - `engine/cli.py`: Bổ sung tham số `--product-data` vào ArgumentParser và xử lý parse JSON trong `build_video_params()`.
  - `engine/app/services/llm.py`: Thêm `DEFAULT_AFFILIATE_SYSTEM_PROMPT` với cấu trúc kịch bản bán hàng chuẩn (HOOK 0-3s -> PROBLEM 3-8s -> SOLUTION 8-20s -> BENEFITS 20-35s -> REASON 35-45s -> CTA 45-55s). Cập nhật `build_script_prompt()` và `generate_script()` tự động sử dụng Affiliate Prompt khi có `product_data`.
  - `engine/app/services/material.py`: Thêm hàm `process_product_images()` tự động tải URL ảnh sản phẩm (hoặc file local), crop/pad thành khổ 9:16 và chuyển đổi thành các clip video ngắn (3s).
  - `engine/app/services/task.py`: Cập nhật `generate_script()` truyền `product_data` sang LLM và `get_video_materials()` trộn lẫn clip hình ảnh sản phẩm với video B-roll Pexels/Pixabay.

### 2. Backward Compatibility
- Tính năng tạo video bằng **Topic đơn thuần (Topic-only generation)** giữ nguyên 100%. Khi không truyền `productId` hoặc `product_data`, hệ thống tự động sử dụng luồng sinh video cũ không có bất kỳ ảnh hưởng nào.

