# Task-1 Plan: Quality Dashboard Performance & Usability

## Context

Two compounding bugs make the dashboard feel frozen: a frontend fetch loop in `QualityDashboard` (3–4 API calls per mount) and a backend N+1 that fires 21 sequential full-table scans per API call on a 500K-row unindexed table. Additionally, quality scores are hard to read and the chart has visual conflicts.

Full root cause analysis: `tasks/task-1-retro-summary.md`.

---

## Architecture Decisions (agreed before implementation)

### Split endpoint design

The original monolithic `/api/studies/overview` returned everything in one slow aggregation query, blocking all rendering until complete. We split into three endpoints:

| Endpoint | Query type | Speed | Returns |
|---|---|---|---|
| `GET /api/studies/list` | `SELECT DISTINCT` — no aggregation | Fast (~5ms) | study_id, study_name, study_phase |
| `GET /api/studies/overview` | `GROUP BY` aggregation | Slow | participant_count, total_measurements, site_count per study |
| `GET /api/quality/distribution` | `GROUP BY` aggregation | Slow | total_measurements, avg_quality_score, high_quality_count, low_quality_count per study |

`studies/list` is the shared base layer — feeds both tabs and is deduplicated by React Query's cache (one network request regardless of how many components consume it).

`total_measurements` appears in both slow endpoints. It is a trivial `COUNT(*)` during an already-running GROUP BY — the cost is negligible and keeping it in both avoids coupling the two components to each other's query results.

### React Query as shared cache

The `QueryClient` is the shared data store — no separate React context needed. Any component anywhere that calls `useQuery(['studies', 'list'])` gets the same cached result. App.tsx calls `queryClient.prefetchQuery()` for all three endpoints on mount, so all network requests fire immediately regardless of which tab is active. Tab switches show cached data instantly.

### Progressive field-level rendering

Components render what they can immediately, then fill in the rest as slow queries resolve:

- **StudyOverview cards:** shell (name, ID, phase) renders immediately from `studies/list`; Participants / Measurements / Sites fields show skeleton shimmer until `studies/overview` resolves.
- **QualityDashboard table:** study name column renders immediately from `studies/list`; quality metric cells show skeleton shimmer until `quality/distribution` resolves.
- **QualityDashboard chart:** cannot meaningfully render partial bars — shows a spinner/grey placeholder until `quality/distribution` resolves in full.

### Index strategy

Four indexes on `clinical_data_raw`, all `IF NOT EXISTS`, added to `bootstrap.sql` only (single source of truth, applied on every fresh container start — no migration file):

| Index | Columns | Benefit |
|---|---|---|
| `idx_clinical_study_id` | `(study_id)` | Powers all GROUP BY study_id aggregations |
| `idx_clinical_study_quality` | `(study_id, (quality_score::numeric))` | Covering index for quality/distribution — no heap access needed |
| `idx_clinical_study_participant` | `(study_id, participant_id)` | COUNT(DISTINCT participant_id) walks index in order |
| `idx_clinical_study_site` | `(study_id, site_id)` | COUNT(DISTINCT site_id) walks index in order |

Note: expression index syntax `(quality_score::numeric)` requires PostgreSQL 11+. We run PostgreSQL 15.

---

## Work Items

Each row is one unit of work. Follow the 7-step execution process in `CLAUDE.md` for each.

