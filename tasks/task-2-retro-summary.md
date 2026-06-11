# Task-2 Retro Summary: Participant Summary Report

## Investigation Findings

### Data Shape
- Single denormalized table `clinical_data_raw` (~500K rows)
- 5 studies × ~1000 participants × ~100 measurements per participant
- Participant fields (dob, gender, site) repeat across all 100 measurement rows per participant — any aggregate on these fields must first deduplicate to one row per participant or results are weighted by measurement count
- `participant_dob` is TEXT (YYYY-MM-DD format), not a date type — age computation requires explicit `::date` cast before `AGE()`
- `measurement_timestamp` is TEXT (ISO8601) — date range computation requires `::timestamp` cast
- `quality_score` is TEXT (same issue as task-1, already handled in existing routes)

### Existing Infrastructure Reused
- `GET /api/studies/list` already cached by React Query in App.tsx on mount — table skeleton renders with study names before participant summary resolves
- Four indexes from task-1 cover most access patterns; two additional indexes needed for the new endpoint
- React Query (`@tanstack/react-query`) already installed and configured with 5-min staleTime

### What Needed to Be Added
- React Router (`react-router-dom`) — not present; required for `useSearchParams` and URL-based filter state
- `/views` folder — did not exist; page-level components were mixed with shared primitives in `/components`
- Participant summary endpoint — no participant-level aggregation existed anywhere in the API
- Two new indexes for the participant deduplication and date range queries

---

## Key Decisions Made

### Age computation: SQL CTE, not frontend transform
Age is computed in the database using `AGE(CURRENT_DATE, participant_dob::date)` extracted to years, after deduplicating participants in a CTE. Doing this in the frontend transform would require passing raw DOBs over the wire for all 5,000 participants and computing ages in JavaScript — more data, more CPU, same answer. The database does it once at query time.

The CTE uses `GROUP BY (study_id, participant_id)` with `MAX()` on stable per-participant fields (dob, gender, site), rather than `DISTINCT ON`, because `GROUP BY` benefits more cleanly from the existing `(study_id, participant_id)` index and is easier to parameterize with optional WHERE clauses.

### Filter state lives in URL, not component state
`useSearchParams` (React Router) is the source of truth for `?study=` and `?site=` filters. This means:
- Any URL is shareable and restores the exact filtered view on load
- The browser back/forward buttons navigate filter history
- React Query's parameterized cache key is derived from the URL params — no separate state synchronization needed

### Site distribution: count in table + accordion expand
The sites count column gives coordinators a quick cross-study comparison. The accordion expand (per table row) reveals the per-site participant breakdown without navigation. Site data is included in the main API response as a nested JSON array (`json_agg`) — no separate request on accordion expand. The per-site data is small (max 8 sites per study) so the payload cost is negligible.

### showPercent toggle moves into QualityDashboard
The toggle was in App.tsx and conditionally rendered in the navbar. After extracting Navbar.tsx as a navigation-only component and adding React Router, threading `showPercent` props through routes adds unnecessary coupling. Moving the toggle into QualityDashboard's own controls section is cleaner: the preference belongs to the view that uses it. Navbar.tsx is navigation-only.

### Progressive loading: measure first, split only if slow
Unlike task-1, the participant summary endpoint returns `study_name` directly — there is no natural "fast metadata / slow aggregation" split. The initial implementation uses a single query with a full-table skeleton. After implementation, measure the cold `executionTime` from the API response: if ≥500ms, retrofit the progressive split (use cached `studiesListQuery` for table structure, skeleton metric columns); if <500ms, leave the full-table skeleton as-is. The 500ms threshold reflects the point where the wait is perceptible enough to warrant the added complexity.

### URL filter design: query params, not path params
`?study=CARDIO001&site=SITE_NY01` rather than `/participants/CARDIO001`. Study and site are filters on a single view, not resource identifiers. Query params support multi-filter sharing naturally, integrate with React Router's `useSearchParams`, and keep the React Query cache key derivation simple. Site values in the URL use `site_id` (e.g. `SITE_NY01`), not site name — avoids URL encoding issues with spaces.

### Background prefetch on filtered URL load
When the page loads with `?study=CARDIO001`, the filtered endpoint is fetched first (cheaper — scans less data). The unfiltered all-studies query is prefetched in the background. Removing the filter is instant (served from cache). This pattern replicates App.tsx's existing prefetch behavior, applied to a parameterized query.

---

## Root Cause of Missing Feature
No participant cohort data existed in the app because neither the original API nor the frontend had any participant-level aggregation. The original data model (denormalized measurements table) supports this query via GROUP BY but requires careful deduplication — the naive approach of aggregating directly on the raw table would weight per-participant stats (age, gender) by measurement count rather than participant count, producing wrong numbers.

---

## New Indexes

