import subprocess
from pathlib import Path
from typing import Dict, Any, List


class CodeReviewer:
    """Performs automated code review on code changes and test outputs."""

    def __init__(self, root_dir: str):
        self.root_dir = Path(root_dir).resolve()

    def review_changes(self, modified_files: List[str], test_results: Dict[str, Any]) -> Dict[str, Any]:
        """Perform review analysis on git changes and test results."""
        issues = []
        recommendations = []
        severity = "none"

        # 1. Check test results
        if not test_results.get("passed", True):
            issues.append("Automated test suite failed after agent code modifications.")
            severity = "high"

        # 2. Check git diff for obvious security or syntax issues
        diff_text = self._get_git_diff()

        if "eval(" in diff_text or "exec(" in diff_text:
            issues.append("Detected potential arbitrary code execution vulnerability (eval/exec).")
            severity = "critical"

        if "process.env.API_KEY" in diff_text and "hardcoded" in diff_text.lower():
            issues.append("Possible hardcoded secret in modified files.")
            severity = "high"

        if not modified_files:
            recommendations.append("No files were modified by the agent task.")

        status = "FAIL" if (issues and severity in ["high", "critical"]) else "PASS"

        return {
            "status": status,
            "issues": issues,
            "severity": severity,
            "recommendations": recommendations,
            "diff_summary_length": len(diff_text)
        }

    def _get_git_diff(self) -> str:
        try:
            res = subprocess.run(
                ["git", "diff", "HEAD"],
                cwd=self.root_dir,
                capture_output=True,
                text=True,
                check=False
            )
            return res.stdout if res.returncode == 0 else ""
        except Exception:
            return ""
