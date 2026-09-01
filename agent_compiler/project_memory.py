import json
import time
from pathlib import Path
from typing import Dict, Any, List, Optional


class ProjectMemory:
    """Manages repository AI memory located under `.ai/` directory."""

    def __init__(self, root_dir: str):
        self.root_dir = Path(root_dir).resolve()
        self.ai_dir = self.root_dir / ".ai"
        self.tasks_dir = self.ai_dir / "tasks"
        self.prompts_dir = self.ai_dir / "prompts"
        self._ensure_dirs()

    def _ensure_dirs(self):
        self.ai_dir.mkdir(parents=True, exist_ok=True)
        self.tasks_dir.mkdir(parents=True, exist_ok=True)
        self.prompts_dir.mkdir(parents=True, exist_ok=True)

    def read_doc(self, doc_name: str) -> str:
        """Read a documentation file from `.ai/` (e.g. 'architecture.md')."""
        file_path = self.ai_dir / doc_name
        if file_path.is_file():
            try:
                return file_path.read_text(encoding="utf-8")
            except Exception:
                return ""
        return ""

    def get_combined_memory_context(self) -> str:
        """Combine all relevant `.ai/` documentation for context building."""
        docs = ["project.md", "architecture.md", "conventions.md", "decisions.md", "current-state.md"]
        sections = []
        for doc in docs:
            content = self.read_doc(doc)
            if content.strip():
                sections.append(f"### Memory: {doc}\n{content.strip()}")
        return "\n\n".join(sections)

    def record_prompt(self, task_id: str, prompt_content: str) -> str:
        """Save a generated prompt to `.ai/prompts/` for audit and debugging."""
        file_path = self.prompts_dir / f"prompt_{task_id}.md"
        file_path.write_text(prompt_content, encoding="utf-8")
        return str(file_path)

    def record_task(self, task_data: Dict[str, Any]) -> str:
        """Save task execution record to `.ai/tasks/`."""
        task_id = task_data.get("task_id", f"task_{int(time.time())}")
        file_path = self.tasks_dir / f"{task_id}.json"
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(task_data, f, indent=2, ensure_ascii=False)
        self._update_current_state(task_data)
        return str(file_path)

    def list_history(self, limit: int = 10) -> List[Dict[str, Any]]:
        """List past task execution records."""
        tasks = []
        for p in sorted(self.tasks_dir.glob("*.json"), reverse=True):
            try:
                data = json.loads(p.read_text(encoding="utf-8"))
                tasks.append(data)
                if len(tasks) >= limit:
                    break
            except Exception:
                pass
        return tasks

    def _update_current_state(self, last_task: Dict[str, Any]):
        """Update current-state.md with recent task execution summary."""
        file_path = self.ai_dir / "current-state.md"
        existing = self.read_doc("current-state.md")
        timestamp = time.strftime("%Y-%m-%d %H:%M:%S")
        status = last_task.get("status", "COMPLETED")
        req = last_task.get("original_requirement", "")
        summary_line = f"- [{timestamp}] [{status}] Task `{last_task.get('task_id')}`: {req}\n"

        if "## Recent Execution History" in existing:
            updated = existing + summary_line
        else:
            updated = existing.strip() + f"\n\n## Recent Execution History\n" + summary_line

        file_path.write_text(updated, encoding="utf-8")
