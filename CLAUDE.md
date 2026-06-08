# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## How to Work Here

**Collaboration:** Propose major decisions before implementing. Autonomous on smaller optimizations.

**Priorities (in order):** Performance metrics first > code quality > feature completeness > documentation

**Out of scope:** generic linting without perf/readability benefit.

See `process.md` for context on what's been explored, `tasks/` for detailed specs, `README.md` for project overview. See `prompts/` for planning and execution agent prompt templates.

## Local Development with Colima

This project uses **Colima** (not Docker Desktop) for the container runtime. When running `docker-compose` commands, always set:

```bash
export DOCKER_HOST="unix://$HOME/.colima/default/docker.sock"
```

Or inline:
```bash
DOCKER_HOST="unix://$HOME/.colima/default/docker.sock" docker-compose <command>
```

**⚠️ Hot reload is NOT reliable.** File system watch events (inotify) do not reliably propagate from the host into the Colima VM. Vite's file watcher may miss changes. After editing code, **always rebuild the containers** instead of assuming hot reload works:

```bash
DOCKER_HOST="unix://$HOME/.colima/default/docker.sock" docker-compose down && docker-compose up -d
```

Wait 30–60 seconds for Vite to report "ready in X ms", then refresh the browser. See `tasks/task-1-retro-summary.md` for details on why this is necessary.

## Memory vs Repository Documentation

**Save to the repository (version-controlled):**
- Project setup and infrastructure (Docker, build processes, local dev requirements)
- Development conventions and workflow standards
- Recurring patterns or gotchas that affect all work
- Anything that belongs in the codebase context for future developers

**Save to memory (session-specific):**
- User preferences ("I prefer terse responses")
- Personal workflow notes ("I always run tests before pushing")
- Context that doesn't affect the code itself
- Learnings from debugging that are specific to one user's environment

Before saving to memory, ask: "Does every developer and every future agent need to know this?" If yes, it belongs in the repo.

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

## Verification Approach

**Agent verifies:** Type safety (TypeScript), linting (ESLint), tests, code logic correctness, build success.

**Agent does NOT:** Manually test UI/UX in browser via dev server.

**User verifies:** Manual QA in browser. User is final voice on task completion. Document learnings in `tasks/task-N-retro-summary.md` for each subtask.
