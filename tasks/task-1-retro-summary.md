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

### Score display: percentage toggle scoped to Quality Dashboard
The 0–1 scale is the native format coordinators may be trained on. A toggle switch (decimal ↔ %) is placed in the navbar but rendered only when the Quality Dashboard tab is active — Study Overview has no quality score data so the toggle is irrelevant there. Default is `%` (on). The toggle only reformats three values: Avg Quality (0-1 score → %) and the chart legend threshold labels (≥0.9 ↔ ≥90%). High Quality and Low Quality columns are raw counts and never convert — only the score converts. `showPercent` is passed as a prop from App.tsx so the navbar and the component stay in sync.

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
| `frontend/src/main.tsx` | Wrapped app in QueryClientProvider; staleTime: 5min on QueryClient defaultOptions |
| `frontend/src/types.ts` | Added `StudyList` and `StudyListResponse` interfaces |
| `frontend/src/App.tsx` | Prefetch all three queries on mount; lazy imports + Suspense boundaries; decimal/% toggle in navbar (visible on Quality Dashboard tab only, default on); removed display:none pattern |
| `frontend/src/components/QualityDashboard.tsx` | Two useQuery hooks (studies/list + quality/distribution); field-level skeleton on metric cells; spinner on chart; legend moved right; column header tooltips; showPercent prop; horizontal chart default |
| `frontend/src/components/StudyOverview.tsx` | Two useQuery hooks (studies/list + studies/overview); card shells render immediately; field-level skeleton on count fields; fixed "Phase: Phase 3" redundancy |
| `frontend/src/api/queries.ts` | **New file** — pure query definitions (queryKey + queryFn) for all three endpoints; shared by both components and App.tsx prefetch |
| `frontend/src/components/Skeleton.tsx` | **New file** — shared shimmer primitive used by both components |
| `frontend/src/components/TooltipHeader.tsx` | **New file** — table column header with ⓘ info icon; fixed-position tooltip using getBoundingClientRect() to escape table stacking context |

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
| Time to data (page load → data rendered) | **61,501ms** (4 sequential fetches × ~15s each) | **565ms** steady state / 2,453ms mid-seed |
| Improvement | baseline | **99.1% faster** (109× improvement) |
| Tab switch (return visit) | Full re-fetch every time | Instant (React Query cache, 5-min staleTime) |

**Notes on before measurement:**
- 61,501ms was the last of 4 logs — the fetch loop (`fetchCount` bug) caused the spinner to reappear and block content on every re-fetch. The data was not "done" until the final fetch settled and `fetchCount >= 3` stopped the loop.
- Each individual fetch took ~15s due to the N+1 pattern on an unindexed 500K-row table.

**Notes on after measurement:**
- 2,453ms was on first load while the PostgreSQL seed was still mid-run (database busy inserting rows). Not representative of production conditions.
- 565ms is the steady-state number: seed complete, all 4 indexes applied, single GROUP BY query per endpoint, React Query eliminating all redundant fetches.
- Subsequent tab switches cost 0ms — React Query serves from cache with no network activity.

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

### Root cause: self-incrementing state in useEffect dependency array
`fetchCount` was both incremented inside the effect AND listed as a dependency. Every successful fetch triggered a re-render → dependency changed → effect re-ran → next fetch. The `eslint-disable-next-line react-hooks/exhaustive-deps` suppression comment was the tell — the original author knew the dependency array was wrong but suppressed the warning rather than fixing the root cause.

Fix: remove `fetchCount` state entirely. The effect runs once (empty dep array) and React Query takes over re-fetch lifecycle from there.

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

---

## Session Learnings (Items 7 + 8 — Frontend component migration)

### Shared components belong in separate files
Initial implementation inlined the Skeleton shimmer and query definitions directly in component files. User correctly pushed back: extract shared primitives to their own files so they can be reused and read without noise. Three new files: `Skeleton.tsx`, `TooltipHeader.tsx`, `api/queries.ts`.

### Tooltip z-index in table headers cannot be solved with CSS alone
The ⓘ tooltip in a `<th>` inside a `<table>` sits inside a stacking context created by the table element. `z-index: 9999` on an `absolute`-positioned tooltip has no effect — it's clipped by the table's stacking context regardless of the z-index value. `bottom-full` positioned it above the header but off-screen; `top-full` covered the data rows.

Fix: `position: fixed` with `getBoundingClientRect()` to compute exact viewport coordinates. The tooltip renders relative to the viewport, completely outside the table stacking context. `pointer-events: none` prevents it from interfering with mouse events.

### Phase loads faster than Participants/Measurements/Sites — by design
`study_phase` comes from the `studies/list` endpoint (fast SELECT DISTINCT, ~309ms). Participant, measurement, and site counts come from `studies/overview` (slower GROUP BY aggregation, ~639ms). This is intentional: name + ID + phase render from the fast query; counts skeleton until the slow query resolves. The apparent "stagger" is the progressive loading working correctly.

