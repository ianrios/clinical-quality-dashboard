# Architectural Code Review

**Reviewer perspective:** Principal engineer  
**Scope:** Full repo — schema, API, frontend, tests  
**Date:** 2026-06-10 (updated from original)  
**Status:** All actionable items resolved in "fix all" session.

---

## How to read this document

Findings are grouped by theme. Each item states the problem, where it lives, and what it costs you.

- **[CRITICAL]** — correctness bug or security issue that affects behavior in production
- **[HIGH]** — architectural debt that will cause pain at the next task boundary
- **[MEDIUM]** — code smell that will cause confusion or a subtle bug under the right conditions
- **[LOW]** — polish, consistency, or testability improvement
- **~~[RESOLVED]~~** — fixed since initial review; kept for history

---

## 1. Schema — The Root Cause of Structural Debt

### ~~[HIGH] Every column in `clinical_data_raw` is `TEXT`~~ — RESOLVED

`database/bootstrap.sql` stores `participant_dob`, `measurement_timestamp`, `quality_score`, `participant_enrollment_date`, and `study_start_date` as `TEXT`. This is the single biggest source of complexity across the entire repo.

**What it costs you:**

- Every query that does arithmetic must cast at runtime: `quality_score::numeric`, `participant_dob::date`, `measurement_timestamp::timestamp`. These casts are in five different queries across two route files. If a single bad string row is ever inserted, the query fails with a 500 and there is no defensive path.
- Three of the six indexes are on cast expressions (`(quality_score::numeric)`, and `(measurement_timestamp::timestamp)` in the new index). These are fragile — the expression in the index must exactly match the expression in the query or the planner ignores the index. A refactor of any query that changes the cast form silently drops to a sequential scan.
- The `SUBSTRING(first_ts, 1, 10)` string slice in the enrollment query (`participants.routes.ts:155`) is a workaround for not having a proper timestamp type.
- `AVG(quality_score::numeric)` and `PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY age_years)` cannot use typed statistics. PostgreSQL's planner has less information for cost estimation.
- The transform layer (`transform.ts`) exists almost entirely because of this — it converts strings back to numbers after they were stored as strings, converted to numeric in SQL, and then returned as strings by the pg driver. This round-trip is avoidable.

**What proper typing would look like:** `quality_score NUMERIC(5,4)`, `measurement_timestamp TIMESTAMPTZ`, `participant_dob DATE`. The seed data already contains valid values; the schema just doesn't enforce it.

---

### [HIGH] No dimension tables — study, participant, and site metadata denormalized onto every row

Every row in `clinical_data_raw` repeats `study_id`, `study_name`, `study_phase`, `study_start_date`, `participant_id`, `participant_name`, `participant_dob`, `participant_gender`, `site_id`, `site_name`, `site_location`, `site_coordinator`. A participant with 100 measurements has their name and date of birth stored 100 times.

**What it costs you:**

- The `/studies/list` endpoint does `SELECT DISTINCT study_id, study_name, study_phase` to recover dimension data that was never separated (`studies.routes.ts:11-15`). This is a workaround for a missing `studies` table.
- The massive `participant_data` CTE in `/summary` (`participants.routes.ts:16-32`) uses `MAX(participant_dob)`, `MAX(participant_gender)`, `MAX(site_id)`, `MAX(site_name)` — four aggregates just to reconstitute one participant's stable attributes. The `MAX()` trick is correct but hides the fact that these values should be identical across all rows for a given participant.
- The `study_info` CTE (`participants.routes.ts:99-103`) re-scans the raw table a second time just to get `study_name` and `study_phase` — data already present in `participant_data`. This is a direct consequence of there being no dimension tables to join against.
- Adding a field to participants (e.g., `enrollment_date`) requires either a new scan or including it in the `MAX()` fan-out.

---

### ~~[MEDIUM] `participant_name` is stored and never queried~~ — RESOLVED

`database/bootstrap.sql:10` includes `participant_name TEXT`. No route, no transform, no type, no query references this column. It is PII (a real name, presumably) sitting in a database with no access controls, no masking, and no audit logging. In a clinical trial context this is a data governance concern independent of whether the app currently reads it.

---

### ~~[MEDIUM] No `NOT NULL` constraints on key columns~~ — RESOLVED

