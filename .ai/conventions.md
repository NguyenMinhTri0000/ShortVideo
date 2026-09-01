# Coding Conventions & Best Practices

## TypeScript / Backend (NestJS)
- Strict mode enabled (`tsconfig.json`).
- Controller contains HTTP routing, payload validation, and status handling logic.
- Business logic lives strictly in Services (`@Injectable()`).
- Database access uses PrismaService (`backend/src/modules/database/prisma.service.ts`).
- Async handling uses async/await with clean error logging via `Logger`.
- Prettier and ESLint rules strictly applied.
- Unit tests co-located (`*.spec.ts`) using Jest.

## Python / Engine & Tools
- Type hints on function signatures (`def fn(param: str) -> dict:`).
- Logging via `loguru` or standard `logging`.
- Clean error raising with informative exception messages.
- Virtualenv/package management using standard Python 3.12 library / `uv`.
- Unit testing via `pytest`.

## Architectural Reuse Rule
- Always reuse existing models, abstractions, and services before introducing new dependencies or abstractions.
- Never destroy or overwrite uncommitted user changes without verification.
