# Antigravity Autonomous Development Workflow Specification

This document provides complete instructions and architecture documentation for the Autonomous Development Workflow established in this repository, adhering to the official Google Antigravity paradigm.

---

## 1. System Architecture & Unified Entrypoint (`/dev`)

The pipeline operates on a multi-role collaborative loop defined in [`.agents/agents.md`](file:///home/tringuyen/Code/short-video/.agents/agents.md) and triggered via the `/dev` entrypoint:

```
                       ┌───────────────────────────────┐
                       │  USER PROMPT: /dev <request>  │
                       └───────────────┬───────────────┘
                                       │
                                       ▼
                       ┌───────────────────────────────┐
                       │      LEAD ORCHESTRATOR        │
                       └───────────────┬───────────────┘
                                       │
       ┌───────────────────────────────┼───────────────────────────────┐
       ▼                               ▼                               ▼
┌──────────────┐               ┌──────────────┐               ┌──────────────┐
│   PLANNER    │               │ IMPLEMENTER  │               │ QA/VERIFIER  │
└──────┬───────┘               └──────┬───────┘               └──────┬───────┘
       │                               │                               │
       └───────────────────────────────┼───────────────────────────────┘
                                       │
                                       ▼
                       ┌───────────────────────────────┐
                       │        REVIEWER AGENT         │
                       └───────────────┬───────────────┘
                                       │
                                       ▼
                       ┌───────────────────────────────┐
                       │  UPDATE STATE & EXECUTE NEXT  │
                       └───────────────────────────────┘
```

---

## 2. Zero-Friction Entrypoint Usage (`/dev <requirement>`)

Users do NOT need to paste manual autonomous instructions. Simply prompt:

```text
/dev <Requirement description>
```

### Examples:
- `/dev Thêm chức năng cho phép user chỉnh sửa AI script trước khi render video.`
- `/dev Tối ưu hóa thời gian render video bằng cách cache audio assets.`
- `/dev` (Runs/resumes existing task roadmap in `.ai/tasks/`)

### Automatic Workflow Steps:
1. **Context Loading**: Agent reads project memory (`.ai/project.md`, `.ai/architecture.md`, `.ai/conventions.md`, `.ai/current-state.md`, `.ai/baseline.md`).
2. **De-duplication**: Scans `.ai/tasks/*.md` to avoid duplicate task generation.
3. **Decomposition**: Breaks requirement into structured task files (`.ai/tasks/TASK-XXX.md`) with YAML dependencies.
4. **Autonomous Execution**: Executes task loop (Plan → Implement → Baseline-Aware Verify → Update State).
5. **Continuous Iteration**: Automatically proceeds to next unblocked task until all requirement tasks are `COMPLETED`.

---

## 3. Task Specification & Format Standards

All tasks live in `.ai/tasks/` as Markdown files with YAML frontmatter.

### Standard Task Template:

```markdown
---
id: TASK-XXX
title: Short descriptive title
status: TODO
priority: medium
depends_on: []
---

# Objective
High-level statement of what this task accomplishes.

# Context
Background information, related components, and architectural considerations.

# Requirements
Detailed bullet points of functional and technical requirements.

# Implementation Notes
Technical guidance, recommended libraries, or code paths to modify.

# Acceptance Criteria
- [ ] Criterion 1
- [ ] Criterion 2

# Verification
Commands used to verify completion (e.g. `npm test`, `pytest`, `tsc`).

# Files Likely Affected
- `backend/src/...`
- `engine/...`

# Notes
Execution logs, findings, or retry details.
```

---

## 4. Verification Gate & Baseline-Aware Rule

A task MUST NEVER be marked `COMPLETED` based on written code alone. It requires passing strict checks:

1. **Code Existence**: Files created/modified as planned.
2. **Requirements Satisfied**: All functional items built.
3. **Acceptance Criteria Checked**: Every `- [ ]` ticked to `- [x]`.
4. **Automated Tests Pass**: Unit/integration tests return exit code `0`.
5. **Build & Typecheck Pass**: Clean compilation (`nest build`, `next build`, `tsc --noEmit`).
6. **Baseline-Aware Lint Rule**: Linter errors `<= 833` (Official Repository Baseline in `.ai/baseline.md`). No new linter errors introduced in active task diff.
7. **Zero Regression Guarantee**: System functionality remains stable.
8. **Git Diff Audit**: No temporary code, secrets, or clutter.
9. **State Synchronization**: `.ai/current-state.md` updated.

---

## 5. Human Approval Gate

The pipeline runs fully autonomously for standard feature code, test, and documentation tasks.

**Pause & Request User Approval ONLY when**:
- Requirement is ambiguous or incomplete.
- Destructive operation requested (data/file deletion).
- Major architectural changes or breaking API contracts introduced.
- Dangerous database migration needed.
- Security-sensitive code modified.
- Dependency conflict or circular dependency detected.
- Task status becomes `BLOCKED`.

---

## 6. Quickstart Guide for Developers

### How to Trigger an Autonomous Feature Development:
To request a new feature, bug fix, or refactoring task, type:

```text
/dev <Requirement description>
```

### Quick Reference Commands:
- `/dev Thêm chức năng cho phép user chỉnh sửa AI script trước khi render video.`
- `/dev Tối ưu hóa performance database query cho API publishing.`
- `/dev` (Runs or resumes unblocked tasks in `.ai/tasks/`)

### Automated Loop Execution:
1. Agent parses requirement and checks for existing duplicate tasks.
2. Agent breaks requirement into structured task specs in `.ai/tasks/`.
3. Agent resolves dependency tree and selects executable `TODO` tasks.
4. Agent plans, implements, runs automated test suites, and audits diffs.
5. Agent updates `.ai/current-state.md` and seamlessly continues to the next unblocked task.

