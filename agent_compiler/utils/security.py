import fnmatch
import os
import re
from pathlib import Path
from typing import List

# Patterns that MUST be ignored from indexing and AI context
DEFAULT_IGNORE_PATTERNS = [
    ".env",
    ".env.*",
    "*.env",
    "*.pem",
    "*.key",
    "*.pfx",
    "*.p12",
    "node_modules",
    "node_modules/*",
    ".git",
    ".git/*",
    ".idea",
    ".vscode",
    "dist",
    "dist/*",
    "build",
    "build/*",
    "coverage",
    "coverage/*",
    "venv",
    ".venv",
    "__pycache__",
    "*.pyc",
    "*.log",
    "storage/*",
]

# Sensitive regex patterns to sanitize if present in content
SECRET_PATTERNS = [
    re.compile(r"(?i)(api[_-]?key|secret|password|bearer\s+|token|auth|key)\s*[:=]\s*['\"]?([a-zA-Z0-9_\-\.]{12,})['\"]?"),
    re.compile(r"AIzaSy[a-zA-Z0-9_\-]{33}"),
    re.compile(r"sk-[a-zA-Z0-9T3BlbkFJ]{32,}"),
    re.compile(r"-----BEGIN (RSA|EC|PRIVATE) KEY-----[\s\S]+?-----END \1 KEY-----"),
]


class SecurityFilter:
    def __init__(self, root_dir: str, custom_ignores: List[str] = None):
        self.root_dir = Path(root_dir).resolve()
        self.ignore_patterns = list(DEFAULT_IGNORE_PATTERNS)
        if custom_ignores:
            self.ignore_patterns.extend(custom_ignores)
        self._load_gitignore()

    def _load_gitignore(self):
        gitignore_path = self.root_dir / ".gitignore"
        if gitignore_path.is_file():
            try:
                with open(gitignore_path, "r", encoding="utf-8") as f:
                    for line in f:
                        line = line.strip()
                        if line and not line.startswith("#"):
                            self.ignore_patterns.append(line)
            except Exception:
                pass

    def is_ignored(self, path: str) -> bool:
        """Check if a given path relative to root_dir should be ignored."""
        try:
            rel_path = Path(path).resolve().relative_to(self.root_dir).as_posix()
        except ValueError:
            rel_path = Path(path).as_posix()

        parts = rel_path.split("/")
        for pattern in self.ignore_patterns:
            pattern_clean = pattern.rstrip("/")
            if fnmatch.fnmatch(rel_path, pattern) or fnmatch.fnmatch(rel_path, pattern_clean):
                return True
            for part in parts:
                if fnmatch.fnmatch(part, pattern_clean):
                    return True
        return False

    @staticmethod
    def sanitize_content(content: str) -> str:
        """Sanitize secrets, tokens, or credentials from raw text."""
        sanitized = content
        for pattern in SECRET_PATTERNS:
            def _redact(match):
                full = match.group(0)
                if len(match.groups()) >= 2 and match.group(2):
                    secret_val = match.group(2)
                    return full.replace(secret_val, "[REDACTED_SECRET]")
                return "[REDACTED_SECRET]"
            sanitized = pattern.sub(_redact, sanitized)
        return sanitized
