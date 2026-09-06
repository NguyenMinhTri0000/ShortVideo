# Antigravity Workspace Instruction & Rules (`AGENTS.md`)

This workspace uses the **Google Antigravity Autonomous Development Pipeline**.

---

## 🚨 MANDATORY RULE: Autonomous Development Entrypoint (`/dev`)

Whenever any user prompt starts with `/dev` (e.g., `/dev <user_requirement>` or `/dev` alone):

1. **IMMEDIATE SKILL ACTIVATION**:
   - You MUST immediately call `view_file` on [`.agents/skills/autonomous-dev/SKILL.md`](file:///home/tringuyen/Code/short-video/.agents/skills/autonomous-dev/SKILL.md).
   - You MUST adopt the **Orchestrator / Lead Agent Role** defined in [`.agents/agents.md`](file:///home/tringuyen/Code/short-video/.agents/agents.md).

2. **NO ONE-OFF PROMPT FALLBACK**:
   - You MUST NOT handle `/dev` prompts as ad-hoc coding requests.
   - You MUST enforce the 7-step Autonomous Development Lifecycle:
     $$\text{Requirement} \longrightarrow \text{Analyze Context} \longrightarrow \text{Plan} \longrightarrow \text{Task Breakdown} \longrightarrow \text{Execute} \longrightarrow \text{Verify} \longrightarrow \text{Complete} \longrightarrow \text{Next Task}$$

3. **TASK MANAGEMENT & STATE SYNC**:
   - Parse requirements and check for duplicate tasks in `.ai/tasks/`.
   - Create structured task specification files (`.ai/tasks/TASK-XXX-<name>.md`) for new requirements.
   - Update `.ai/current-state.md` upon every state change.
   - Auto-execute available `TODO` tasks in priority order.

4. **VERIFICATION & APPROVAL GATES**:
   - Enforce the **Verification Gate** (`task-verification` skill: build, tests, baseline-aware linting) before marking any task `COMPLETED`.
   - Pause and request human approval ONLY if a **Human Approval Gate** condition is triggered (destructive action, ambiguous prompt, security code change, circular dependency, or `BLOCKED` status).

---

## Agent Roles Overview

- **Orchestrator**: Resolves task tree, triggers state transitions, auto-selects next executable task.
- **Planner**: Inspects system memory (`.ai/`) and formulates step-by-step plans using `task-planning` skill.
- **Implementer**: Executes code changes adhering to `.ai/conventions.md` and `.ai/architecture.md`.
- **QA / Verifier**: Runs test suites, typechecks, and baseline-aware linters using `task-verification` skill.
- **Reviewer**: Audits git diffs for clean commit readiness before approving `COMPLETED` state.