`study_id`, `participant_id`, `measurement_type`, `measurement_value`, `quality_score` are all implicitly nullable. A row with `NULL` in `study_id` would silently produce an empty string entry in the studies list. A NULL in `quality_score` would be filtered out of all quality aggregations without warning. The application has no signal that data integrity has been violated.

---

## 2. API — Security and Safety

### ~~[CRITICAL] Internal error messages returned to clients~~ — RESOLVED

All route handlers now return the generic message `'Internal server error'` and log the full error server-side. Raw PostgreSQL error messages no longer reach the client.

---

### ~~[CRITICAL] `offset` and `limit` not validated as non-negative integers~~ — RESOLVED

`participants.routes.ts:183-188` now guards with `Number.isInteger()` checks on `rawLimit` and `rawOffset` and returns 400 for invalid input before touching the database.

---

### ~~[HIGH] CORS is wide open~~ — RESOLVED

`api/src/app.ts:8`: `app.use(cors())` — no `origin`, `methods`, or `credentials` configuration. Every origin can make cross-site requests to this API. Acceptable for local development but must be restricted before any deployment.

---

### ~~[HIGH] No graceful shutdown — database connections are abandoned on SIGTERM~~ — RESOLVED

`api/src/index.ts` has no `SIGTERM`/`SIGINT` handler. The `http.Server` returned by `server.listen()` is also never captured (`app().then(server => { server.listen(...) })` discards the return value), making it impossible to call `.close()` even if a handler were added. In a containerized deployment, the orchestrator sends `SIGTERM` before killing the process. Without a handler calling `pool.end()` and `httpServer.close()`, in-flight requests are dropped and PostgreSQL connections are leaked.

---

### ~~[MEDIUM] Pool has no explicit configuration~~ — RESOLVED

`api/src/db.ts:5`: `new Pool({ connectionString: DATABASE_URL })` — default `max` is 10, default `idleTimeoutMillis` is 10000ms, no `connectionTimeoutMillis` set. In a containerized environment, a slow PostgreSQL startup can cause the first request to hang indefinitely. A `connectionTimeoutMillis: 5000` guard would make the app fail fast instead.

---

### ~~[MEDIUM] `app.ts` wildcard catch-all uses deprecated `'*'`~~ — RESOLVED

`api/src/app.ts:17`: `app.use('*', ...)` — the `*` wildcard is deprecated in Express 4.x and removed/changed in Express 5. Should be `app.use((req, res) => {...})` with no path argument.

---

### ~~[LOW] Unhandled startup Promise rejection~~ — RESOLVED

`api/src/index.ts:5`: `app().then(server => { ... })` has no `.catch()` handler. If `app()` ever rejects (e.g., if setup code is made async and throws), Node.js silently swallows the error in older versions and crashes with an unhandled rejection warning in newer ones. A `.catch(err => { console.error('Failed to start:', err); process.exit(1); })` makes the failure explicit.

---

## 3. Type System and Contract Integrity

### ~~[HIGH] Repeated `XResponse` wrapper types — no generic `ApiResponse<T>`~~ — RESOLVED

`frontend/src/types.ts` defines six nearly-identical wrapper types:
```
StudyListResponse, StudyOverviewResponse, QualityDistributionResponse,
ParticipantSummaryResponse, EnrollmentTrendResponse, ParticipantDetailResponse
```
Each is `{ data: T[]; executionTime: string; executionTimeSeconds: number }`. Adding a field (e.g., a `requestId` for tracing) requires touching six type definitions. A `ApiResponse<T>` generic would make the contract explicit and the change a single edit.

---

### ~~[MEDIUM] `SiteDistribution` type has an implicit TEXT-to-number contract not captured by the type~~ — RESOLVED

In `types.ts:28-40`, `SiteDistribution` declares all numeric fields as `number`. But the SQL `json_build_object` in the participant summary query casts all numeric site fields to `::text` before embedding them in the JSON (`participants.routes.ts:61-70`). The transform parses them back with `parseInt`/`parseFloat`. The type says `number` but the wire format says `string`.

This means if someone reads `SiteDistribution` and assumes the API returns JSON numbers, they're wrong. The cast-to-text trick is an artifact of PostgreSQL's `json_agg` behavior and should be documented at the type level or eliminated by not casting to text in the SQL.

---

### ~~[MEDIUM] `executionTimeSeconds` typed as `string` but named like a number~~ — RESOLVED

`types.ts` now correctly types `executionTimeSeconds: number`, and `formatExecutionTime` returns the raw numeric division (`ms / 1000`).

