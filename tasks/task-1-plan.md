# Task-1 Plan: Quality Dashboard Performance & Usability

## Context

The Quality Dashboard loads slowly because of two compounding bugs: a frontend fetch loop in `QualityDashboard` (only) that calls the API 3–4× per mount, and a backend N+1 that fires sequential full-table scans per API call on a 500K-row unindexed table. Together these make the dashboard feel frozen. Separately, quality scores are hard to read and the chart layout has visual conflicts.

Full investigation findings and root cause analysis: see `tasks/task-1-retro-summary.md`.

---

## Problems to Fix (ordered by impact)

| # | Problem | File | Category |
|---|---------|------|----------|
| 1 | `fetchCount` state in `useEffect` dep array → 3–4 fetches per mount | `QualityDashboard.tsx` only | Bug |
| 2 | `1 + (N × 4)` sequential full-table scans per request (N = distinct studies) | `quality.routes.ts` | Performance |
| 3 | `1 + (N × 3)` sequential full-table scans per request (N = distinct studies) | `studies.routes.ts` | Performance |
| 4 | No index on `study_id` → every query is a 500K-row sequential scan | `database/bootstrap.sql` | Performance |
| 5 | `quality_score` stored as TEXT → runtime CAST on every row, every query | `database/bootstrap.sql` | Performance |
| 6 | `QualityDashboard` unmounts/remounts on every tab switch, re-fetching each time | `App.tsx` | Performance |
| 7 | `StudyOverview` always mounted, fetches immediately even when on other tab | `App.tsx` | Performance |
| 8 | No data caching — cold fetch on every component mount for both components | Both components | Performance |
| 9 | SQL injection via string interpolation in WHERE clauses | Both route files | Security |
| 10 | Avg quality scores displayed to 4 decimal places — hard to read at a glance | `QualityDashboard.tsx` | Readability |
| 11 | Chart legend at bottom overlaps rotated x-axis study name labels | `QualityDashboard.tsx` | UX |
| 12 | Column headers in Study Details have no explanatory context | `QualityDashboard.tsx` | UX |
| 13 | Navbar scrolls away | `App.tsx` | UX |

