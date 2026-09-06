---
name: autonomous-dev
description: Autonomous Development Workflow engine for running repository roadmaps iteratively according to Google Antigravity standards. Triggered via /dev command or direct execution request.
license: MIT
---

# Autonomous Development Workflow Skill (`/dev`)

This skill orchestrates the end-to-end autonomous execution of task roadmaps in `.ai/tasks/`.

---

## 1. Execution Protocol Overview

When invoked via `/dev` or when executing a roadmap:

```
[LOAD STATE & MEMORY]
          ↓
  [SCAN .ai/tasks/]
          ↓
[RESOLVE DEPENDENCIES & PRIORITY]
          ↓
  [SELECT NEXT TASK] (Status: TODO, all depends_on are COMPLETED)
          ↓
   [EXECUTE TASK] → (Plan → Implement → Verify → Update State)
          ↓
[COMPLETED?] ─── YES ───► [SELECT NEXT TASK] ... ───► [ALL DONE]
     │
    NO (Verification failed after N retries or Blocked)
     ▼
[MARK BLOCKED & NOTIFY USER]
```

---

## 2. Step-by-Step Autonomous Execution Loop

### Phase 1: Context & Dependency Resolution
1. Load project memory files:
   - `.ai/project.md`
   - `.ai/architecture.md`
   - `.ai/conventions.md`
   - `.ai/current-state.md`
   - `.ai/decisions.md`
2. Scan all task files in `.ai/tasks/*.md`.
3. Build the dependency graph using the YAML frontmatter `depends_on` field.
4. Filter candidate tasks:
   - Status MUST be `TODO`.
   - All tasks listed in `depends_on` MUST have status `COMPLETED`.
5. Select the highest priority candidate task (Order: `high` > `medium` > `low`).
6. If no executable tasks exist:
   - If all tasks are `COMPLETED`: Report all roadmap tasks completed.
   - If remaining tasks are blocked by pending dependencies or status `BLOCKED`: Report pipeline blocked with details.

### Phase 2: Task Execution Engine (18 Rules)
For the selected task:
1. **Read Task Spec**: Fully read the task file.
2. **Load State**: Read `.ai/current-state.md`.
3. **Load Architecture**: Read `.ai/architecture.md`.
4. **Load Conventions**: Read `.ai/conventions.md`.
5. **Load Decisions**: Read `.ai/decisions.md`.
6. **Check Dependencies**: Confirm all `depends_on` tasks are `COMPLETED`.
7. **Inspect Codebase**: Inspect code files specified or affected by the task.
8. **Select Skills**: Identify relevant skills in `.agents/skills/`.
9. **Mark IN_PROGRESS**: Update the task file frontmatter status to `IN_PROGRESS`.
10. **Plan**: Formulate implementation plan using `task-planning` skill.
11. **Check Approval Gate**: If task requires human approval (destructive, ambiguous, major architecture), pause and ask user. Otherwise, proceed automatically.
12. **Implement**: Perform code changes adhering strictly to requirements & conventions.
13. **Verify**: Execute verification gate via `task-verification` skill.
14. **Failure Recovery**: If verification fails:
    - Analyze exact error logs.
    - S me (max 3 retry loops).
    - If fixed, re-run verification.
    - If still failing after 3 attempts, update task status to `BLOCKED`, record evidence, and stop pipeline.
15. **Mark COMPLETED**: Only when ALL 8 verification gate criteria pass, set status to `COMPLETED`.
16. **Sync State**: Update `.ai/current-state.md` (Active Phase, Completed Tasks, Active Task, Next Task).
17. **Record Decisions**: If new architectural decisions were made, append to `.ai/decisions.md`.
18. **Iterate**: Immediately proceed to select and execute the next eligible task without stopping.

---

## 3. Human Approval Gate Criteria

Pause and request explicit user confirmation ONLY if:
- Requirements are ambiguous or incomplete.
- Operation is destructive (e.g., deleting database tables, wiping source code).
- Major architectural changes or breaking API contracts are introduced.
- Dangerous database migrations are required.
- Security-sensitive code (secrets, authentication, permissions) is modified.
- Dependency conflicts or circular dependencies exist in `.ai/tasks/`.
- Task status becomes `BLOCKED`.

For all standard feature development, bug fixes, refactoring, and test writing:
→ **PROCEED AUTONOMOUSLY WITHOUT INTERRUPTION**.
