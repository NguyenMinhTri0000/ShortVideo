# Architectural Decision Records (ADR)

## ADR-001: Integrated Requirement-to-Agent Prompt Compiler
- **Context**: The project relied on manual ChatGPT copying to generate prompts for AI coding agents.
- **Decision**: Build an in-repository Python module `agent_compiler` and executable `./agent` to analyze user requirements, index repository context, compile structured prompts, execute agents, run tests, and review code automatically.
- **Consequences**: Fast feedback loop, zero prompt-engineering overhead for users, zero hallucination of non-existent codebase files, automatic git safety and repair loops.
