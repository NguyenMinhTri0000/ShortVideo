---
name: task-planning
description: Autonomous task planning and architectural impact analysis skill. Used during the Planning phase of the task execution lifecycle.
license: MIT
---

# Task Planning Skill

This skill guides the Planner / Architect Agent in preparing concrete implementation plans for roadmap tasks.

---

## Workflow

1. **Requirement Analysis**:
   - Parse `# Objective`, `# Context`, `# Requirements`, and `# Acceptance Criteria` from the task document.
   - Cross-check against system documentation (`.ai/project.md`, `.ai/architecture.md`).

2. **Codebase Inspection**:
   - Locate existing modules and files that match the task scope.
   - Audit code conventions (`.ai/conventions.md`) relevant to the components involved (NestJS backend, FastAPI engine, Next.js frontend, Python CLI).

3. **Dependency & Conflict Assessment**:
   - Check if changes will break existing public interfaces, APIs, or database schemas.
   - Verify that all tasks listed in `depends_on` are fully implemented and verified (`COMPLETED`).

4. **Formulate Step-by-step Implementation Strategy**:
   - Outline precise file edits (`[MODIFY]`, `[NEW]`, `[DELETE]`).
   - Identify relevant existing skills (e.g. `frontend-design`, `web-design-guidelines`).
   - Define exact test suites or verification commands required for the task.

5. **Approval Gate Evaluation**:
   - Determine if the plan requires user approval under **Human Approval Gate** guidelines.
