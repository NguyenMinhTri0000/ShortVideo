---
name: autonomous-dev
description: Unified Autonomous Development Workflow engine. Serves as the official entrypoint for executing product requirements (/dev <requirement>) or running task roadmaps autonomously according to Google Antigravity standards.
license: MIT
---

# Autonomous Development Workflow Engine (`/dev`)

This skill defines the unified entrypoint and execution protocol for the Autonomous Development Workflow.

---

## 1. Unified Entrypoint Protocol (`/dev`)

Whenever a prompt starts with `/dev` (e.g., `/dev <user_requirement>` or `/dev` alone):

```
                       ┌───────────────────────────────┐
                       │  USER PROMPT: /dev <request>  │
                       └───────────────┬───────────────┘
                                       │
                         [REQUIREMENT PROVIDED?]
                                       │
                      ┌────────────────┴────────────────┐
                     YES                                NO
                      │                                 │
         [READ PROJECT CONTEXT]            [SCAN EXISTING ROADMAP]
                      │                                 │
       [DE-DUPLICATION & TASK BREAKDOWN]                │
                      │                                 │
         [WRITE .ai/tasks/TASK-XXX.md]                  │
                      │                                 │
                      └────────────────┬────────────────┘
                                       │
                                       ▼
                       [AUTONOMOUS ROADMAP EXECUTION LOOP]
                                       │
           ┌───────────────────────────┴───────────────────────────┐
           ▼                                                       ▼
  [SELECT NEXT TODO TASK]                               [VERIFY & COMPLETE]
           │                                                       │
  [PLAN → IMPLEMENT → VERIFY] ─────────────────────────────────────┘
           │
           ▼
[ALL DONE OR BLOCKED / APPROVAL NEEDED] ──► [NOTIFY USER & UPDATE STATE]
```

---

## 2. Execution Phases

### Phase 0: Requirement Parsing & Auto-Decomposition (When Requirement Provided)
1. **Detect Requirement Input**: If prompt follows `/dev <requirement description>`:
2. **Read System Memory & Context**:
   - `.ai/project.md`
   - `.ai/architecture.md`
   - `.ai/conventions.md`
   - `.ai/current-state.md`
   - `.ai/decisions.md`
   - `.ai/baseline.md`
3. **De-duplication Check**:
   - Scan all existing `.ai/tasks/*.md` files.
   - Check if an identical or overlapping task is already present or `IN_PROGRESS`/`COMPLETED`.
   - If an existing task covers the requirement, select it directly instead of creating a duplicate.
4. **Decompose Requirement**:
   - If new, formulate 1 or more structured task files (`.ai/tasks/TASK-XXX-<name>.md`).
   - Populate using the standard Task Template (`id`, `title`, `status: TODO`, `priority`, `depends_on`, `# Objective`, `# Context`, `# Requirements`, `# Acceptance Criteria`, `# Verification`, `# Files Likely Affected`).
5. **Register & Sync State**:
   - Save task files into `.ai/tasks/`.
   - Update `.ai/current-state.md` to reflect new roadmap items.

---

### Phase 1: Context & Dependency Resolution Engine
1. Read `.ai/current-state.md` and scan all `.ai/tasks/*.md`.
2. Build dependency graph using YAML frontmatter `depends_on` lists.
3. Filter candidate executable tasks:
   - Status MUST be `TODO`.
   - All tasks in `depends_on` MUST be `COMPLETED`.
4. Select highest priority executable task (Priority: `high` > `medium` > `low`).
5. If no executable tasks exist:
   - If all requirement tasks are `COMPLETED`: Report all tasks successfully completed to user.
   - If tasks are blocked by pending dependencies or `BLOCKED` status: Report pipeline blocked with exact failure logs.

---

### Phase 2: Task Execution & Verification Loop (18 Rules)
For the selected task:
1. **Read Task Spec**: Read `.ai/tasks/TASK-XXX.md`.
2. **Mark IN_PROGRESS**: Update task status to `IN_PROGRESS` and sync `.ai/current-state.md`.
3. **Plan**: Formulate implementation plan using `task-planning` skill.
4. **Check Approval Gate**: Pause and ask user ONLY if a Human Approval Gate condition is triggered (destructive operation, ambiguous prompt, security changes, circular dependencies). Otherwise, **proceed automatically**.
5. **Implement**: Perform code/doc changes adhering to conventions and architectural boundaries.
6. **Verify**: Run `task-verification` skill (Baseline-aware linting, unit tests, production builds).
7. **Failure Recovery**:
   - If verification fails: Fetch un-truncated terminal logs, diagnose root cause, attempt fix (max 3 retry loops).
   - If fixed: Re-run verification.
   - If still failing after 3 retries: Set task status to `BLOCKED`, document failure evidence, notify user, and pause.
8. **Mark COMPLETED**: Set task status to `COMPLETED` when all verification criteria pass.
9. **Sync State & Iterate**: Update `.ai/current-state.md` and **immediately proceed to select and execute the next eligible task without stopping**.

---

## 3. Human Approval Gate Criteria

Pause and request explicit user confirmation ONLY if:
- Requirement is ambiguous or incomplete.
- Operation is destructive (e.g., deleting database tables, wiping source code).
- Major architectural changes or breaking API contracts are introduced.
- Dangerous database migrations are required.
- Security-sensitive code (secrets, authentication, permissions) is modified.
- Dependency conflicts or circular dependencies exist in `.ai/tasks/`.
- Task status becomes `BLOCKED`.

For all standard feature development, bug fixes, refactoring, and test writing:
→ **PROCEED AUTONOMOUSLY WITHOUT INTERRUPTION**.
