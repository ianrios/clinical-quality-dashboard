# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## How to Work Here

**Collaboration:** Propose major decisions before implementing. Autonomous on smaller optimizations.

**Priorities (in order):** Performance metrics first > code quality > feature completeness > documentation

**Out of scope:** generic linting without perf/readability benefit.

See `process.md` for context on what's been explored, `tasks/` for detailed specs, `README.md` for project overview. See `prompts/` for planning and execution agent prompt templates.

## Planning Convention

Before implementing any task:
1. Interview the user about pain points and decisions — do not assume intent
2. Explore the codebase thoroughly, then create `tasks/task-N-plan.md` with: problems discovered, which files to change, the approach and reasoning, and a verification checklist. **No code in the plan** — the execution agent writes code from the intent described. Plans describe the what and why, not the how.
3. Create or update `tasks/task-N-retro-summary.md` during planning with: investigation findings, root cause analysis (explain the problem in plain language, not just which files), key decisions made and why, and a before/after metrics table. The execution agent fills in wall-clock numbers after implementation.
4. The plan must be approved by the user before any code is written.

## Execution Convention

When implementing, the execution agent should:
- Read `tasks/task-N-plan.md` and `tasks/task-N-retro-summary.md` for full context
- Update `tasks/task-N-retro-summary.md` with actual before/after performance numbers
- Not add features or fixes beyond what the approved plan describes