| Index | Columns | Purpose |
|-------|---------|---------|
| `idx_participant_summary` | `(study_id, participant_id) INCLUDE (participant_dob, participant_gender, site_id, site_name)` | Covering index for participant deduplication CTE — eliminates heap access for the GROUP BY |
| `idx_clinical_measurement_timestamp` | `(study_id, measurement_timestamp)` | Powers MIN/MAX date range query — plain text, not expression index (see learnings) |

**Note on index 2:** The plan specified `(study_id, (measurement_timestamp::timestamp))` (expression index). PostgreSQL rejected this because `text::timestamp` is STABLE, not IMMUTABLE — expression indexes require IMMUTABLE. Changed to plain text index `(study_id, measurement_timestamp)`. ISO8601 strings sort lexicographically correctly so `MIN`/`MAX` on text still produces the right date range. The query was also simplified: removed `::timestamp` casts from `MIN`/`MAX` in the CTE — plain text `MIN`/`MAX` on ISO dates is correct.

---

## Files Changed

| File | What changed |
|------|-------------|
| `database/bootstrap.sql` | Added 2 new indexes |
| `api/src/routes/participants.routes.ts` | New — participant summary endpoint with optional study/site filter params |
| `api/src/routes/index.ts` | Registered `/participants` router |
| `api/src/utils/transform.ts` | Added `parseParticipantSummaryRow` |
| `api/src/utils/transform.test.ts` | Added tests for new transform function |
| `frontend/package.json` | Added `react-router-dom` |
| `frontend/src/App.tsx` | Rewritten as thin router shell |
| `frontend/src/components/Navbar.tsx` | New — navigation only, active tab via useLocation() |
| `frontend/src/views/StudyOverview.tsx` | Moved from `/components`, import paths updated |
| `frontend/src/views/QualityDashboard.tsx` | Moved from `/components`, import paths updated, absorbed showPercent state |
| `frontend/src/views/ParticipantSummary.tsx` | New — KPI cards, sortable/filterable table, accordion, URL filter sync |
| `frontend/src/utils/participants.ts` | New — pure sort/filter/format helpers |
| `frontend/src/utils/participants.test.ts` | New — tests for sort/filter/format helpers |
| `frontend/src/api/queries.ts` | Added parameterized `participantSummaryQuery` |
| `frontend/src/types.ts` | Added `ParticipantSummary`, `ParticipantSummaryResponse`, `SiteDistribution` |

---

## Performance Improvements

| Metric | Before | After |
|--------|--------|-------|
| Participant cohort data | Not available | Available |
| `participants/summary` cold (no filter) | n/a | ~1650ms |
| `participants/summary?study=CARDIO001` cold | n/a | ~223ms |
| Progressive split applied? (threshold ≥500ms) | n/a | **Yes** — 1650ms > 500ms threshold |
| Time to data visible (cold, study names from studiesListQuery) | n/a | ~85ms (studiesList cache) |
| Filter clear (cached) | n/a | ~0ms |

## Learnings and Surprises

### PostgreSQL IMMUTABLE constraint on expression indexes
The plan's Index 2 called for `(study_id, (measurement_timestamp::timestamp))`. PostgreSQL rejected it: `functions in index expression must be marked IMMUTABLE`. The `text::timestamp` cast is STABLE (depends on DateStyle), not IMMUTABLE. Fixed by using a plain text index and removing the `::timestamp` cast from the MIN/MAX query. ISO8601 text sorts correctly lexicographically so no correctness is lost. This required a second `-v` rebuild cycle.

### pg library auto-parses json/jsonb columns
CLAUDE.md incorrectly stated that `json_agg` results come back as JSON strings requiring `JSON.parse()`. The `pg` library auto-parses `json`/`jsonb` typed columns into JavaScript objects. Calling `JSON.parse()` on an already-parsed array produces `"[object Object]"` → parse error. Fixed by checking `typeof sitesRaw === 'string'` before parsing. CLAUDE.md was updated to document the correct behavior.

### Sticky column transparency with Tailwind hover
`bg-inherit` on sticky `<td>` cells does not work correctly with Tailwind's `hover:bg-*` on the parent `<tr>` — when the row is hovered, the sticky cells show white/transparent background revealing scrolled content behind them. Fixed by adding `group` to `<tr>` and computing sticky cell background explicitly: `bg-white group-hover:bg-gray-50` (normal row) or `bg-blue-50` (selected row). This is the correct pattern for sticky columns inside hoverable rows.

### Grid features added beyond base plan (user request)
The base plan specified a simple filter panel (study name, min/max participants, min/max avg age). User requested significantly expanded grid functionality in a follow-up session:
- Compare checkbox (max 2 studies, side-by-side panel)
- Accordion caret moved to leftmost sticky column
- Full-column filters: phase text, age range floor/ceiling, male/female min/max, site name/ID contains, avg meas min/max, date range min/max
- 18-field `ParticipantFilterState` (was ~5 fields)
- 40+ filter tests in `participants.test.ts`

These were implemented and delivered but represent scope beyond the original plan.
