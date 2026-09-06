---
name: task-verification
description: Autonomous Verification Gate skill. Ensures code quality, test passing, regression checks, acceptance criteria validation, and state synchronization before completing tasks.
license: MIT
---

# Task Verification Gate Skill

This skill enforces the **Verification Gate**—the most critical quality checkpoint in the Autonomous Development Workflow.

---

## Strict Rule

> [!CRITICAL]
> AN AGENT MUST NEVER MARK A TASK AS `COMPLETED` MERELY BECAUSE CODE WAS WRITTEN.
> A TASK CAN ONLY BE SET TO `COMPLETED` WHEN ALL 8 VERIFICATION GATE CONDITIONS ARE EMPIRICALLY SATISFIED.

---

## The 8 Verification Gate Criteria

1. **Code Existence & Integrity**:
   - All proposed files and code changes physically exist and are correctly structured.

2. **Requirements Fulfillment**:
   - Every requirement defined in the `# Requirements` section of the task file is fully implemented.

3. **Acceptance Criteria Validation**:
   - Every single check item `- [ ]` in `# Acceptance Criteria` is manually or automatically verified and ticked `- [x]`.

4. **Automated Unit & Integration Tests Pass**:
   - Relevant test commands pass with exit code `0` (e.g. `npm test`, `jest`, `pytest`).

5. **Build, Typecheck, and Lint Cleanliness**:
   - No compiler, typechecking, or linter errors introduced (e.g. `tsc --noEmit`, `eslint`, `flake8`, `mypy`).

6. **Zero Regression Guarantee**:
   - Existing unrelated features and services compile and run without side effects.

7. **Git Diff Audit**:
   - Git diff reviewed for unintended debug code, console statements, secrets, or temporary scratch files.

8. **System State Synchronization**:
   - `.ai/current-state.md` is updated with current progress.
   - `.ai/decisions.md` is updated if new architectural choices were made.
   - `.ai/conventions.md` is updated if new conventions were adopted.

---

## Failure Recovery Routine

If any of the 8 criteria fail:

1. Keep task status as `IN_PROGRESS` (or set to `BLOCKED` if unfixable).
2. Fetch full, un-truncated terminal error logs and stack traces.
3. Diagnose root cause (never patch symptoms silently).
4. Perform targeted fix.
5. Re-run Verification Gate.
6. Retry loop up to **3 iterations**. If still failing after 3 attempts, set task status to `BLOCKED`, document failure evidence in task `# Notes`, notify user, and pause pipeline.
