import sys
import argparse
import time
from pathlib import Path
from typing import Optional

from agent_compiler.requirement_parser import RequirementParser
from agent_compiler.repo_analyzer import RepoAnalyzer
from agent_compiler.context_builder import ContextBuilder
from agent_compiler.prompt_compiler import PromptCompiler
from agent_compiler.git_safety import GitSafetyGuard
from agent_compiler.agent_executor import AgentExecutor
from agent_compiler.test_runner import TestRunner
from agent_compiler.code_reviewer import CodeReviewer
from agent_compiler.self_healing import SelfHealingRepairLoop
from agent_compiler.project_memory import ProjectMemory


def print_stage(step: int, total: int, title: str):
    print(f"\n\033[1;36m[{step}/{total}] {title}\033[0m")


def main():
    parser = argparse.ArgumentParser(
        description="AI Requirement-to-Agent Prompt Compiler & Orchestrator CLI"
    )
    parser.add_argument("requirement", nargs="?", default="", help="User requirement in natural language")
    parser.add_argument("--plan", "-p", action="store_true", help="Preview mode: compile plan and prompt without modifying code")
    parser.add_argument("--auto", "-a", action="store_true", help="Auto mode: execute full pipeline without prompting")
    parser.add_argument("--review", "-r", action="store_true", help="Review mode: run code review on uncommitted changes")
    parser.add_argument("--history", action="store_true", help="Show past task history")
    parser.add_argument("--provider", default="auto", help="AI provider (auto|gemini|openai|groq|deepseek)")

    args = parser.parse_args()
    root_dir = Path.cwd()

    memory = ProjectMemory(str(root_dir))
    git_guard = GitSafetyGuard(str(root_dir))

    if args.history:
        history = memory.list_history(limit=10)
        print("\n\033[1;33m=== Task Execution History ===\033[0m")
        if not history:
            print("No past tasks recorded in .ai/tasks/")
            return
        for t in history:
            print(f"- [{t.get('timestamp')}] Task `{t.get('task_id')}` ({t.get('status')}): {t.get('original_requirement')}")
        return

    if args.review:
        reviewer = CodeReviewer(str(root_dir))
        runner = TestRunner(str(root_dir))
        git_status = git_guard.get_status()
        test_res = runner.run_tests_for_files(git_status.get("modified", []))
        rev = reviewer.review_changes(git_status.get("modified", []), test_res)
        print("\n\033[1;32m=== Code Review Report ===\033[0m")
        print(f"Status: {rev['status']}")
        print(f"Severity: {rev['severity']}")
        if rev["issues"]:
            print("Issues:")
            for iss in rev["issues"]:
                print(f"  - {iss}")
        return

    req_text = args.requirement.strip()
    if not req_text:
        print("\033[1;31mError: Please provide a requirement.\033[0m")
        print("Usage: agent \"Thêm chức năng export flashcard ra Anki\"")
        sys.exit(1)

    task_id = f"task_{int(time.time())}"

    # Stage 1: Analyze Requirement
    print_stage(1, 7, "Analyzing requirement...")
    req_parser = RequirementParser()
    structured_req = req_parser.parse(req_text)
    print(f"  Scope: \033[32m{structured_req['scope']}\033[0m | Priority: {structured_req['priority']}")
    if structured_req.get("unknowns"):
        print("\033[1;33m  Ambiguity Warning:\033[0m")
        for u in structured_req["unknowns"]:
            print(f"    - {u}")

    # Stage 2: Inspect Repository
    print_stage(2, 7, "Inspecting repository...")
    analyzer = RepoAnalyzer(str(root_dir))
    index = analyzer.analyze_repository()
    keywords = req_text.split()
    relevant_files = analyzer.search_relevant_files(keywords)
    print(f"  Detected Stack: {index['tech_stack']['backend'] or 'Python Engine'}")
    print(f"  Matched {len(relevant_files)} relevant files in codebase.")

    # Stage 3: Build Context
    print_stage(3, 7, "Building context...")
    context_builder = ContextBuilder(str(root_dir), memory)
    ctx = context_builder.build_context(structured_req, relevant_files)
    print(f"  Context Assembled: {ctx['total_files_included']} files ({ctx['estimated_chars']} characters)")

    # Stage 4: Compile Prompt
    print_stage(4, 7, "Compiling coding prompt...")
    compiler = PromptCompiler(str(root_dir))
    compiled_prompt = compiler.compile(ctx)
    prompt_file = memory.record_prompt(task_id, compiled_prompt)
    print(f"  Prompt compiled cleanly -> \033[34m{prompt_file}\033[0m")

    if args.plan:
        print("\n\033[1;32m=== PREVIEW MODE (--plan) ===\033[0m")
        print(compiled_prompt[:2500])
        if len(compiled_prompt) > 2500:
            print("\n... [PROMPT TRUNCATED FOR PREVIEW] ...")
        print(f"\nFull compiled prompt saved to: {prompt_file}")
        return

    # Interactive Confirmation if not --auto
    if not args.auto:
        print("\n\033[1;35mImplementation Specification Summary:\033[0m")
        print(f"  Requirement: {structured_req['goal']}")
        print(f"  Scope: {structured_req['scope']}")
        print(f"  Relevant files: {[f['path'] for f in relevant_files[:5]]}")
        ans = input("\nProceed with agent execution? [Y/n]: ").strip().lower()
        if ans and ans not in ["y", "yes"]:
            print("Aborted by user.")
            sys.exit(0)

    # Git Safety Check
    git_status = git_guard.get_status()
    if git_status.get("is_git") and not git_status.get("is_clean"):
        print("\033[1;33mWorking tree has uncommitted changes. Creating safe checkpoint...\033[0m")
        ok, msg = git_guard.create_checkpoint(f"checkpoint-{task_id}")
        print(f"  Git Guard: {msg}")

    # Stage 5: Execute Agent
    print_stage(5, 7, "Executing coding agent...")
    executor = AgentExecutor(provider_type=args.provider)
    exec_res = executor.execute_prompt(compiled_prompt)
    print(f"  Agent Status: \033[32m{exec_res['status']}\033[0m ({exec_res['provider']})")

    # Stage 6: Run Tests
    print_stage(6, 7, "Running tests...")
    test_runner = TestRunner(str(root_dir))
    mod_files = git_guard.get_status().get("modified", [])
    test_res = test_runner.run_tests_for_files(mod_files)
    print(f"  Test Results: \033[32m{'PASSED' if test_res['passed'] else 'FAILED'}\033[0m")

    # Stage 7: Code Review & Self-Healing
    print_stage(7, 7, "Reviewing changes...")
    reviewer = CodeReviewer(str(root_dir))
    rev_res = reviewer.review_changes(mod_files, test_res)
    print(f"  Code Review Status: \033[32m{rev_res['status']}\033[0m")

    # Self-healing loop if needed
    attempt = 1
    self_healer = SelfHealingRepairLoop(executor)
    while (not test_res["passed"] or rev_res["status"] == "FAIL") and attempt <= SelfHealingRepairLoop.MAX_REPAIR_ATTEMPTS:
        print(f"\n\033[1;31mSelf-Healing Repair Attempt {attempt}/{SelfHealingRepairLoop.MAX_REPAIR_ATTEMPTS}...\033[0m")
        repair_res = self_healer.attempt_repair(
            original_requirement=req_text,
            attempt_number=attempt,
            modified_files=mod_files,
            test_results=test_res,
            review_result=rev_res
        )
        attempt += 1
        mod_files = git_guard.get_status().get("modified", [])
        test_res = test_runner.run_tests_for_files(mod_files)
        rev_res = reviewer.review_changes(mod_files, test_res)

    final_status = "COMPLETED" if test_res["passed"] and rev_res["status"] == "PASS" else "FAILED"

    # Record Task Memory
    task_record = {
        "task_id": task_id,
        "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
        "original_requirement": req_text,
        "structured_requirement": structured_req,
        "files_inspected": [f["path"] for f in relevant_files],
        "files_modified": mod_files,
        "prompt_file": prompt_file,
        "test_results": test_res,
        "review_results": rev_res,
        "repair_attempts": attempt - 1,
        "status": final_status
    }
    memory.record_task(task_record)

    print(f"\n\033[1;32m=== TASK {final_status} ===\033[0m")
    print(f"Task ID: {task_id}")
    print(f"Record saved to `.ai/tasks/{task_id}.json`")


if __name__ == "__main__":
    main()
