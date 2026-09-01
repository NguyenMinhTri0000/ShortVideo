import subprocess
from pathlib import Path
from typing import Dict, Any, List, Tuple


class GitSafetyGuard:
    """Ensures git safety before and during AI coding agent execution."""

    def __init__(self, root_dir: str):
        self.root_dir = Path(root_dir).resolve()

    def _run_git(self, args: List[str]) -> Tuple[int, str, str]:
        try:
            res = subprocess.run(
                ["git"] + args,
                cwd=self.root_dir,
                capture_output=True,
                text=True,
                check=False
            )
            return res.returncode, res.stdout.strip(), res.stderr.strip()
        except Exception as e:
            return -1, "", str(e)

    def is_git_repo(self) -> bool:
        code, stdout, _ = self._run_git(["rev-parse", "--is-inside-work-tree"])
        return code == 0 and stdout == "true"

    def get_status(self) -> Dict[str, Any]:
        """Check working tree status, returns clean status, branch, and uncommitted files."""
        if not self.is_git_repo():
            return {
                "is_git": False,
                "is_clean": True,
                "branch": "none",
                "modified": [],
                "untracked": []
            }

        _, branch, _ = self._run_git(["rev-parse", "--abbrev-ref", "HEAD"])
        _, status_out, _ = self._run_git(["status", "--porcelain"])

        modified = []
        untracked = []

        if status_out:
            for line in status_out.splitlines():
                line = line.strip()
                if not line:
                    continue
                code = line[:2]
                path = line[3:]
                if code.strip() in ["M", "MM", "AM", "RM", "D"]:
                    modified.append(path)
                elif code.strip() == "??":
                    untracked.append(path)

        return {
            "is_git": True,
            "is_clean": len(modified) == 0 and len(untracked) == 0,
            "branch": branch,
            "modified": modified,
            "untracked": untracked
        }

    def create_checkpoint(self, checkpoint_name: str = "agent-checkpoint") -> Tuple[bool, str]:
        """Create a safe git stash or commit checkpoint for uncommitted changes."""
        status = self.get_status()
        if not status["is_git"]:
            return False, "Not a git repository."

        if status["is_clean"]:
            return True, "Working tree clean. No checkpoint needed."

        code, out, err = self._run_git(["stash", "create"])
        if code == 0 and out:
            commit_hash = out
            self._run_git(["stash", "store", "-m", f"{checkpoint_name}-{commit_hash[:7]}", commit_hash])
            return True, f"Checkpoint created safely: {commit_hash[:7]}"
        return False, f"Failed to create checkpoint: {err}"
