from pathlib import Path
from typing import Dict, Any, List, Optional


class PromptCompiler:
    """
    Compiles requirement, context, architecture, conventions, and file dependencies
    into a structured, hallucination-free Coding Task Specification.
    """

    def __init__(self, root_dir: str):
        self.root_dir = Path(root_dir).resolve()

    def compile(self, context: Dict[str, Any]) -> str:
        """Compile context dict into formatted Coding Task Specification."""
        req = context.get("requirement", {})
        memory = context.get("memory", "")
        files = context.get("files", [])

        # Extract file paths present in context
        existing_paths = {f["path"] for f in files}

        # Build list of relevant files with status verification
        file_sections = []
        files_to_modify = []
        files_to_create = []

        if files:
            for f in files:
                rel_path = f["path"]
                files_to_modify.append(f"- [{rel_path}](file://{self.root_dir / rel_path})")
                file_sections.append(
                    f"### [EXISTING FILE] {rel_path}\n"
                    f"Relevance Score: {f['score']}\n"
                    f"```\n{f['content']}\n```"
                )
        else:
            files_to_create.append("- NEW COMPONENT REQUIRED (No direct file matches in existing codebase)")

        # Verify hallucination guard for requested changes
        not_found_notes = []
        for change in req.get("requested_changes", []):
            # Check if change refers to files not in repo
            words = change.split()
            for w in words:
                if (w.endswith(".ts") or w.endswith(".py") or w.endswith(".prisma")) and w not in existing_paths:
                    not_found_notes.append(f"- Reference `{w}`: **NOT FOUND** in codebase. Mark as **NEW COMPONENT REQUIRED**.")

        not_found_str = "\n".join(not_found_notes) if not_found_notes else "None. All referenced entities verified against repository."

        # Compile final prompt specification
        prompt_spec = f"""# TASK: {req.get('goal', 'Execute engineering task')}

# USER INTENT
{req.get('goal', '')}
Scope: {req.get('scope', 'feature')} | Priority: {req.get('priority', 'medium')}

# CURRENT SYSTEM ARCHITECTURE & MEMORY
{memory if memory else "Standard Fullstack Architecture (NestJS Backend + Python Engine + Next.js Frontend)"}

# RELEVANT EXISTING FILES
{chr(10).join(files_to_modify) if files_to_modify else "No existing files matched directly. Target files will be newly created."}

# CODEBASE VERIFICATION & ZERO-HALLUCINATION AUDIT
{not_found_str}

# DETAILED FILE CONTEXTS
{chr(10).join(file_sections) if file_sections else "No existing file contents attached."}

# REQUIREMENTS
1. Fulfill user intent: "{req.get('goal', '')}"
2. Reuse existing abstractions, services, and database models wherever possible.
3. Follow repository conventions defined in `.ai/conventions.md`.
4. Ensure all newly added or modified methods have appropriate error handling.

# CONSTRAINTS
1. DO NOT ruin or rewrite existing unrelated logic.
2. DO NOT destroy or overwrite uncommitted user git changes.
3. Ensure backwards compatibility with existing API contracts.
4. Pass automated test suite before reporting completion.

# PROPOSED IMPLEMENTATION PLAN
1. Inspect existing relevant files listed above.
2. Implement required modifications / new files.
3. Verify signature compatibility across callers and services.
4. Execute test suite and verify clean completion.

# FILES TO MODIFY
{chr(10).join(files_to_modify) if files_to_modify else "None"}

# FILES TO CREATE
{chr(10).join(files_to_create) if files_to_create else "None (Modify existing files)"}

# FILES THAT MUST NOT BE MODIFIED
- `docker-compose.yml` (unless infrastructure change is explicitly requested)
- `backend/prisma/schema.prisma` (unless schema migration is explicitly required)

# TESTING REQUIREMENTS
- Run Jest tests for backend modifications (`npm test` in backend).
- Run Pytest for engine modifications (`pytest` in engine).

# ACCEPTANCE CRITERIA
- [ ] Requirements implemented accurately without breaking existing workflows.
- [ ] Zero unhandled exception paths.
- [ ] Unit tests pass cleanly.
- [ ] No secrets or environment credentials exposed.

# EDGE CASES & REGRESSION RISKS
- Potential API signature mismatches across NestJS and FastAPI services.
- Database connection lifecycle issues during queue background jobs.

# FINAL REPORT REQUIREMENT
The agent MUST report upon completion:
- Files created or modified
- Implementation summary
- Test commands executed & results
- Known limitations or follow-up items
"""
        return prompt_spec.strip()
