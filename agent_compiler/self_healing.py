from typing import Dict, Any, List
from agent_compiler.agent_executor import AgentExecutor


class SelfHealingRepairLoop:
    """Manages iterative repair loops when tests or code review fail."""

    MAX_REPAIR_ATTEMPTS = 3

    def __init__(self, agent_executor: AgentExecutor):
        self.executor = agent_executor

    def compile_fix_prompt(
        self,
        original_requirement: str,
        failed_attempt: int,
        modified_files: List[str],
        test_results: Dict[str, Any],
        review_result: Dict[str, Any]
    ) -> str:
        """Compile failure context into a targeted Fix Prompt for the coding agent."""

        test_failures = []
        for suite in test_results.get("suite_results", []):
            if not suite.get("passed", True):
                test_failures.append(
                    f"### Suite: {suite['suite']}\n"
                    f"STDOUT:\n{suite.get('stdout', '')}\n"
                    f"STDERR:\n{suite.get('stderr', '')}"
                )

        review_issues = "\n".join([f"- {issue}" for issue in review_result.get("issues", [])])

        fix_prompt = f"""# REPAIR TASK (Attempt {failed_attempt}/{self.MAX_REPAIR_ATTEMPTS})

The previous implementation attempt failed verification. Fix the issues below without breaking existing functionality.

# ORIGINAL REQUIREMENT
{original_requirement}

# FILES MODIFIED SO FAR
{chr(10).join([f'- {f}' for f in modified_files]) if modified_files else 'None'}

# TEST FAILURE DETAILS
{chr(10).join(test_failures) if test_failures else 'No explicit test stdout recorded.'}

# CODE REVIEW FINDINGS
{review_issues if review_issues else 'None'}

# REPAIR INSTRUCTIONS
1. Analyze the exact error tracebacks above.
2. Fix the root cause in the affected files.
3. Do NOT make superficial patches or comment out broken tests.
4. Verify that all tests pass cleanly after your fix.
"""
        return fix_prompt.strip()

    def attempt_repair(
        self,
        original_requirement: str,
        attempt_number: int,
        modified_files: List[str],
        test_results: Dict[str, Any],
        review_result: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Execute repair attempt if within max repair limit."""
        if attempt_number > self.MAX_REPAIR_ATTEMPTS:
            return {
                "status": "MAX_ATTEMPTS_EXCEEDED",
                "message": f"Self-healing repair stopped after reaching maximum limit ({self.MAX_REPAIR_ATTEMPTS} attempts)."
            }

        fix_prompt = self.compile_fix_prompt(
            original_requirement=original_requirement,
            failed_attempt=attempt_number,
            modified_files=modified_files,
            test_results=test_results,
            review_result=review_result
        )

        res = self.executor.execute_prompt(fix_prompt)
        return {
            "attempt": attempt_number,
            "fix_prompt": fix_prompt,
            "execution_result": res
        }
