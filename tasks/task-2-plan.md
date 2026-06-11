# Task-2 Plan: Participant Summary Report

## Problems to Solve

1. **No participant cohort view exists.** Research coordinators have no way to see demographic and enrollment composition (age, gender, site, date range) aggregated by study.
2. **No shareable study-specific URLs.** There is no routing in the app — all navigation is button-based state, making it impossible to share a filtered view with a colleague.
3. **App.tsx is doing too much.** It owns the navbar, tab state, `showPercent` toggle logic, and all prefetch calls in one component. No React Router means no URL sync.
4. **`/components` mixes page-level views with shared primitives.** `StudyOverview` and `QualityDashboard` are views, not components. The folder name misleads the execution agent and future developers.

---

## Approach and Reasoning

### Routing

Add `react-router-dom` v6 — pin to `"^6.28.0"` in `frontend/package.json`. Do NOT add `@types/react-router-dom`; v6 bundles its own TypeScript types. App.tsx becomes a thin shell that renders `<BrowserRouter>`, `<Navbar>`, and `<Routes>`. Three routes:
- `/` redirects to `/overview`
- `/overview` → StudyOverview view
- `/quality` → QualityDashboard view
- `/participants` → ParticipantSummary view

The Participant Summary page uses React Router's `useSearchParams` to read and write URL query params (`?study=CARDIO001` and `?site=SITE_NY01`). Filter state lives in the URL, not in component state. This means any URL is shareable and restores the exact filtered view on load.

### Folder Refactor

Move page-level components to `/views`. Keep shared primitives in `/components`.

```
frontend/src/
  views/
    StudyOverview.tsx         ← moved from /components
    QualityDashboard.tsx      ← moved from /components
    ParticipantSummary.tsx    ← new
  components/
    Navbar.tsx                ← new, extracted from App.tsx
    Skeleton.tsx              ← stays
    TooltipHeader.tsx         ← stays
  utils/
    dashboard.ts              ← stays
    participants.ts           ← new (sort/filter/format helpers for participant table)
  api/
    queries.ts                ← add participantSummaryQuery
  types.ts                    ← add participant summary types
  App.tsx                     ← thin router shell
```

**Import path updates required when moving views:**
- `QualityDashboard.tsx` currently imports `'./Skeleton'` and `'./TooltipHeader'` — after moving to `/views`, these become `'../components/Skeleton'` and `'../components/TooltipHeader'`.
- `StudyOverview.tsx` currently imports `'./Skeleton'` — becomes `'../components/Skeleton'`.
- Both currently import `'../api/queries'` — depth is the same, no change needed.

### showPercent toggle

`showPercent` state and its toggle button currently live in App.tsx and are conditionally rendered in the navbar when on the quality tab. After extracting Navbar.tsx as a navigation-only component, this coupling is eliminated:
- `showPercent` state and the toggle button move entirely into `QualityDashboard.tsx` as local `useState`.
- The toggle renders inside QualityDashboard's own controls section (above the table), not in the navbar.
- `Navbar.tsx` is navigation-only: active-tab highlighting via `useLocation()`, no view-specific props.
- `App.tsx` no longer holds `showPercent` state.

**Critical: `QualityDashboard` internal wiring that references the old prop must be updated:**
- The `Props` interface (`showPercent: boolean; onShowPercentChange: (v: boolean) => void`) is removed entirely.
- `onShowPercentChange(state.showPercent)` inside `applyViewState` becomes `setShowPercent(state.showPercent)` — the local state setter.
- `getCurrentState()` keeps `showPercent: showPercent` — it still reads the local state value.
- The `ViewState` type in `utils/dashboard.ts` keeps `showPercent` as a field — it is still serialized to localStorage in saved views and the active session key.
- No other changes to the persistence or saved-view logic.

This is cleaner architecture. The toggle belongs to the view that uses it.

### Participant Summary Page Layout

**KPI cards (top section):** Four aggregate cards computed across all currently-filtered data:
- Total Participants
- Overall Date Range (earliest to latest measurement date)
- Average Age
- Gender Split (% Male / % Female)

