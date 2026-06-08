# Task-1 Plan: Quality Dashboard Performance & Usability

## Context

Two compounding bugs make the dashboard feel frozen: a frontend fetch loop in `QualityDashboard` (3–4 API calls per mount) and a backend N+1 that fires 21 sequential full-table scans per API call on a 500K-row unindexed table. Additionally, quality scores are hard to read and the chart has visual conflicts.

Full root cause analysis: `tasks/task-1-retro-summary.md`.

---

## Work Items

Each row is one unit of work. Follow the 7-step execution process in `CLAUDE.md` for each.

| # | Status | Task | Files | Depends On |
|---|--------|------|-------|------------|
| 1 | ✅ | Remove `fetchCount` from state and `useEffect` dep array — eliminates 3–4 fetch loop per mount | `QualityDashboard.tsx` | — |
| 2 | ✅ | Add `sticky top-0 z-10` to `<nav>` in `App.tsx` — no JS needed | `App.tsx` | — |
| 3 | ⬜ | Add `@tanstack/react-query` to `package.json`; wrap app in `QueryClientProvider` in `main.tsx` | `frontend/package.json`, `main.tsx` | — |
| 4 | ⬜ | Create `database/migrations/001_add_indexes.sql` with idempotent `study_id` + quality_score indexes; mirror in `bootstrap.sql`; apply to running container via `docker exec regeneron-postgres-1 psql -U postgres clinical_data -f /path/to/001_add_indexes.sql` | `bootstrap.sql`, new `migrations/001_add_indexes.sql` | — |
| 5 | ⬜ | Rewrite `quality.routes.ts` — replace N+1 loop with single `GROUP BY` + `FILTER` query; eliminates SQL injection via string interpolation | `quality.routes.ts` | 4 |
| 6 | ⬜ | Rewrite `studies.routes.ts` — same GROUP BY treatment | `studies.routes.ts` | 4 |
| 7 | ⬜ | Migrate `QualityDashboard.tsx` to `useQuery`; move chart legend to right side; add column header tooltips; accept decimal/% toggle as prop from `App.tsx` | `QualityDashboard.tsx` | 3, 5 |
| 8 | ⬜ | Migrate `StudyOverview.tsx` to `useQuery`; add skeleton loader | `StudyOverview.tsx` | 3, 6 |
| 9 | ⬜ | Update `App.tsx` — lazy imports + Suspense boundaries for both components; add score toggle boolean state passed as prop to `QualityDashboard`; remove `display:none` pattern | `App.tsx` | 7, 8 |

**Note on item 6 — column header tooltip content:**

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
3. ⬜ Network tab: exactly 1 request to `/api/studies/overview` on load
4. ⬜ API `executionTime` for quality — document before/after in retro
5. ⬜ API `executionTime` for studies — document before/after in retro
6. ⬜ **LCP before/after measurement** (run only after all 9 work items are ✅):
   - Find the last commit before any task-1 changes: `git log --oneline` — it is the commit just before the first task-1 change
   - Add this snippet to `main.tsx` (do NOT commit it): `const _lcpObserver = new PerformanceObserver((list) => { const e = list.getEntries(); console.log('[LCP before]', e[e.length-1].startTime.toFixed(0) + 'ms'); }); _lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });`
   - `git stash` your main.tsx change, then `git checkout <pre-task1-commit> -- frontend/src/components/QualityDashboard.tsx frontend/src/App.tsx frontend/src/main.tsx` (restore pre-task files only, not DB or backend)
   - Apply the stash back: `git stash pop` — snippet is back in main.tsx
   - Rebuild containers and ask user to open DevTools console, refresh, and read `[LCP before]` value — record in retro
   - Restore post-task state: `git checkout HEAD -- frontend/src/components/QualityDashboard.tsx frontend/src/App.tsx frontend/src/main.tsx`
   - Change snippet label to `[LCP after]`, rebuild, ask user to read and record in retro
   - Remove the snippet from main.tsx entirely when done
7. ⬜ Switch tabs several times — zero additional network requests on return visits; data appears instantly (cached)
8. ⬜ Toggle decimal/% in navbar — table avg quality column switches format, no re-fetch fires
9. ⬜ Chart legend visible on the right, no overlap with x-axis labels
10. ⬜ Hover each column header — tooltip appears with definition and threshold context
11. ⬜ `docker exec regeneron-postgres-1 psql -U postgres clinical_data -c "\d clinical_data_raw"` — confirm both indexes exist
12. ⬜ Confirm `@tanstack/react-query` is in `node_modules` inside the frontend container