| # | Status | Task | Files | Depends On |
|---|--------|------|-------|------------|
| 1 | ✅ | Remove `fetchCount` from state and `useEffect` dep array — eliminates 3–4 fetch loop per mount | `QualityDashboard.tsx` | — |
| 2 | ✅ | Add `sticky top-0 z-10` to `<nav>` in `App.tsx` — no JS needed | `App.tsx` | — |
| 3 | ✅ | Add `@tanstack/react-query` to `package.json`; wrap app in `QueryClientProvider` in `main.tsx` | `frontend/package.json`, `frontend/src/main.tsx` | — |
| 4 | ✅ | Add the four indexes from the Architecture Decisions table to `bootstrap.sql`. Single source of truth — no migration file. Verification: rebuild containers, then `\d clinical_data_raw` to confirm all four indexes exist. | `database/bootstrap.sql` | — |
| 5 | ✅ | Rewrite `quality.routes.ts` `/distribution` route — single `GROUP BY study_id` query with `FILTER` aggregates replacing the N+1 loop. Fix SQL injection (use parameterized queries, not string interpolation). Returns: study_id, study_name, total_measurements, avg_quality_score, high_quality_count, low_quality_count. | `api/src/routes/quality.routes.ts` | 4 |
| 6 | ✅ | Rewrite `studies.routes.ts` — add new `GET /list` route (fast `SELECT DISTINCT` for study_id, study_name, study_phase — no aggregation); rewrite existing `GET /overview` as single `GROUP BY` query returning participant_count, total_measurements, site_count per study. Both routes use parameterized queries (no string interpolation). Add `StudyList` type to `frontend/src/types.ts`. | `api/src/routes/studies.routes.ts`, `frontend/src/types.ts` | 4 |
| 7 | ✅ | Migrate `QualityDashboard.tsx` to two `useQuery` hooks: `['studies', 'list']` for study name column (renders table row shells immediately) and `['quality', 'distribution']` for metrics (skeleton shimmer on metric cells until resolved; spinner/grey placeholder on chart until resolved). Move chart `<Legend>` to `layout="vertical"` on the right side. Add column header tooltips (see Note on item 7 below). Accept `showPercent` boolean prop from `App.tsx` for decimal/% toggle. | `frontend/src/components/QualityDashboard.tsx` | 3, 5, 6 |
| 8 | ✅ | Migrate `StudyOverview.tsx` to two `useQuery` hooks: `['studies', 'list']` (shared cache — no extra request fires) for card shells and `['studies', 'overview']` for count fields. Skeleton shimmer on Participants, Measurements, Sites values until overview query resolves. Display format for Phase stays as original: "Phase:" label with "Phase 3" value. | `frontend/src/components/StudyOverview.tsx` | 3, 6 |
| 9 | ✅ | Update `App.tsx` — on mount, prefetch all three queries (`['studies', 'list']`, `['studies', 'overview']`, `['quality', 'distribution']`) so all network requests fire immediately. Add lazy imports + Suspense boundaries for both components. Set `staleTime: 5 * 60 * 1000` on QueryClient defaultOptions so tab switches don't refetch. Decimal/% toggle lives as **local state inside `QualityDashboard`** (not the navbar — Study Overview has no percent data); default chart orientation is horizontal. Dynamic legend keys (`highKey`/`lowKey`) update with toggle so legend, tooltip, and axis ticks all reflect current format. | `frontend/src/App.tsx`, `frontend/src/main.tsx`, `frontend/src/components/QualityDashboard.tsx` | 7, 8 |

**Note on item 7 — column header tooltip content:**

| Column | Tooltip text |
|--------|-------------|
| Study | The clinical study name and ID |
| Total Measurements | Total number of data measurements recorded across all participants and sites in this study |
| Avg Quality | Mean quality score across all measurements. Scale: 0–1 (or % with toggle). ≥0.9 = High, 0.8–0.89 = Medium, <0.8 = Low |
| High Quality | Count of measurements scoring ≥0.9 — meets the threshold for primary analysis |
| Low Quality | Count of measurements scoring <0.8 — may require review or exclusion. Gap between High and Low is the medium-quality band |

---

## Verification Checklist (run after all items complete)

1. ✅ Network tab: exactly 1 request to `/api/quality/distribution` on load (was 3–4)
2. ✅ Scroll down — navbar stays pinned to top
3. ✅ On app load: network shows exactly 3 requests firing in parallel — `/api/studies/list`, `/api/studies/overview`, `/api/quality/distribution`
4. ✅ Switch tabs multiple times — zero additional network requests on any tab switch; data appears instantly from cache
5. ⬜ API `executionTime` for `/quality/distribution` — document before/after in retro
6. ⬜ API `executionTime` for `/studies/overview` — document before/after in retro
7. ⬜ API `executionTime` for `/studies/list` — document in retro (should be <20ms with index)
8. ⬜ **LCP before/after measurement** — compare first repo commit vs HEAD
9. ✅ Toggle decimal/% switch in navbar (Quality Dashboard page only, default on) — Avg Quality column converts 0–1 score to %; High/Low Quality counts stay as raw numbers; chart legend threshold labels update (≥0.9 ↔ ≥90%); no re-fetch fires
10. ✅ Chart legend visible on the right side, no overlap with x-axis labels
11. ✅ Hover each column header in QualityDashboard table — tooltip appears with correct text, updates with toggle
12. ✅ StudyOverview cards: "Phase" word appears only once per card (no "Phase: Phase 3")
13. ✅ Throttle network to Slow 3G in DevTools — StudyOverview card shells (name, ID) appear before Participants/Measurements/Sites fill in
14. ✅ Throttle network to Slow 3G — QualityDashboard table study names appear before quality metric cells fill in; chart shows spinner until data arrives
15. ✅ After container rebuild: `docker exec regeneron-postgres-1 psql -U postgres clinical_data -c "\d clinical_data_raw"` — all four indexes confirmed: idx_clinical_study_id, idx_clinical_study_participant, idx_clinical_study_quality, idx_clinical_study_site
16. ✅ Confirm `@tanstack/react-query` is in `node_modules` inside the frontend container
