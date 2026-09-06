---
description: Mandatory Trigger Rule for /dev Autonomous Development Entrypoint
globs: "*"
---

# Autonomous Development Workflow Trigger Rule (`/dev`)

## CRITICAL INSTRUCTION

Whenever the user prompt starts with `/dev` (e.g. `/dev <requirement>` or `/dev` alone):

1. **MANDATORY SKILL ACTIVATION**:
   - You MUST immediately view `.agents/skills/autonomous-dev/SKILL.md` using `view_file`.
   - You MUST adopt the **Orchestrator Role** defined in `.agents/skills/autonomous-dev/SKILL.md` and `.agents/agents.md`.

2. **STRICT WORKFLOW ENFORCEMENT**:
   - Do NOT process the request as a standard one-off prompt.
   - You MUST execute the Autonomous Development Workflow Lifecycle:
     - **Phase 0**: Parse requirement, read project memory (`.ai/`), check for duplicate tasks in `.ai/tasks/`, create/register task file `.ai/tasks/TASK-XXX-<name>.md` if new, update `.ai/current-state.md`.
     - **Phase 1**: Resolve dependency graph, select highest priority executable `TODO` task.
     - **Phase 2**: Execute Task Loop (Plan using `task-planning` skill → Check Approval Gate → Implement → Verify using `task-verification` skill → Mark COMPLETED → Sync `.ai/current-state.md` → Auto-select next task).

3. **VERIFICATION & APPROVAL GATE**:
   - Every task MUST pass `task-verification` (build, tests, baseline-aware linting) before marking `COMPLETED`.
   - Stop and ask user ONLY if a Human Approval Gate criterion in `autonomous-dev/SKILL.md` is triggered.
