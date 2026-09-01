# Architecture Documentation

## Core Services

### 1. Backend (`/backend`)
- Framework: NestJS (TypeScript)
- Database: PostgreSQL via Prisma ORM (`backend/prisma/schema.prisma`)
- Queue: BullMQ with Redis (`backend/src/modules/queue`)
- Main Modules:
  - `llm`: AI Provider integration & key management (`backend/src/modules/llm/llm.service.ts`)
  - `products`: Product research & Shopee adapter (`backend/src/modules/products`)
  - `script-engine`: Script parsing & scene breakdown (`backend/src/modules/script-engine`)
  - `videos`: Video generation task dispatching (`backend/src/modules/videos`)
  - `jobs`: Background worker jobs (`backend/src/modules/jobs`)
  - `settings`: System configuration management (`backend/src/modules/settings`)

### 2. Engine (`/engine`)
- Language: Python 3.12 (`moneyprinterturbo`)
- Framework: FastAPI, Pydantic, LiteLLM, MoviePy, Edge-TTS
- CLI: `engine/cli.py` for direct command line rendering
- Test runner: `pytest`

### 3. Frontend (`/frontend`)
- Framework: Next.js (React), App Router
- Components & Pages: Dashboard, Product Research, Video Creator, Settings

### 4. Agent Compiler (`/agent_compiler`)
- Requirement-to-Agent Prompt Compiler CLI system
- Entry point: `./agent` binary or `python3 -m agent_compiler.cli`
