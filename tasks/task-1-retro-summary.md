# Task-1 Retro Summary: Quality Dashboard Performance & Usability

## Investigation Findings

### The Stack
- React 18 + TypeScript, Vite 5, Tailwind CSS, Recharts
- Node.js + Express 4 backend, raw SQL via node-postgres (no ORM)
- PostgreSQL 15, single denormalized table `clinical_data_raw`, ~500K rows
- No caching layer anywhere (no Redis, no HTTP cache headers, no client-side cache)

### Root Cause of Slow Load (Layer 1 — The Two-Punch Problem)

The dashboard freeze is caused by two compounding bugs stacked on top of each other:

**Bug 1 — Frontend fetch loop (`QualityDashboard.tsx:9,24–37`) — QualityDashboard only:**
A `fetchCount` state variable was placed in the `useEffect` dependency array. Every successful fetch increments `fetchCount`, which re-triggers the effect. This causes the API to be called 3–4 times per mount, sequentially — each call waits for the prior to complete before state updates trigger the next. The eslint suppression comment on the effect (`// eslint-disable-next-line react-hooks/exhaustive-deps`) confirms this was noticed and bypassed rather than fixed.

`StudyOverview` does NOT have this bug — its `useEffect` has a clean empty dependency array. It only suffers from the lack of data caching (cold re-fetch on every remount).

**Bug 2 — N+1 query pattern (`quality.routes.ts:18–57`):**
Each API call runs `1 + (N × 4)` sequential database queries where N is the number of distinct studies (currently 5, so 21 total): 1 `SELECT DISTINCT` to list studies, then 4 separate queries per study (total count, average quality score, high-quality count, low-quality count). Every query is a full sequential scan across 500K rows because there are no indexes on `study_id`. Each `quality_score` comparison also requires a runtime `CAST(quality_score AS DECIMAL)` because the column is typed as `TEXT`.

`studies.routes.ts` has the same pattern: `1 + (N × 3)` sequential queries (1 SELECT DISTINCT + 3 per study: participant count, measurement count, site count) — currently 16 total for 5 studies.

Combined effect: a single page load triggers up to 4 API calls × 21 sequential full-table scans = up to 84 sequential scans of a 500K-row table.

### Mounting and Navigation Problem (Layer 2)

`App.tsx` uses two different mounting strategies:
- `StudyOverview` uses `display:none` toggling — always mounted, always fetches on first render
- `QualityDashboard` uses `&&` conditional — unmounts on every tab switch, re-fetches every time the user returns

Neither strategy is correct. The right approach is lazy-loaded components with cached server state, so each component mounts once, fetches once, and subsequent tab switches show cached data instantly while optionally revalidating in the background.

### Readability Problems (Layer 3)

- Quality scores displayed to 4 decimal places (`0.9231`) — hard to parse at a glance
- Chart legend sits at the bottom inside the chart area, visually competing with rotated x-axis study name labels (45° rotation + 120px height reserved)
- Column headers in Study Details table have no explanatory context — "High Quality" and "Low Quality" thresholds are not visible to the user
- Navbar scrolls away — no way to navigate without scrolling back to the top

---

## Key Decisions Made

### Aggregation: compute at query time, not pre-stored
All 4 per-study metrics (total, avg, high-quality, low-quality) can be computed in a single SQL `GROUP BY` with `FILTER` aggregates. With a `study_id` index, this replaces 21 sequential scans with one indexed group scan. The data is seeded and stable, so materialized views or pre-computed storage are not necessary at this scale. Revisit if the dataset becomes dynamic or query volume grows significantly.

### Client-side data management: React Query (TanStack Query)
React Query is the right tool because this is a server state problem, not a client state problem. It provides: request deduplication (no duplicate in-flight fetches), configurable stale/cache time (so tab switches show cached data instantly), background revalidation, and built-in loading/error states that work naturally with Suspense and skeleton loaders. This directly supports LCP improvements — content can render progressively as data arrives rather than waiting for everything before showing anything. A home-built solution with `useRef` or component-level state would re-invent this wheel without the reliability guarantees.

### Score display: percentage with navbar toggle
The 0–1 scale is the native format coordinators may be trained on. Switching to percentage unilaterally risks confusing users. A navbar toggle (decimal ↔ percentage) lets each user choose their preferred format. Full precision is preserved — no truncation — so the toggle is purely a display transform.