---

### [LOW] `ParticipantSortKey` includes `'age_range'` and `'date_range'` which are synthetic

`participants.ts:3-6`: `ParticipantSortKey` contains `'age_range'` and `'date_range'`. These don't map to single fields on `ParticipantSummary` — the sort implementation uses `row.min_age` for `age_range` and `row.earliest_measurement` for `date_range`. The key names suggest properties that don't exist on the type. This is a leaky abstraction — the sort key type implies the type has those fields but it doesn't.

---

### ~~[MEDIUM] `SiteJson` interface defined inside a function body~~ — RESOLVED

`transform.ts:24-28`: The `SiteJson` interface is declared inside `parseParticipantSummaryRow`. TypeScript interfaces at function scope are unusual — they don't get hoisted in an obvious way, can't be exported, and signal that the type was written ad hoc rather than designed. It should be a module-level type, ideally in `types.ts` alongside `SiteDistribution` which it structurally overlaps with.

---

## 4. Architecture — Cross-Cutting Structural Issues

### ~~[HIGH] `studies/list` and `studies/overview` are redundant endpoints fetched in parallel~~ — RESOLVED

`StudyOverview.tsx:8-9` calls both `studiesListQuery` and `studiesOverviewQuery` simultaneously. The overview response already contains every field from the list response (`study_id`, `study_name`, `study_phase`) plus the counts. The list endpoint exists to serve the dropdown in `ParticipantSummary`, but `overviewQuery` data would serve both purposes.

The result is two network round-trips on initial load where one would do. `App.tsx:15-16` also prefetches both. If the list endpoint were eliminated and the dropdown populated from overview data, one query, one cache entry, same UX.

---

### ~~[HIGH] `study_info` CTE rescans `clinical_data_raw` unnecessarily~~ — RESOLVED

In `participants.routes.ts:99-103`:
```sql
study_info AS (
  SELECT DISTINCT study_id, study_name, study_phase
  FROM clinical_data_raw
  WHERE ($1::text IS NULL OR study_id = $1)
)
```
This is a second full (or filtered) scan of `clinical_data_raw` to recover `study_name` and `study_phase` — data that is already in `participant_data`. The CTE could derive study metadata from `participant_data` using `MAX(study_name)` and `MAX(study_phase)` without touching the raw table again.

---

### ~~[MEDIUM] `handleSort` is copy-pasted between `QualityDashboard.tsx` and `ParticipantSummary.tsx`~~ — RESOLVED

`QualityDashboard.tsx:134-137` and `ParticipantSummary.tsx:287-290` contain identical sort toggle logic:
```typescript
const handleSort = (key: SortKey) => {
  if (key === sortKey) setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
  else { setSortKey(key); setSortDir('asc'); }
};
```
This is a `useSort(initialKey, initialDir)` hook waiting to be extracted. When a third sortable view is added, this will be copy-pasted a third time.

---

### ~~[MEDIUM] `btnBase`/`btnInactive`/`btnActive` CSS strings duplicated across views~~ — RESOLVED

The same Tailwind class strings are redefined in both `QualityDashboard.tsx:205-207` and `ParticipantSummary.tsx:336-337`. A shared `buttonVariants` export from a component file (or even a `constants.ts`) would make this consistent and centrally changeable.

---

### ~~[MEDIUM] `getCurrentState()` in `QualityDashboard.tsx` duplicates the `useEffect` body~~ — RESOLVED

