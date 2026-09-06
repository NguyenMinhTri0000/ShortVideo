# Project Technical Debt & Quality Baselines

This document establishes the official quality and linting baseline metrics for the repository, serving as the Source of Truth for regression detection in the Autonomous Development Workflow.

---

## 1. ESLint Codebase Baseline (Established 2026-09-06)

All errors listed below are pre-existing technical debt accumulated prior to the integration of the Google Antigravity Autonomous Development Workflow (`TASK-001`).

| Component | Files Checked | Pre-Existing Errors | Pre-Existing Warnings | Total Problems | Status / Classification |
|---|---|---:|---:|---:|---|
| **Backend (`/backend`)** | `src/**/*.ts`, `test/**/*.ts` | 806 | 23 | 829 | Pre-existing Technical Debt |
| **Frontend (`/frontend`)** | `src/app/**`, `src/components/**` | 27 | 13 | 40 | Pre-existing Technical Debt |
| **TOTAL** | Monorepo | **833** | **36** | **869** | **Official Repository Baseline** |

---

## 2. Baseline Verification Rule & Regression Logic

To prevent pre-existing technical debt from blocking unrelated feature tasks while maintaining zero-regression guarantees:

- **Current Errors == 833**: PASS (Zero regression).
- **Current Errors < 833**: PASS (Code quality improvement).
- **Current Errors > 833**: FAIL (New lint error / regression introduced).
- **Targeted Diff Check**: Files modified by an active task MUST NOT introduce ANY new ESLint errors.

---

## 3. Debt Reduction Roadmap

Future task `TASK-002: Clean up existing ESLint technical debt` is tracked independently to systematically refactor types and eliminate this baseline.
