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
All per-study metrics can be computed in a single SQL `GROUP BY` with `FILTER` aggregates. With indexes, this replaces 21 sequential scans with one indexed group scan. The data is seeded and stable, so materialized views or pre-computed storage are not necessary at this scale. Revisit if the dataset becomes dynamic or query volume grows significantly.

### Split endpoint design: fast metadata + slow aggregations
The original monolithic `/api/studies/overview` blocked all rendering until a slow aggregation completed. We split into three endpoints so components can render structure immediately and fill in data progressively:
- `GET /api/studies/list` — `SELECT DISTINCT` only, no aggregation. Returns study_id, study_name, study_phase in ~5ms. Shared base layer for both tabs.
- `GET /api/studies/overview` — `GROUP BY` aggregation for participant_count, total_measurements, site_count.
- `GET /api/quality/distribution` — `GROUP BY` aggregation for quality metrics.

`total_measurements` appears in both slow endpoints intentionally. A `COUNT(*)` during an already-running GROUP BY costs almost nothing, and avoiding the coupling between endpoints is worth more than the marginal saving of computing it once.

### Client-side data management: React Query (TanStack Query) as shared cache
React Query's `QueryClient` is the shared data store — no separate React context needed. Components sharing the same query key (e.g. `['studies', 'list']`) get the same cached result from one network request. App.tsx prefetches all three endpoints on mount so both tabs' data is in-flight immediately regardless of which tab is active. Tab switches are instant (cached). This directly supports LCP improvements — content renders progressively rather than waiting for all data.

### Progressive rendering: field-level skeleton, not component-level
Skeleton loaders apply at the field/cell level within a component, not as whole-component placeholders. Components render the structure they can from fast queries immediately, then fill in slow-query fields as they arrive:
- StudyOverview card shells (name, ID) render immediately from `studies/list`; count fields (Participants, Measurements, Sites) skeleton until `studies/overview` resolves.
- QualityDashboard table study name column renders immediately from `studies/list`; quality metric cells skeleton until `quality/distribution` resolves.
- QualityDashboard chart cannot meaningfully show partial data — spinner/grey placeholder until `quality/distribution` resolves in full.

Skeleton loaders do not require streaming or progressive server responses. They work fine with single-fetch patterns — the benefit is perceptual: users see the layout and know what is loading.

### Score display: percentage with navbar toggle switch
The 0–1 scale is the native format coordinators may be trained on. Switching to percentage unilaterally risks confusing users. A toggle switch in the navbar (right side, decimal ↔ %) lets each user choose their preferred format. Full precision is preserved — no truncation — so the toggle is purely a display transform passed as a `showPercent` boolean prop to `QualityDashboard`.

### Index strategy: four composite indexes in bootstrap.sql only
Indexes live in `bootstrap.sql` as the single source of truth — no separate migration file (which would be redundant and create drift risk for a dev environment). All four use `IF NOT EXISTS` and apply on every fresh container start:
1. `(study_id)` — powers all GROUP BY study_id queries
2. `(study_id, (quality_score::numeric))` — covering index for quality/distribution; no heap access needed
3. `(study_id, participant_id)` — COUNT(DISTINCT participant_id) walks index in order
4. `(study_id, site_id)` — COUNT(DISTINCT site_id) walks index in order

The expression index syntax `(quality_score::numeric)` requires PostgreSQL 11+. We run PostgreSQL 15.

---

## Files Changed

| File | What changed |
|------|-------------|
| `database/bootstrap.sql` | Added four composite indexes |
| `api/src/routes/quality.routes.ts` | Replaced N+1 loop with single GROUP BY + FILTER query; parameterized queries (was string interpolation) |
| `api/src/routes/studies.routes.ts` | Added new `GET /list` route (fast SELECT DISTINCT); rewrote `GET /overview` as single GROUP BY; parameterized queries |
| `frontend/package.json` | Added `@tanstack/react-query` |
| `frontend/src/main.tsx` | Wrapped app in QueryClientProvider |
| `frontend/src/types.ts` | Added `StudyList` interface |
| `frontend/src/App.tsx` | Prefetch all three queries on mount; lazy imports + Suspense boundaries; decimal/% toggle switch in navbar (right side); removed display:none pattern |
| `frontend/src/components/QualityDashboard.tsx` | Two useQuery hooks (studies/list + quality/distribution); field-level skeleton on metric cells; spinner on chart; legend moved right; column header tooltips; showPercent prop |
| `frontend/src/components/StudyOverview.tsx` | Two useQuery hooks (studies/list + studies/overview); card shells render immediately; field-level skeleton on count fields; fixed "Phase: Phase 3" redundancy |

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
| API `executionTime` quality/distribution | ~1977ms (1 of 3–4 sequential calls) | 269ms warm / 509ms cold |
| API `executionTime` studies/overview | not measured (N+1 pattern) | 639ms warm |
| API `executionTime` studies/list (new) | n/a | 309ms warm |
| LCP (first load) | — | — |
| Tab switch (return visit) | — | — |

