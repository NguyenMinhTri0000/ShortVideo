import json
import re
from typing import Dict, Any, List, Optional


class RequirementParser:
    """Parses raw user input into a structured requirement object and detects ambiguity."""

    def __init__(self, repo_context_summary: str = ""):
        self.repo_context_summary = repo_context_summary

    def parse(self, raw_requirement: str) -> Dict[str, Any]:
        """Convert plain natural language user input into structured requirement dict."""
        raw_clean = raw_requirement.strip()
        req_lower = raw_clean.lower()

        # Scope detection heuristic
        if any(w in req_lower for w in ["sửa lỗi", "lỗi", "fix", "bug", "crash", "bị hỏng"]):
            scope = "bugfix"
        elif any(w in req_lower for w in ["tối ưu", "optimize", "chậm", "nhanh hơn", "tối ưu hoá"]):
            scope = "optimization"
        elif any(w in req_lower for w in ["refactor", "viết lại", "cấu trúc lại", "dọn dẹp"]):
            scope = "refactor"
        elif any(w in req_lower for w in ["tìm hiểu", "nghiên cứu", "khảo sát", "research"]):
            scope = "research"
        else:
            scope = "feature"

        # Priority detection heuristic
        if any(w in req_lower for w in ["gấp", "urgent", "nghiêm trọng", "critical", "hoàn toàn"]):
            priority = "high"
        elif any(w in req_lower for w in ["tùy chọn", "nhỏ", "nếu rảnh", "minor"]):
            priority = "low"
        else:
            priority = "medium"

        # Goal & Problem extraction
        goal = raw_clean
        problem = "User requested change or enhancement." if scope != "bugfix" else "System reported behavior issue."

        structured = {
            "goal": goal,
            "problem": problem,
            "requested_changes": [raw_clean],
            "constraints": [
                "Must preserve existing system architecture.",
                "Must comply with existing coding conventions in .ai/conventions.md.",
                "Must add or update relevant unit tests."
            ],
            "unknowns": [],
            "scope": scope,
            "priority": priority,
            "confidence": 0.85 if len(raw_clean) > 20 else 0.65
        }

        # Ambiguity check
        ambiguities = self.detect_ambiguity(structured)
        structured["unknowns"] = ambiguities

        return structured

    def detect_ambiguity(self, structured_req: Dict[str, Any]) -> List[str]:
        """
        Detect missing technical specifications in requirement.
        IMPORTANT: Checks if repository context already answers the question before listing as an ambiguity.
        """
        raw_text = structured_req.get("goal", "").lower()
        ambiguities = []

        # Example check for login / authentication
        if any(w in raw_text for w in ["đăng nhập", "login", "auth"]):
            # Check if repo already has JWT / Auth setup
            repo_summary_lower = self.repo_context_summary.lower()
            if "jwt" in repo_summary_lower or "auth" in repo_summary_lower or "passport" in repo_summary_lower:
                # Repo already has auth convention, do not ask user!
                pass
            else:
                ambiguities.append("Authentication mechanism (JWT/Session/OAuth) needs specification.")

        # Example check for export
        if "export" in raw_text and not any(ext in raw_text for ext in ["json", "csv", "anki", "pdf", "zip"]):
            if "anki" not in raw_text:
                ambiguities.append("Export format was not explicitly specified.")

        return ambiguities