`QualityDashboard.tsx:144-147` defines `getCurrentState()` which builds a `ViewState` object. The `useEffect` at line 44 calls it. But `getCurrentState` is not a stable reference (it's defined inside the component body and recreated every render), so it cannot be included in the effect's dependency array — hence the `eslint-disable-line react-hooks/exhaustive-deps` comment on line 45. The real fix is to inline the object construction directly in the effect and delete the function, which removes the react-hooks lint violation entirely instead of suppressing it.

---

### ~~[MEDIUM] `eslint-disable` comment masks a hook design issue~~ — RESOLVED

`QualityDashboard.tsx:45`: The `// eslint-disable-line react-hooks/exhaustive-deps` comment suppresses the lint warning rather than addressing its root cause. The hook works correctly at runtime (all state variables are in the dep array), but the comment is a flag that someone worked around the linter rather than reasoning about it. See the `getCurrentState` item above for the fix.

---

### ~~[MEDIUM] `useState` initializer inconsistency for localStorage reads~~ — RESOLVED

`QualityDashboard.tsx:33-34`:
```typescript
const [savedViews, setSavedViews] = useState<SavedView[]>(loadSavedViews);       // function reference
const [activeViewName, setActiveViewName] = useState(() => loadActiveViewName()); // arrow wrapper
```
Both are lazy initializers and both work. But the inconsistency signals that one was written without knowing the other. Prefer the function reference form (no arrow wrapper needed) for consistency.

---

### ~~[MEDIUM] KPI cards in `ParticipantSummary` do not reflect client-side filters~~ — RESOLVED

`ParticipantSummary.tsx:315-331`: The `kpi` memo derives from `rows` (the raw API response), not from `filteredRows`. When a user applies client-side filters (by study name, phase, age, etc.), the four KPI cards at the top of the page do not update. This is surprising — a user filtering to "Phase 3 studies only" still sees totals across all phases. The fix is to compute `kpi` from `filteredRows` instead of `rows`.

---

### ~~[MEDIUM] `enrollmentTrendQuery` uses string concatenation instead of `URLSearchParams`~~ — RESOLVED

`queries.ts:41`: 
```ts
const qs = studyId ? `?study=${studyId}` : '';
```
Compare to `participantSummaryQuery` and `participantListQuery` which correctly use `URLSearchParams`. If a study ID ever contains `&`, `=`, `#`, or `+`, the enrollment query URL would be malformed. All query builders in this file should use `URLSearchParams` for consistency and correctness.

---

### [LOW] `pool` exported as a module-level singleton makes route handlers untestable

`api/src/db.ts:5`: The pool is a module singleton. Testing any route handler in isolation requires either mocking the `pg` module (coupling tests to the implementation detail of which module provides the pool) or running against a real database. A factory pattern or passing the pool as a dependency would make unit testing possible.

---

## 5. Performance — Latent Issues

### ~~[MEDIUM] `EnrollmentChart` builds chart data with O(periods × studies) `find()` calls~~ — RESOLVED

`EnrollmentChart` now builds a `Map<string, number>` keyed by `${study_id}|${period}` and does O(1) lookups. The O(n²) `find()` is gone.

---

### ~~[MEDIUM] `computeZoomDomain` spreads potentially large array into `Math.min`/`Math.max`~~ — RESOLVED

`dashboard.ts:127-128` now uses `reduce` with `Math.min`/`Math.max` instead of spread, which is safe for arbitrarily large arrays.

---

### ~~[MEDIUM] `overviewMap` in `StudyOverview.tsx` not memoized~~ — RESOLVED

`StudyOverview.tsx:11-14` now wraps the `Map` construction in `useMemo`.

---

### ~~[HIGH] No `staleTime` configured on React Query — prefetching is effectively wasted~~ — RESOLVED

`main.tsx:8-11` now sets `staleTime: 5 * 60 * 1000` as a global default. Prefetched data is served from cache for 5 minutes.

---

## 6. Test Coverage Gaps

### ~~[HIGH] No tests for `computeZoomDomain` edge cases~~ — RESOLVED

`dashboard.test.ts` now has comprehensive `computeZoomDomain` coverage: empty data, single value, zero value, normal range, multi-key visibility, cross-row spanning.

---

### ~~[HIGH] No tests for `sortRows` in `dashboard.ts`~~ — RESOLVED

`dashboard.test.ts` now has a full `sortRows` suite covering all six sort keys, both directions, missing quality data, and immutability.

---

### ~~[MEDIUM] `computeMediumCount` can return negative but callers don't guard against it~~ — RESOLVED

`dashboard.ts:72-73`:
```ts
return quality.total_measurements - quality.high_quality_count - quality.low_quality_count;
```
`dashboard.test.ts:109-111` explicitly documents that this can return `-10` with inconsistent data, calling it "expected behavior." But downstream consumers in `QualityDashboard.tsx` never check for negative before calling `.toLocaleString()` or rendering a bar. A negative bar in Recharts renders as zero-height — no crash — but the table would display `-10`. A `Math.max(0, ...)` guard in `computeMediumCount` would be safer than relying on callers to not produce this.

---

### [MEDIUM] Error cases in transform functions are documented by test but never guarded

`transform.test.ts:33-37` tests that `parseQualityRow` returns `NaN` for non-numeric input and calls this "expected" behavior. But downstream consumers (`QualityDashboard.tsx:461-464`) never check for `NaN` before calling `quality.avg_quality_score >= 0.9` or `quality.high_quality_count.toLocaleString()`. `NaN >= 0.9` is `false` (no color applied), and `NaN.toLocaleString()` returns `"NaN"` in all browsers, which would be visible to users. The tests document a footgun without fixing it.

---

### ~~[LOW] `formatExecutionTime(999)` test description is misleading~~ — RESOLVED

The test is now titled "returns exact division without rounding" which correctly describes the behavior.

---

## 7. Code Quality and Consistency

### ~~[MEDIUM] `window.confirm()` used for destructive action confirmation~~ — RESOLVED

`QualityDashboard.tsx:178`:
```typescript
if (!window.confirm(`Delete "${name}"? This cannot be undone.`)) return;
```
`window.confirm` is a blocking browser dialog. It cannot be styled, is disallowed in iframes and some browser configurations, and blocks the event loop. It also embeds user-controlled input in the string (`${name}`) — not an XSS vector here since it's a dialog, not HTML, but a code pattern to avoid. A proper inline confirmation state should replace it.

---

### ~~[MEDIUM] Navbar has no mobile navigation~~ — RESOLVED

`Navbar.tsx:18`: `<div className="hidden sm:flex sm:space-x-8">` — the nav links are hidden below 640px with no alternative (no hamburger, no bottom nav, no dropdown). On any mobile viewport, there is no way to navigate between views.

---

### ~~[HIGH] `numInput`/`textInput` are factory functions, not React components~~ — RESOLVED

`ParticipantSummary.tsx` now defines `NumInput` and `TextInput` as proper React components with capitalized names, called as `<NumInput ... />`. React's fiber tree tracks them correctly.

---

### ~~[LOW] `DrilldownPanel` resets to page 1 when the panel is closed and reopened~~ — RESOLVED

`ParticipantSummary.tsx:168`: `const [page, setPage] = useState(1)` — page state is local to `DrilldownPanel`. When the user closes and reopens a drilldown, the page resets to 1. React Query caches the data for each `(studyId, page, siteId)` combination, so page 3 would still be in cache, but the UI forgets which page the user was on.

---

### ~~[LOW] `CTRL_STICKY` constant name is cryptic~~ — RESOLVED

`ParticipantSummary.tsx:27`: `const CTRL_STICKY = 'sticky left-0 z-10 border-r-2 border-gray-300'` — the name abbreviates "controls sticky" but this is not obvious. There are only four use sites; either rename to `STICKY_CTRL_CELL_CLASS` or inline it.

---

## Summary Table

| # | Severity | Status | Location | Issue |
|---|----------|--------|----------|-------|
| 1 | HIGH | **Resolved** | `bootstrap.sql` | All columns now properly typed (NUMERIC, TIMESTAMPTZ, DATE) |
| 2 | HIGH | Open (skipped) | `bootstrap.sql` | No dimension tables; metadata denormalized on every row — multi-day refactor |
| 3 | MEDIUM | **Resolved** | `bootstrap.sql` | `participant_name` removed from schema and seed |
| 4 | MEDIUM | **Resolved** | `bootstrap.sql` | `NOT NULL` constraints added to all key columns |
| 5 | CRITICAL | **Resolved** | All route files | Raw PostgreSQL error messages returned to client |
| 6 | CRITICAL | **Resolved** | `participants.routes.ts` | `offset`/`limit` can be NaN or negative → 500 |
| 7 | HIGH | **Resolved** | `app.ts` | CORS now restricted to origin allowlist |
| 8 | HIGH | **Resolved** | `index.ts` (api) | Graceful shutdown with SIGTERM/SIGINT handlers and `pool.end()` |
| 9 | HIGH | **Resolved** | `main.tsx` | `staleTime: 5 * 60 * 1000` is now set; prefetch cache is effective |
| 10 | MEDIUM | **Resolved** | `db.ts` | Pool configured with `max`, `idleTimeoutMillis`, `connectionTimeoutMillis` |
| 11 | MEDIUM | **Resolved** | `app.ts` | Wildcard catch-all changed to `app.use((req, res) => {...})` |
| 12 | HIGH | **Resolved** | `types.ts` | `ApiResponse<T>` generic added; all response types use it |
| 13 | MEDIUM | **Resolved** | `types.ts` + `transform.ts` | Native column types eliminate TEXT-to-number contract; `::text` casts removed |
| 14 | MEDIUM | **Resolved** | `types.ts` | `executionTimeSeconds` now typed as `number` |
| 15 | LOW | Open | `participants.ts` | `ParticipantSortKey` has synthetic keys not in the data type |
| 16 | HIGH | **Resolved** | `studies.routes.ts` + `App.tsx` | `list` endpoint and query removed; overview serves all use cases |
| 17 | HIGH | **Resolved** | `participants.routes.ts` | `study_info` CTE now derives from `participant_data`, no second scan |
| 18 | HIGH | **Resolved** | `ParticipantSummary.tsx` | `NumInput`/`TextInput` are now proper React components |
| 19 | MEDIUM | **Resolved** | Both view files | `useSort<K>` hook extracted to `utils/ui.ts` |
| 20 | MEDIUM | **Resolved** | Both view files | `BTN_BASE`, `BTN_INACTIVE`, `btnActive` extracted to `utils/ui.ts` |
| 21 | MEDIUM | **Resolved** | `QualityDashboard.tsx` | `getCurrentState()` removed; state object inlined in `useEffect` |
| 22 | MEDIUM | **Resolved** | `QualityDashboard.tsx` | `useState(loadActiveViewName)` now consistent function-reference form |
| 23 | LOW | Open | `db.ts` | Pool singleton makes route handlers untestable without module mocks |
| 24 | MEDIUM | **Resolved** | `ParticipantSummary.tsx` | `EnrollmentChart` now uses O(1) Map lookup instead of O(n²) `find()` |
| 25 | MEDIUM | **Resolved** | `dashboard.ts` | `computeZoomDomain` now uses `reduce` instead of spread-into-Math.min |
| 26 | MEDIUM | **Resolved** | `StudyOverview.tsx` | `overviewMap` is now memoized with `useMemo` |
| 27 | LOW | **Resolved** | `participants.ts` | `formatPeriod` is now in `participants.ts`, tested, and guards invalid input |
| 28 | HIGH | **Resolved** | `dashboard.test.ts` | Full `sortRows` test suite added |
| 29 | HIGH | **Resolved** | `dashboard.test.ts` | Full `computeZoomDomain` test suite added |
| 30 | MEDIUM | **Resolved** | `participants.ts` | `formatPeriod` is exported and testable |
| 31 | MEDIUM | Open | `transform.test.ts` + consumers | NaN from bad input documented in tests but not guarded downstream |
| 32 | LOW | **Resolved** | `transform.test.ts` | "fractional milliseconds" description fixed |
| 33 | MEDIUM | **Resolved** | `QualityDashboard.tsx` | `window.confirm()` replaced with inline `deleteTarget` state + confirmation UI |
| 34 | MEDIUM | **Resolved** | `Navbar.tsx` | Mobile hamburger menu added with dropdown navigation |
| 35 | LOW | **Resolved** | `ParticipantSummary.tsx` | Drilldown page state lifted to `drilldownPages: Map<string, number>` in parent |
| 36 | LOW | **Resolved** | `ParticipantSummary.tsx` | Renamed to `STICKY_CTRL_CLASS` |
| 37 | MEDIUM | **Resolved** | `QualityDashboard.tsx` | `eslint-disable` removed; effect body now inlined (no function reference) |
| 38 | MEDIUM | **Resolved** | `transform.ts` | `SiteJson` interface moved to module level |
| 39 | MEDIUM | **Resolved** | `queries.ts` | `enrollmentTrendQuery` now uses `URLSearchParams` |
| 40 | MEDIUM | **Resolved** | `ParticipantSummary.tsx` | KPI cards now derived from `filteredRows` |
| 41 | MEDIUM | **Resolved** | `dashboard.ts` | `computeMediumCount` now guards with `Math.max(0, ...)` |
| 42 | LOW | **Resolved** | `index.ts` (api) | `.catch(err => { process.exit(1) })` added to startup |

---

## Remaining Open Items

All items except the following have been resolved:

- **Item 2** (dimension tables) — genuinely multi-day architectural refactor; intentionally skipped
- **Item 15** (synthetic sort keys `age_range`/`date_range` in `ParticipantSortKey`) — low priority; works correctly at runtime
- **Item 23** (pool singleton testability) — low priority; only matters if route handlers need unit tests without a real DB
- **Item 31** (NaN from bad input not guarded downstream) — defensive issue; real data is now typed so NaN path is unreachable in production
