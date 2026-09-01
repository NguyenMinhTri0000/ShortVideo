from pathlib import Path
from typing import Dict, Any, List, Optional

from agent_compiler.utils.security import SecurityFilter
from agent_compiler.project_memory import ProjectMemory


class ContextBuilder:
    """Builds minimal but complete context for AI coding agents with strict security filtering."""

    def __init__(self, root_dir: str, project_memory: ProjectMemory):
        self.root_dir = Path(root_dir).resolve()
        self.security = SecurityFilter(str(self.root_dir))
        self.memory = project_memory

    def build_context(
        self,
        structured_req: Dict[str, Any],
        relevant_file_matches: List[Dict[str, Any]],
        max_context_chars: int = 40000
    ) -> Dict[str, Any]:
        """Assemble structured context package for PromptCompiler."""

        memory_text = self.memory.get_combined_memory_context()

        file_contexts = []
        total_chars = len(memory_text)

        for match in relevant_file_matches:
            rel_path = match["path"]
            abs_path = self.root_dir / rel_path

            if self.security.is_ignored(rel_path) or not abs_path.is_file():
                continue

            try:
                raw_content = abs_path.read_text(encoding="utf-8", errors="ignore")
                sanitized_content = self.security.sanitize_content(raw_content)

                # Cap file size if large
                if len(sanitized_content) > 6000:
                    sanitized_content = (
                        sanitized_content[:3000] +
                        "\n\n... [TRUNCATED FOR TOKEN OPTIMIZATION] ...\n\n" +
                        sanitized_content[-3000:]
                    )

                if total_chars + len(sanitized_content) > max_context_chars:
                    # Summarize / trim lower priority files
                    sanitized_content = (
                        f"// File summary: {rel_path} ({match['size']} bytes)\n"
                        f"// Key references matched: {match['score']}"
                    )

                total_chars += len(sanitized_content)
                file_contexts.append({
                    "path": rel_path,
                    "score": match["score"],
                    "content": sanitized_content
                })
            except Exception:
                continue

        return {
            "requirement": structured_req,
            "memory": memory_text,
            "files": file_contexts,
            "total_files_included": len(file_contexts),
            "estimated_chars": total_chars
        }