**Note:** `StudyOverview` does NOT have the fetch-loop bug (#1). Its `useEffect` is clean with an empty dependency array. It only has the re-mount caching problem (#7, #8), which React Query resolves.

---

## Approach

### Database: migration file + bootstrap update

Create `database/migrations/001_add_indexes.sql` with idempotent index creation (`IF NOT EXISTS`). Add a `study_id` index — this converts per-study WHERE clause scans from full-table to indexed. Also add a functional index on `CAST(quality_score AS DECIMAL)` as a hedge for future ad-hoc filter queries; note this functional index is not expected to accelerate the proposed GROUP BY query (which touches all rows regardless), but costs nothing to add and benefits any future query that filters quality score directly with a WHERE clause.

Apply to the running container via `docker exec` psql. Also add the same index definitions to `bootstrap.sql` so future container rebuilds include them. Include a `npm install` step in the verification checklist since the Docker container must install the new package.

### Backend: collapse N+1 into single GROUP BY queries

Replace the sequential `for` loop pattern in both route files with a single SQL `GROUP BY` query using `COUNT(*) FILTER (WHERE ...)` aggregates. This reduces quality distribution from `1 + (N × 4)` queries to 1, and study overview from `1 + (N × 3)` queries to 1.

String interpolation is eliminated entirely by the GROUP BY rewrite — the new queries have no per-study parameters. For any future routes that accept user-supplied filter parameters, parameterized queries (`$1`, `$2` placeholders) must be used — not string interpolation.

### Frontend: React Query for server state management

Add `@tanstack/react-query` to `frontend/package.json`. Wrap the app in a `QueryClientProvider` in `frontend/src/main.tsx`. Replace the manual `useEffect`/`fetch`/`useState` pattern in both dashboard components with `useQuery` hooks.

React Query handles: deduplication of in-flight requests, configurable cache time (tab switches return cached data instantly with no re-fetch), background revalidation, and standardized `isLoading`/`isError`/`data` states. This directly fixes the fetch loop bug (React Query owns the fetch lifecycle, no manual dependency arrays) and the re-mount re-fetch problem (cached data survives unmount).

### Frontend: rendering strategy — conditional mounting, React Query caching

Remove the `display:none` pattern for `StudyOverview` entirely. Switch both components to conditional `&&` rendering in `App.tsx`. With React Query caching data between mounts, tab switches re-mount the component but React Query serves cached data instantly — no re-fetch, no blank state. The user sees content immediately on every tab visit after the first.

Use `React.lazy()` for both component imports and wrap each in a `<Suspense>` boundary with a skeleton fallback. Each page's code bundle loads only when first navigated to. Data fetching begins as soon as the component mounts — skeleton renders immediately, content appears as data arrives. This is the correct approach for LCP: the browser paints content progressively.

New `App.tsx` rendering pattern (both components conditional, both lazy):
- `{currentPage === 'overview' && <Suspense fallback={<Skeleton />}><StudyOverview /></Suspense>}`
- `{currentPage === 'quality' && <Suspense fallback={<Skeleton />}><QualityDashboard /></Suspense>}`

### Frontend: sticky navbar

Add `sticky top-0 z-10` to the `<nav>` element in `App.tsx`. No JavaScript needed.

### Frontend: score display toggle

Add a decimal/percentage toggle to the navbar. The toggle applies only to the **table's avg quality column** — the chart does not display avg quality score (the `avgQuality` field in `chartData` is computed but unused in the chart). Decimal mode preserves the existing `.toFixed(4)` format (`0.9231`). Percentage mode multiplies the same value by 100 (`92.31%`) — no new rounding or truncation added; the existing `.toFixed(4)` cap governs precision in both modes. Toggle defaults to decimal on first load.

Toggle state lives in `App.tsx` as a boolean prop passed down to `QualityDashboard`. No context needed — the only consumer is `QualityDashboard` and prop-passing avoids adding new infrastructure.

### Frontend: chart legend to the right

Move the Recharts `<Legend>` from default bottom to right side with a vertical layout. Add right margin to `BarChart` to give the legend room. Eliminates the overlap with the 45°-rotated x-axis study name labels.

### Frontend: column header hover descriptions

Add `title` attributes and `cursor-help` class to each `<th>` in the Study Details table. Include definition + threshold context:

| Column | Description |
|--------|-------------|
| Study | The clinical study name and ID |
| Total Measurements | Total number of data measurements recorded across all participants and sites in this study |
| Avg Quality | Mean quality score across all measurements. Scale: 0–1 (or % with toggle). ≥0.9 = High, 0.8–0.89 = Medium, <0.8 = Low |
| High Quality | Count of measurements scoring ≥0.9 — meets the threshold for primary analysis |
| Low Quality | Count of measurements scoring <0.8 — may require review or exclusion. Gap between High and Low is the medium-quality band |

---

## Files to Modify

| File | What changes |
|------|-------------|
| `database/bootstrap.sql` | Add index definitions |
| `database/migrations/001_add_indexes.sql` | New file — idempotent index migration for running container |
| `api/src/routes/quality.routes.ts` | Single GROUP BY query, remove N+1 loop |
| `api/src/routes/studies.routes.ts` | Single GROUP BY query, remove N+1 loop |
| `frontend/package.json` | Add `@tanstack/react-query` |
| `frontend/src/main.tsx` | Wrap app in `QueryClientProvider` |
| `frontend/src/App.tsx` | Sticky nav, lazy imports, Suspense wrappers, remove display:none, score toggle boolean state + prop |
| `frontend/src/components/QualityDashboard.tsx` | React Query hook, skeleton loader, legend right, column tooltips, score toggle prop |
| `frontend/src/components/StudyOverview.tsx` | React Query hook, skeleton loader |

---

## Verification

1. Load `http://localhost:5173` — dashboard renders skeleton immediately, data appears within 1–2 seconds
2. DevTools → Network tab — confirm exactly 1 request to `/api/quality/distribution` on load (was 3–4)
3. Check API response `executionTime` — document before/after in `task-1-retro-summary.md`
4. Navigate to Study Overview — confirm 1 request to `/api/studies/overview`, skeleton shows immediately
5. Switch tabs several times — confirm zero additional network requests on return visits; confirm data appears instantly (cached)
6. Measure LCP in DevTools Lighthouse or Performance tab — document before/after in `task-1-retro-summary.md`
7. Toggle decimal/percentage in navbar — table avg quality column switches format, no data re-fetch fires
8. Chart legend visible on the right, no overlap with x-axis labels
9. Hover each column header — tooltip appears with description and threshold context
10. Scroll down — navbar stays pinned to top
11. Run `docker exec <postgres-container> psql -U postgres clinical_data -c "\d clinical_data_raw"` — confirm both indexes exist
12. Confirm `npm install` ran inside the frontend container and `@tanstack/react-query` is in `node_modules`
