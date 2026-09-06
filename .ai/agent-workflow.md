# Antigravity Autonomous Development Workflow Specification

This document provides complete instructions and architecture documentation for the Autonomous Development Workflow established in this repository, adhering to the official Google Antigravity paradigm.

---

## 1. System Architecture & Agent Roles

The pipeline operates on a multi-role collaborative loop defined in [`.agents/agents.md`](file:///home/tringuyen/Code/short-video/.agents/agents.md):

```
                       ┌──────────────────────┐
                       │     USER ROADMAP     │
                       └──────────┬───────────┘
                                  │
                                  ▼
                       ┌──────────────────────┐
                       │  LEAD ORCHESTRATOR   │
                       └──────────┬───────────┘
                                  │
      ┌───────────────────────────┼───────────────────────────┐
      ▼                           ▼                           ▼
┌───────────┐               ┌───────────┐               ┌───────────┐
│  PLANNER  │               │IMPLEMENTER│               │QA/VERIFIER│
└─────┬─────┘               └─────┬─────┘               └─────┬─────┘
      │                           │                           │
      └───────────────────────────┼───────────────────────────┘
                                  │
                                  ▼
                       ┌──────────────────────┐
                       │   REVIEWER AGENT     │
                       └──────────┬───────────┘
                                  │
                                  ▼
                       ┌──────────────────────┐
                       │ UPDATE STATE & REPEAT│
                       └──────────────────────┘
```

### Roles Breakdown:
1. **Lead / Orchestrator**: Manages state, dependency graph, task prioritization, loop control.
2. **Planner / Architect**: Analyzes task specs, checks project architecture, defines implementation steps.
3. **Implementer**: Modifies repository code according to project conventions.
4. **QA / Verifier**: Runs automated tests, builds, linters, checks acceptance criteria.
5. **Reviewer**: Audits git diffs, ensures no unintended side effects, authorizes `COMPLETED` state.

---

## 2. Task Specification & Format Standards

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

### Valid Task Statuses:
- `TODO`: Pending execution.
- `IN_PROGRESS`: Currently being planned, implemented, or verified.
- `BLOCKED`: Failed execution after max retries, broken dependency, or waiting for human approval.
- `COMPLETED`: Fully verified and merged into system state.

---

## 3. Dependency Engine

Tasks can declare dependencies via the `depends_on` array in their frontmatter:

```yaml
---
id: TASK-003
title: Build Video Publishing Service
status: TODO
priority: high
depends_on:
  - TASK-001
  - TASK-002
---
```

### Resolution Rules:
- The Orchestrator MUST NOT select `TASK-003` if `TASK-001` or `TASK-002` status is not `COMPLETED`.
- If a dependency is missing or `BLOCKED`, the Orchestrator finds the next highest priority `TODO` task whose dependencies are satisfied.
- If no executable task is available and uncompleted tasks remain, the Orchestrator marks the pipeline as `BLOCKED` and alerts the user with details.

---

## 4. Verification Gate (The 8-Point Gate)

A task MUST NEVER be marked `COMPLETED` based on written code alone. It requires passing 8 strict checks:

1. **Code Existence**: Files created/modified as planned.
2. **Requirements Satisfied**: All functional items built.
3. **Acceptance Criteria Checked**: Every `- [ ]` ticked to `- [x]`.
4. **Automated Tests Pass**: Unit/integration tests return exit code `0`.
5. **Build / Typecheck Pass**: Clean compilation (`tsc`, `lint`, `build`).
6. **No Regressions**: System functionality remains stable.
7. **Git Diff Audit**: No temporary code, secrets, or clutter.
8. **State Synchronization**: `.ai/current-state.md` updated.

---

## 5. Human Approval Gate

The pipeline runs fully autonomously for standard code, test, and documentation tasks.

**Pause & Request User Approval ONLY when**:
- Requirement is ambiguous or incomplete.
- Destructive operation requested (data/file deletion).
- Major architectural changes or breaking API contracts introduced.
- Dangerous database migration needed.
- Security-sensitive code modified.
- Dependency conflict or circular dependency detected.
- Task status becomes `BLOCKED`.

---

## 6. Failure Recovery Protocol

When verification fails during task execution:

```
[IMPLEMENT] ──► [TEST] ──► [FAIL] ──► [FETCH LOGS & DIAGNOSE]
                                            │
                                            ▼
[RETEST] ◄── [VERIFY] ◄── [APPLY FIX] ◄─────┘
   │
   ├── PASS ──► [MARK COMPLETED & NEXT TASK]
   └── FAIL ──► (Retry up to 3 times) ──► [MARK BLOCKED & NOTIFY USER]
```

---

## 7. How to Run the Autonomous Workflow (`/dev`)

### Command Usage:
To start or resume autonomous roadmap execution, run the slash command or prompt:

```text
/dev
```

### What Happens:
1. Orchestrator scans `.ai/tasks/*.md`.
2. Resolves task priority and dependency graph.
3. Selects the first executable `TODO` task.
4. Switches status to `IN_PROGRESS`.
5. Plans, implements, runs tests, and audits diffs.
6. Passes Verification Gate and sets status to `COMPLETED`.
7. Updates `.ai/current-state.md`.
8. Automatically loops to the next valid task until all tasks are `COMPLETED`.

---

## 8. Creating New Tasks

To add a new feature or roadmap item:
1. Create a file in `.ai/tasks/TASK-XXX-<name>.md`.
2. Populate using the standard Task Template.
3. Set `status: TODO`.
4. Specify `priority` and `depends_on` list.
5. Trigger `/dev`.