When a study filter is active, KPI cards reflect that study only. When unfiltered, they reflect all studies combined.

**Table (main section):** One row per study (or one row when filtered to a single study). Columns:
- Study Name + ID (left-aligned, not sortable separately — sort on study name)
- Phase
- Participants (count)
- Avg Age
- Age Range (min–max, formatted as "25–74")
- Male (count)
- Female (count)
- Sites (count — sortable; the number here is the headline for the "both" site distribution)
- Avg Measurements / Participant
- Date Range (earliest–latest, formatted as "Jan 2022 – Dec 2024")

All columns sortable. Default sort: `study_id` ascending, consistent with Study Overview and Quality Dashboard.

**Accordion rows (site distribution detail):** Each table row has an expand toggle. When expanded, a sub-row renders a nested table showing each site's name and participant count for that study, ordered by participant count descending. The site data comes from the API response (included as a nested array — no separate request on expand).

**Accordion state implementation:** A `Set<string>` of currently-expanded `study_id` values, held in `useState`. Initial value is derived from the URL: if `?study=CARDIO001` is present on load, initialize the Set with `'CARDIO001'` so that study's accordion is auto-expanded. When the `?study=` param is cleared by the user, the expanded Set is NOT automatically collapsed — the user explicitly opened it; let it stay open unless they close it manually.

**Filter panel:** A "Filters" button above the table reveals a filter row (same pattern as Quality Dashboard). Filters: study name text search, min/max participant count, min/max avg age. Filters apply to the table rows client-side (same as Quality Dashboard). URL query params (`?study=` and `?site=`) are separate from the filter panel — they are applied server-side at the API layer.

**URL query params behavior:**
- `?study=CARDIO001` — API request is filtered to that study. Table shows one row. KPI cards reflect that study. Site distribution accordion auto-expands.
- `?site=SITE_NY01` — API request additionally filtered to participants at that site.
- `?study=CARDIO001&site=SITE_NY01` — both filters applied.
- Removing a filter (clearing the study dropdown) updates the URL and triggers a new API request for the unfiltered data (served from React Query cache if previously fetched).
- A study/site selector UI (dropdowns above the table) controls these URL params. Selecting a study updates `?study=`, selecting a site updates `?site=`.

### Progressive Loading Strategy

App.tsx prefetches `participantSummaryQuery({})` on mount alongside the existing three prefetches, so navigating to the Participant Summary tab after visiting another tab renders instantly from cache.

**Initial implementation:** `ParticipantSummary.tsx` uses only `participantSummaryQuery` — the table shows full skeleton rows while that single query is pending. No progressive column split yet.

**Post-measurement decision rule (execution agent must apply this after verifying):** After the container is rebuilt and the endpoint is live, measure the cold `executionTime` from the API response for `GET /api/participants/summary`.
- **Under 500ms** — keep the full-table skeleton as-is. No further changes needed.
- **500ms or over** — retrofit the progressive pattern from task-1: add `studiesListQuery` to `ParticipantSummary.tsx`, render table structure (study name, ID, phase) immediately from the cached fast query, and skeleton the metric columns until `participantSummaryQuery` resolves. This mirrors how `StudyOverview` and `QualityDashboard` handle their two-speed queries.

When the page loads with a URL filter (`?study=CARDIO001`):
1. Fetch `participantSummaryQuery({ studyId: 'CARDIO001' })` immediately — filtered query is cheaper.
2. In background, prefetch `participantSummaryQuery({})` (all studies).
3. When user clears the filter, the unfiltered data is already cached — instant render.

### React Query Parameterization

The participant summary query is parameterized by the active filters. Each unique filter combination is a separate cache entry:

```
queryKey: ['participants', 'summary', { studyId, siteId }]
```

- `['participants', 'summary', {}]` — all studies
- `['participants', 'summary', { studyId: 'CARDIO001' }]` — filtered to one study
- `['participants', 'summary', { studyId: 'CARDIO001', siteId: 'SITE_NY01' }]` — filtered further

Each is independently cached. Navigating back to a previously-visited filter state is instant.

