import os
import re
from pathlib import Path
from typing import Dict, Any, List, Set, Optional

from agent_compiler.utils.security import SecurityFilter
from agent_compiler.utils.cache import FileCache


class RepoAnalyzer:
    """Inspects and indexes the repository structure, modules, routes, services, schemas, and tests."""

    def __init__(self, root_dir: str):
        self.root_dir = Path(root_dir).resolve()
        self.security = SecurityFilter(str(self.root_dir))
        self.cache = FileCache(str(self.root_dir / ".ai" / "cache.json"))
        self._index: Optional[Dict[str, Any]] = None

    def analyze_repository(self) -> Dict[str, Any]:
        """Perform repository structural analysis."""
        if self._index:
            return self._index

        tech_stack = self._detect_tech_stack()
        structure = self._scan_directory_structure()
        modules = self._find_key_modules()
        database = self._find_database_schema()
        tests = self._find_tests()

        self._index = {
            "root": str(self.root_dir),
            "tech_stack": tech_stack,
            "structure": structure,
            "modules": modules,
            "database": database,
            "tests": tests,
        }
        return self._index

    def _detect_tech_stack(self) -> Dict[str, Any]:
        stack = {
            "languages": [],
            "backend": None,
            "engine": None,
            "frontend": None,
            "database": None,
            "test_runners": []
        }
        if (self.root_dir / "backend" / "package.json").exists():
            stack["languages"].append("TypeScript")
            stack["backend"] = "NestJS (TypeScript)"
            stack["test_runners"].append("jest")

        if (self.root_dir / "engine" / "pyproject.toml").exists():
            stack["languages"].append("Python")
            stack["engine"] = "FastAPI / Python (moneyprinterturbo)"
            stack["test_runners"].append("pytest")

        if (self.root_dir / "frontend" / "package.json").exists():
            stack["frontend"] = "Next.js (React)"

        if (self.root_dir / "backend" / "prisma" / "schema.prisma").exists():
            stack["database"] = "PostgreSQL via Prisma ORM"

        return stack

    def _scan_directory_structure(self) -> List[str]:
        relative_dirs = []
        for p in self.root_dir.glob("*"):
            if p.is_dir() and not self.security.is_ignored(str(p)):
                relative_dirs.append(p.name)
        return relative_dirs

    def _find_key_modules(self) -> Dict[str, List[str]]:
        modules = {
            "backend_modules": [],
            "engine_services": [],
            "frontend_components": []
        }

        backend_modules_dir = self.root_dir / "backend" / "src" / "modules"
        if backend_modules_dir.exists():
            for m in backend_modules_dir.iterdir():
                if m.is_dir():
                    modules["backend_modules"].append(m.name)

        engine_services_dir = self.root_dir / "engine" / "app" / "services"
        if engine_services_dir.exists():
            for s in engine_services_dir.glob("*.py"):
                if s.name != "__init__.py":
                    modules["engine_services"].append(s.name)

        return modules

    def _find_database_schema(self) -> Dict[str, Any]:
        prisma_schema = self.root_dir / "backend" / "prisma" / "schema.prisma"
        models = []
        if prisma_schema.is_file():
            try:
                text = prisma_schema.read_text(encoding="utf-8")
                models = re.findall(r"model\s+(\w+)\s*\{", text)
            except Exception:
                pass
        return {"type": "Prisma", "path": "backend/prisma/schema.prisma", "models": models}

    def _find_tests(self) -> List[str]:
        test_files = []
        for p in self.root_dir.glob("**/*"):
            if p.is_file() and not self.security.is_ignored(str(p)):
                if p.name.endswith(".spec.ts") or p.name.endswith(".test.ts") or p.name.startswith("test_"):
                    test_files.append(str(p.relative_to(self.root_dir)))
        return test_files

    def search_relevant_files(self, keywords: List[str], max_files: int = 15) -> List[Dict[str, Any]]:
        """
        Search repository files using keywords extracted from requirement.
        Returns list of relevant files with path, relevance score, and match context.
        """
        results = []
        clean_keywords = [k.lower() for k in keywords if len(k) > 2]
        if not clean_keywords:
            return results

        for p in self.root_dir.glob("**/*"):
            if not p.is_file() or self.security.is_ignored(str(p)):
                continue

            rel_path = str(p.relative_to(self.root_dir))
            ext = p.suffix.lower()
            if ext not in [".ts", ".js", ".py", ".prisma", ".json", ".md", ".toml"]:
                continue

            score = 0
            path_lower = rel_path.lower()
            for kw in clean_keywords:
                if kw in path_lower:
                    score += 5

            # Read content snippet if file might be relevant or path matched
            try:
                content = p.read_text(encoding="utf-8", errors="ignore")
                content_lower = content.lower()
                for kw in clean_keywords:
                    count = content_lower.count(kw)
                    if count > 0:
                        score += min(count, 5)
            except Exception:
                continue

            if score > 0:
                results.append({
                    "path": rel_path,
                    "score": score,
                    "size": p.stat().st_size
                })

        results.sort(key=lambda x: x["score"], reverse=True)
        return results[:max_files]
