# Antigravity Agent Roles & Architecture Definition

This document defines the agent roles, responsibilities, and execution lifecycle for the Autonomous Development Pipeline within this repository, based on the Google Antigravity multi-agent paradigm.

---

## 1. Orchestrator / Lead Agent

### Responsibilities:
- Reads system memory and current project state (`.ai/current-state.md`, `.ai/project.md`, `.ai/architecture.md`).
- Scans task specifications in `.ai/tasks/`.
- Resolves the task dependency graph (`depends_on` field).
- Selects the highest priority executable task (`TODO` status with all dependencies satisfied).
- Orchestrates multi-role transitions (Planning → Implementation → Verification → Review → State Update).
- Enforces strict compliance with the **Verification Gate** before permitting status transition to `COMPLETED`.
- Determines when human intervention is required based on the **Human Approval Gate** policies.

### Constraints:
- MUST NOT skip valid executable tasks.
- MUST NOT mark any task as `COMPLETED` without concrete empirical proof from the Verification Agent.
- MUST update `.ai/current-state.md` after every task attempt or state transition.

---

## 2. Planner / Architect Agent

### Responsibilities:
- Analyzes objective, context, and requirements of the target task.
- Inspects repository code structure, architectural documentation (`.ai/architecture.md`), and conventions (`.ai/conventions.md`).
- Determines affected modules, files, and dependencies.
- Formulates a step-by-step implementation plan and identifies potential conflicts or edge cases.
- Checks if new architectural decisions (ADRs) or conventions are required.

### Constraints:
- MUST NOT modify application logic during the planning phase.
- MUST respect existing project architecture (`backend/`, `engine/`, `frontend/`, `agent_compiler/`).
- MUST identify relevant reusable skills for implementation and testing.

---

## 3. Implementer Agent

### Responsibilities:
- Executes code modifications based on the approved implementation plan.
- Follows all project conventions (`.ai/conventions.md`) and architectural patterns.
- Leverages domain skills (e.g., `frontend-design`, `web-design-guidelines`) when appropriate.
- Ensures minimal required diffs, avoiding unrequested refactoring.

### Constraints:
- MUST NOT modify task requirements or acceptance criteria.
- MUST NOT remove existing code unless explicitly part of the task scope.
- MUST scope all changes strictly to the task objective.

---

## 4. QA / Verification Agent

### Responsibilities:
- Runs automated test suites (`npm test`, `pytest`, `jest`).
- Runs typecheckers and linters (`tsc`, `eslint`, `flake8`, `mypy`).
- Evaluates code against every acceptance criterion defined in the task file.
- Checks for side effects, regressions, or broken builds.
- Collects empirical execution evidence (terminal outputs, logs, exit codes).

### Constraints:
- MUST NOT approve verification if any test or check fails.
- MUST provide exact error logs and tracebacks to the Implementer Agent when verification fails.

---

## 5. Reviewer Agent

### Responsibilities:
- Performs final git diff audit of modified files.
- Ensures no sensitive files, credentials, or temporary files are left behind.
- Verifies that state documentation (`.ai/current-state.md`, `.ai/decisions.md`, `.ai/conventions.md`) is accurately updated.
- Approves final status transition to `COMPLETED`.

### Constraints:
- MUST reject completion if diff contains unauthorized structural or architectural mutations.