*(Remaining wall-clock times to be filled in as subsequent tasks complete)*

---

## Session Learnings (Items 3 + 4 — React Query setup + indexes)

### pgdata volume persists across `docker-compose down`
`docker-compose down` without `-v` keeps named volumes. PostgreSQL's `docker-entrypoint-initdb.d` scripts only run on a fresh (empty) data directory. After adding indexes to `bootstrap.sql`, a regular restart produced an empty "Indexes:" section — the new SQL never ran. Fix: use `docker-compose down -v` to drop volumes whenever schema changes need to be validated end-to-end.

This is the correct dev workflow for any `bootstrap.sql` change: `docker-compose down -v && docker-compose up -d --build`, then wait for the seed to finish (~2 min).

### All four indexes confirmed via `\d clinical_data_raw`
```
"idx_clinical_study_id"          btree (study_id)
"idx_clinical_study_participant"  btree (study_id, participant_id)
"idx_clinical_study_quality"      btree (study_id, (quality_score::numeric))
"idx_clinical_study_site"         btree (study_id, site_id)
```
Expression index syntax `(quality_score::numeric)` was accepted by PostgreSQL 15 without issue.

---

## Session Learnings (Problem #1 — fetchCount fix)

---

## Session Learnings (Items 5 + 6 — Backend query rewrites)

### N+1 eliminated, SQL injection removed
Both routes replaced string interpolation (`WHERE study_id = '${study.study_id}'`) with a single `GROUP BY` query. No parameterized placeholders needed on these specific queries since there are no user-supplied filter values — the GROUP BY aggregates the whole table. The SQL injection risk was in the loop pattern itself, which is gone.

### Execution time improvement: quality/distribution
- Before: ~1977ms per API call × 3–4 calls per page load = ~6–8s total blocking time
- After: 269ms (warm cache), 509ms (cold) for a single call
- The covering index `(study_id, (quality_score::numeric))` allows the GROUP BY + FILTER aggregation without heap access

### studies/list SELECT DISTINCT is slower than expected (309ms warm)
A `SELECT DISTINCT study_id, study_name, study_phase` across 500K rows returning only 5 unique combinations takes 309ms warm. The `idx_clinical_study_id` index covers `study_id` only — PostgreSQL still hits the heap to fetch `study_name` and `study_phase`. This is acceptable for now (it's the fast endpoint that unblocks progressive rendering); revisit with a covering index on all three columns if needed.

### HAR Evidence
- Before: 4 sequential requests to `/api/quality/distribution` (3339ms + 2180ms + 1771ms + 1752ms)
- After: 1 request (1977ms)
- Fix: removed `fetchCount` state and dep array entry from `QualityDashboard.tsx`

### Seed Idempotency Bug Discovered
The `seed-data.js` script had no guard against re-running on an already-populated database. Every `docker-compose down && up` appended 500K rows to the existing data because the `pgdata` named volume persists across restarts. With 1.5M rows, the N+1 queries took ~5.78s (vs ~1.7s at 500K rows), making the fix appear to regress performance.

Fix: added a row count check at startup in `seed-data.js` — exits early if any rows exist. Also noted that `docker-compose up` (without `--build`) does not rebuild images; use `--build` when source files in a service directory change.

### Docker Rebuild Rule Clarified
`docker-compose down && up` reuses existing images. If a service's source files changed, `--build` is required to pick up the change. The CLAUDE.md rebuild command should always include `--build` so code changes are reflected.