### Database migration: SQL migration file in the repo
Changes to the running database (adding indexes) should live as a versioned SQL file (`database/migrations/001_add_indexes.sql`) applied via `docker exec`. This keeps the change in git, is idempotent (`IF NOT EXISTS`), and documents exactly what was added and why. Bootstrap.sql is updated in parallel so future container rebuilds also get the indexes.

---

## Files Changed

| File | What changed |
|------|-------------|
| `database/bootstrap.sql` | Added index definitions |
| `database/migrations/001_add_indexes.sql` | Migration file for live container |
| `api/src/routes/quality.routes.ts` | Replaced N+1 loop with single GROUP BY query |
| `api/src/routes/studies.routes.ts` | Same GROUP BY treatment (in scope) |
| `frontend/package.json` | Added `@tanstack/react-query` |
| `frontend/src/main.tsx` | Wrapped app in QueryClientProvider |
| `frontend/src/App.tsx` | Sticky nav, lazy imports, Suspense wrappers, removed display:none, score toggle state |
| `frontend/src/components/QualityDashboard.tsx` | React Query hook, skeleton loader, legend right, column tooltips, score toggle prop |
| `frontend/src/components/StudyOverview.tsx` | React Query hook, skeleton loader |

---

## Development Workflow: Docker Hot Reload Not Reliable

### Finding
This project uses Docker with Colima on macOS. File system watch events (inotify) do not reliably propagate from the host into the container, causing Vite's file watcher to miss changes. When an agent edits code, the running container often does not detect the change and hot reload fails silently.

### Why It Happens
- Colima runs a Linux VM on macOS
- Volume mounts bridge host files to the container via the VM's file system layer
- File change events don't always propagate reliably through this bridge
- Vite's `chokidar` file watcher in the container misses the notification

### Solution
After making code changes, agents **must** rebuild the containers:
```bash
DOCKER_HOST="unix://$HOME/.colima/default/docker.sock" docker-compose down && DOCKER_HOST="unix://$HOME/.colima/default/docker.sock" docker-compose up -d
```
Wait ~30–60 seconds for Vite to report "ready". Then refresh the browser. Do NOT assume hot reload works.

### Impact on Task 5
Sticky navbar was implemented but required a full container rebuild to verify. Document this in CLAUDE.md so future agents don't waste time troubleshooting hot reload when a rebuild is the only fix.

---

## Performance Improvements

| Metric | Before | After |
|--------|--------|-------|
| API calls per dashboard load | 3–4 | 1 |
| DB queries per API call | 21 sequential | 1 GROUP BY |
| DB scan type | Full table scan (500K rows) × 21 | Indexed group scan × 1 |
| Tab switch cost | Full re-fetch | Instant (cached) |
| LCP | Blocked until all 84 scans complete | Progressive — skeleton renders immediately |

*Verification steps for LCP and tab-switch cost: measure in DevTools Lighthouse / Performance tab before and after. Fill in wall-clock times below once implementation is complete.*

| Metric | Before (wall-clock) | After (wall-clock) |
|--------|--------------------|--------------------|
| API `executionTime` (quality) | — | — |
| API `executionTime` (studies) | — | — |
| LCP (first load) | — | — |
| Tab switch (return visit) | — | — |

*(Remaining wall-clock times to be filled in as subsequent tasks complete)*

---

## Session Learnings (Problem #1 — fetchCount fix)

### HAR Evidence
- Before: 4 sequential requests to `/api/quality/distribution` (3339ms + 2180ms + 1771ms + 1752ms)
- After: 1 request (1977ms)
- Fix: removed `fetchCount` state and dep array entry from `QualityDashboard.tsx`

### Seed Idempotency Bug Discovered
The `seed-data.js` script had no guard against re-running on an already-populated database. Every `docker-compose down && up` appended 500K rows to the existing data because the `pgdata` named volume persists across restarts. With 1.5M rows, the N+1 queries took ~5.78s (vs ~1.7s at 500K rows), making the fix appear to regress performance.

Fix: added a row count check at startup in `seed-data.js` — exits early if any rows exist. Also noted that `docker-compose up` (without `--build`) does not rebuild images; use `--build` when source files in a service directory change.

### Docker Rebuild Rule Clarified
`docker-compose down && up` reuses existing images. If a service's source files changed, `--build` is required to pick up the change. The CLAUDE.md rebuild command should always include `--build` so code changes are reflected.
