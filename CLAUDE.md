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
DOCKER_HOST="unix://$HOME/.colima/default/docker.sock" docker-compose down && DOCKER_HOST="unix://$HOME/.colima/default/docker.sock" docker-compose up -d --build
```

**⚠️ Always use `--build`.** `docker-compose up` without `--build` reuses cached images and will not pick up source file changes in any service directory.

**⚠️ Schema changes require `-v` to take effect.** `docker-compose down` without `-v` keeps the `pgdata` named volume. PostgreSQL's init scripts (`docker-entrypoint-initdb.d/`) only run on an empty data directory. If you change `bootstrap.sql` (e.g. adding indexes), use:
```bash
DOCKER_HOST="unix://$HOME/.colima/default/docker.sock" docker-compose down -v && DOCKER_HOST="unix://$HOME/.colima/default/docker.sock" docker-compose up -d --build
```
Then wait for the seed to finish (~2 min) before verifying schema. A regular `down && up --build` will silently skip the new SQL.

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

When implementing a task, follow these steps **in order**. Do not skip or reorder. Do not tell the user to do step 3 — the agent does it.

1. **Edit** — implement the fix as described in the approved plan. Scope strictly to what the plan says.
2. **Verify** — run TypeScript type checking, linting, and any applicable tests. Fix errors before proceeding.
3. **Rebuild containers** — run this on the user's behalf without being asked:
   ```bash
   DOCKER_HOST="unix://$HOME/.colima/default/docker.sock" docker-compose down && DOCKER_HOST="unix://$HOME/.colima/default/docker.sock" docker-compose up -d --build
   ```
   Wait for Vite to report "ready". Do not tell the user to do this — the agent owns this step. Always use `--build` to ensure source changes are picked up.
4. **Ask user to verify in browser** — the agent cannot do manual QA. Ask the user to confirm the change works as expected.
5. **Update task status** — only after user confirms. Mark the task complete in `tasks/task-N-plan.md`.
6. **Update retro** — record any learnings, surprises, or root cause details in `tasks/task-N-retro-summary.md`.
7. **Harden tooling** — if any recurring process failure or misunderstanding was identified, update `CLAUDE.md` or other artifacts so it cannot happen again in a future session.

## Planning Convention

Before implementing any task:
1. If the task is already clearly specified in the approved plan AND the user has stated which item to work on, **do not ask clarifying questions that are already answered by the plan**. Read the plan, describe the process, and begin.
2. Only interview the user when intent is genuinely ambiguous or a decision is not covered by the plan.
3. Explore the codebase thoroughly, then create `tasks/task-N-plan.md` with: problems discovered, which files to change, the approach and reasoning, and a verification checklist. **No code in the plan** — the execution agent writes code from the intent described. Plans describe the what and why, not the how.
4. Create or update `tasks/task-N-retro-summary.md` during planning with: investigation findings, root cause analysis (explain the problem in plain language, not just which files), key decisions made and why, and a before/after metrics table. The execution agent fills in wall-clock numbers after implementation.
5. The plan must be approved by the user before any code is written.