The query function accepts `{ studyId?: string, siteId?: string }` and appends them as URL params to the API call: `/api/participants/summary?study=CARDIO001&site=SITE_NY01`.

---

## API

### New endpoint: `GET /api/participants/summary`

Accepts optional query params: `?study=` (study_id) and `?site=` (site_id).

**Response shape per study:**
```
{
  study_id, study_name, study_phase,
  participant_count,
  avg_age, min_age, max_age,
  male_count, female_count,
  site_count,
  sites: [{ site_id, site_name, participant_count }],   ← ordered by count desc
  avg_measurements_per_participant,
  earliest_measurement,   ← ISO date string
  latest_measurement      ← ISO date string
}
```

**Query intent (multi-CTE, no code in plan):**

The query uses four CTEs joined at the end:

1. **`participant_data`** — deduplicates to one row per participant using GROUP BY `(study_id, participant_id)` with MAX() on the stable per-participant fields (dob, gender, site_id, site_name). Applies `WHERE study_id = $1` and/or `WHERE site_id = $2` if filter params are present.

2. **`participant_stats`** — aggregates from `participant_data` per study: COUNT(*) as participant_count, AVG/MIN/MAX of `AGE(CURRENT_DATE, dob::date)` extracted to years for age stats, COUNT CASE WHEN for male/female counts, COUNT DISTINCT site_id for site_count.

3. **`site_distribution`** — aggregates from `participant_data` per `(study_id, site_id, site_name)` to get participant count per site, then `json_agg` ordered by count desc to produce the nested sites array per study.

4. **`measurement_stats`** — queries the raw table (all measurement rows, not deduped) per study: MIN and MAX of `measurement_timestamp::timestamp` for date range, COUNT(*) for total measurements.

Final SELECT joins all four CTEs on `study_id`, computes `avg_measurements_per_participant` as `total_measurements::numeric / participant_count` (explicit cast to numeric before dividing — PostgreSQL integer division truncates, which would silently produce wrong values), orders by `study_id` ascending.

**New file:** `api/src/routes/participants.routes.ts`
Register it in `api/src/routes/index.ts` as `router.use('/participants', participantsRoutes)`.

**New transform function:** `parseParticipantSummaryRow` in `api/src/utils/transform.ts` — same pattern as `parseOverviewRow`. Casts string fields from pg: participant_count, avg/min/max age, male/female counts, site_count, avg_measurements. Parses `sites` from the JSON string pg returns for json_agg. Passes date strings through as-is.

---

## Database

### New indexes (add to `bootstrap.sql`)

**Index 1 — Covering index for participant deduplication CTE:**
```
idx_participant_summary
on clinical_data_raw (study_id, participant_id)
INCLUDE (participant_dob, participant_gender, site_id, site_name)
```
**Keep the existing `idx_clinical_study_participant` index — do not drop it.** The new covering index supplements it by adding INCLUDE columns that enable index-only scans for the participant deduplication CTE (dob, gender, site_id, site_name without heap fetches). The existing index may still be preferred by the planner for other queries (e.g., `COUNT(DISTINCT participant_id)` in `studies/overview`). PostgreSQL 15 supports INCLUDE syntax.

**Index 2 — Expression index for measurement date range:**
```
idx_clinical_measurement_timestamp
on clinical_data_raw (study_id, (measurement_timestamp::timestamp))
```
Powers `MIN`/`MAX(measurement_timestamp::timestamp)` GROUP BY study in the `measurement_stats` CTE. Without this, the date range computation is a full sequential scan. `measurement_timestamp` is TEXT — the expression cast matches the query expression exactly so PostgreSQL uses it.

Both use `IF NOT EXISTS`. Both go in `bootstrap.sql` with the existing four indexes. Schema change requires `-v` rebuild:
```bash
DOCKER_HOST="unix://$HOME/.colima/default/docker.sock" docker-compose down -v && DOCKER_HOST="unix://$HOME/.colima/default/docker.sock" docker-compose up -d --build
```

---

## Files Changed