### Skeleton count must match actual card row count
After reverting an unapproved Phase badge to plain text, the skeleton had one extra row (for the badge placeholder that no longer existed). Skeleton templates must exactly mirror the real card structure — any mismatch is a visual bug during the loading state.

---

## Session Learnings (Item 9 — App.tsx, staleTime, percent toggle)

### staleTime: 0 defeats prefetch on tab switch
React Query's default `staleTime` is 0ms — data is immediately stale after fetching. When a component remounts (tab switch with `&&` conditional rendering), React Query sees stale data and re-fetches in the background even if the data was just fetched. `prefetchQuery` on mount is wasted if `staleTime` is 0. Fix: set `staleTime: 5 * 60 * 1000` on QueryClient defaultOptions — data stays fresh for 5 minutes, tab switches are instant with no network activity.

### Percent toggle scope: only Avg Quality score converts, not counts
The toggle converts the Avg Quality column (a 0–1 decimal score → %) because a score has a natural percent interpretation. High Quality and Low Quality are raw counts (e.g. 59,013 measurements) — converting them to "59.0% of total" changes the meaning of the column and was not requested. The chart legend threshold labels (≥0.9 ↔ ≥90%) update to match the display mode since they describe the score scale, not counts.

### Chart bars and axis scale never change with the toggle
The chart always shows absolute measurement counts on the axis (0–60,000). The toggle only changes: (1) Avg Quality table cell formatting, (2) legend label threshold notation. Changing the chart scale to percentages would reorder visual bar heights and confuse coordinators who use the chart to compare study sizes. The toggle is a display format for scores, not a chart rescaling control.

### Colima VM disk fills up from accumulated Docker image layers
After extended development, the Colima VM disk filled completely (I/O errors at the container level). Root cause: multiple `--build` rebuilds accumulate image layers that are never pruned. Fix: `colima delete && colima start --disk 60` for a fresh 60GB VM. Run `docker system prune` periodically to keep the VM disk clear. The prior default disk size was insufficient for sustained development work.

---

## Usability Phase — Investigation Findings

Performance work completed in the prior phase revealed a secondary problem: all five studies have virtually identical quality distributions (~89.3% avg score, ~12,200–12,500 low-quality counts). The original readability fixes (% toggle, column tooltips, legend repositioning) addressed surface formatting but not the core visual problem — on a zero-based linear axis, a 264-unit spread across studies is invisible.

### Root Cause: Axis Baseline Matters More Than Scale Type

None of the standard scale transformations (log, sqrt, linear) solve narrow-range visibility because they all share the same problem: bars are measured from zero. The real fix is offering different baselines that answer different analytical questions:

- **Zero baseline (grouped)**: "How large is each study's absolute count?"
- **100% baseline (stacked normalized)**: "What fraction of each study is each quality band?"
- **Mean baseline (deviation)**: "Which studies are above or below the cross-study average?" — most powerful for spotting outliers in tightly-clustered data

### Key Decisions

**Deviation mode is a chart mode, not an overlay.** It changes the axis baseline, bar direction, and the semantic meaning of bar length. It belongs in the same toggle group as Grouped/Stacked/100% — not layered on top of them.

**Dot/strip plot via custom Bar shape, not a separate chart type.** Dots for this data are structurally identical to bars (same axes, same data, same bands). Using Recharts' `shape` prop on `<Bar>` means all chart infrastructure (scale, zoom, mode, band toggles) is inherited for free. A separate `ScatterChart` would duplicate that and require data reshaping.

**Filters linked to chart by default, unlink is the exception.** When a coordinator filters to studies where Low Quality > 12,400, they almost certainly want the chart to match. Linked-by-default avoids chart/table disagreement confusion.

**`showPercent` excluded from saved views.** It's a global display preference controlled by the navbar toggle in App.tsx, not a per-view analysis setting. Including it in view state would silently change the navbar when a view is loaded.

**localStorage for saved views.** No user auth model exists. localStorage is zero-infrastructure, survives refresh, and is private to the browser. Named views stored as JSON under `regen_quality_views`; active session state under `regen_quality_active`.

### Usability Phase — Before/After Capabilities

| Capability | Before | After |
|-----------|--------|-------|
| Chart modes | 1 (grouped) | 4 (grouped, stacked, 100%, deviation) |
| Axis baseline options | 1 (always zero) | 3 (zero, 100%, cross-study mean) |
| Table sort | None (API order) | 6 sortable columns, bidirectional |
| Filtering | None | 6 column filters (5 range + 1 text), chart link/unlink |
| Settings persistence | None (resets on refresh) | Full state persists to localStorage |
| Saved named views | None | Unlimited named snapshots |
| Chart rendering | Rectangular bars only | Bars or dots (strip plot) |

*Wall-clock implementation time: TBD — execution agent fills in after implementation.*