| File | Change |
|------|--------|
| `database/bootstrap.sql` | Add 2 new indexes |
| `api/src/routes/participants.routes.ts` | **New** — participant summary endpoint |
| `api/src/routes/index.ts` | Register `/participants` router |
| `api/src/utils/transform.ts` | Add `parseParticipantSummaryRow` |
| `api/src/utils/transform.test.ts` | Add tests for new transform function |
| `frontend/package.json` | Add `react-router-dom` |
| `frontend/src/App.tsx` | Rewrite as thin router shell — BrowserRouter, Routes, prefetch participant summary |
| `frontend/src/components/Navbar.tsx` | **New** — navigation-only, active tab via useLocation(), no view-specific props |
| `frontend/src/views/StudyOverview.tsx` | **Moved** from `/components` — update relative import paths for Skeleton |
| `frontend/src/views/QualityDashboard.tsx` | **Moved** from `/components` — update import paths; absorb `showPercent` state and toggle from App.tsx |
| `frontend/src/views/ParticipantSummary.tsx` | **New** — KPI cards, sortable/filterable table, accordion site breakdown, URL param filters |
| `frontend/src/utils/participants.ts` | **New** — pure sort/filter/format helpers for participant summary table (extracted for testability) |
| `frontend/src/api/queries.ts` | Add `participantSummaryQuery(filters)` with parameterized query key |
| `frontend/src/types.ts` | Add `ParticipantSummary`, `ParticipantSummaryResponse`, `SiteDistribution` interfaces |
| `frontend/src/utils/dashboard.test.ts` | No changes needed |
| `frontend/src/api/queries.test.ts` | Add tests for parameterized `participantSummaryQuery` |
| `frontend/src/utils/participants.test.ts` | **New** — tests for sort/filter/format helpers |

---

## Verification Checklist

### Code quality
- [ ] `npm test` passes in `frontend/` (no failures)
- [ ] `npm test` passes in `api/` (no failures)
- [ ] TypeScript compiles clean in both `frontend/` and `api/` (`tsc --noEmit`)
- [ ] No lint errors

### Container
- [ ] Schema change: run with `-v` to drop pgdata volume so new indexes apply
- [ ] Measure cold `executionTime` from `GET /api/participants/summary` response — if ≥500ms, implement progressive split (studiesListQuery + skeleton metric columns); if <500ms, leave full-table skeleton as-is. Record the measured value in `task-2-retro-summary.md`.
- [ ] Vite reports "ready" after rebuild
- [ ] All three existing API endpoints still respond (regression check)
- [ ] New endpoint responds: `curl http://localhost:3000/api/participants/summary`
- [ ] Filtered endpoint responds: `curl "http://localhost:3000/api/participants/summary?study=CARDIO001"`

### Features
- [ ] "Participant Summary" tab appears in navbar
- [ ] `/participants` renders with KPI cards and table
- [ ] KPI cards show correct aggregate values (Total Participants ≈ 5,000, sensible age/gender/date values)
- [ ] Table shows 5 rows (one per study) by default, ordered by study_id
- [ ] All table columns are sortable; clicking a column header sorts; clicking again reverses
- [ ] Filters panel opens/closes; text filter narrows table rows client-side
- [ ] Selecting a study from the study dropdown updates URL to `?study=CARDIO001`
- [ ] Navigating directly to `?study=CARDIO001` renders pre-filtered (one study row, site accordion auto-expanded)
- [ ] Selecting a site additionally updates URL to `?study=CARDIO001&site=SITE_NY01`
- [ ] Clearing study filter restores all 5 studies (instant, from React Query cache)
- [ ] Accordion expand shows per-site participant breakdown for that study
- [ ] KPI cards update to reflect the filtered data when a study is selected
- [ ] Study Overview and Quality Dashboard still work after refactor (regression)
- [ ] `showPercent` toggle still appears and works in Quality Dashboard (now inside the view, not the navbar)
- [ ] React Router navigation (forward/back browser buttons) works correctly
- [ ] Skeleton loading is visible during initial data fetch (verify by throttling network in DevTools)
