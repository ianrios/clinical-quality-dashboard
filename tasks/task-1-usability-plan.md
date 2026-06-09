# Task 1 (Usability Phase): Quality Dashboard — Advanced Visualization Controls & Saved Views

## Context

Task 1 delivered a fast, cached Quality Dashboard. The data itself reveals a new problem: all five studies have virtually identical quality distributions (~89.3% avg, ~12,200–12,500 low-quality counts). With numbers this close, standard grouped bar charts flatten meaningful differences into visually indistinguishable bar lengths. This task adds the visualization controls needed to surface those differences and persists user preferences across page refreshes.

## Problems Discovered

- **Narrow numeric ranges look flat on linear scale** — Low Quality spans only ~264 units (12,232–12,496) across five studies. Even with Zoom active, grouped bars look nearly identical because proportional differences aren't surfaced.
- **No chart composition view** — there's no way to see what fraction of each study's total measurements each band represents. Proportional comparison requires mental arithmetic.
- **Table is unsorted and unfiltered** — no way to rank studies by worst/best quality or narrow to a subset.
- **No per-study outlier view** — you can't see at a glance which studies are above or below the cross-study average.
- **Settings reset on refresh** — every page load restores defaults; exploratory configurations are lost.

## Resolved Design Decisions

These were ambiguous during planning and have been explicitly decided:

| Decision | Choice | Rationale |
|----------|--------|-----------|
| 100% stacked normalization basis | Always % of study's full `total_measurements` | Bands don't rescale when others are hidden — prevents confusing bar growth on toggle |
| Deviation baseline when filters are linked | Global mean of all 5 studies, regardless of filter state | Stable reference point; per-filtered-set mean would shift all bars when a study is hidden |
| Scale mode in deviation chart mode | Forced linear; Log/Exp buttons disabled | Deviation bars cross zero — log scale is undefined at y=0 |
| Dot mode availability | Grouped and Deviation modes only | A dot at the top of a stacked/100% cumulative bar represents the stack total, not the individual band — misleading |
| Saved view deletion | Requires confirmation dialog | Irreversible action |
| Default view | Non-deletable, always pinned at top of dropdown | Users can never be left without a known-good baseline to return to |
| Study text filter | Case-insensitive substring match on name OR ID | Coordinators may remember partial name or partial ID |
| View dropdown order | Default pinned at top; named views sorted alphabetically below | Predictable position for the most-used entry |
| Set serialization to localStorage | Convert `hiddenBands: Set<BandId>` ↔ `BandId[]` on save/load | `JSON.stringify(new Set())` produces `{}`, not an array — silent data loss without conversion |

## New State Fields

These fields are added to `QualityDashboard.tsx` and included in the persisted `ViewState` shape:

| Field | Type | Default | Purpose |
|-------|------|---------|---------|
| `chartMode` | `'grouped' \| 'stacked' \| '100pct' \| 'deviation'` | `'grouped'` | Which chart variant to render |
| `dotPlot` | `boolean` | `false` | Replace bars with dots (strip plot) |
| `sortKey` | `SortKey` (see below) | `'study_name'` | Active sort column |
| `sortDir` | `'asc' \| 'desc'` | `'asc'` | Sort direction |
| `filters` | `FilterState` (see below) | all null/empty | Per-column range/text filters |
| `filtersLinked` | `boolean` | `true` | Whether filters also affect the chart |

`SortKey` union: `'study_name' | 'total_measurements' | 'avg_quality_score' | 'high_quality_count' | 'medium_quality_count' | 'low_quality_count'`

`FilterState`: `{ studyName: string; totalMeasurements: RangeFilter; avgQualityScore: RangeFilter; highQuality: RangeFilter; mediumQuality: RangeFilter; lowQuality: RangeFilter }` where `RangeFilter = { min: number | null; max: number | null }`.

Full `ViewState` shape (all fields that are snapshotted to named views and to `regen_quality_active`):
```
horizontal, hiddenBands (as BandId[]), scaleMode, zoomed,
chartMode, dotPlot, sortKey, sortDir, filters, filtersLinked
```
`showPercent` is excluded — it is a global display preference owned by App.tsx, not a per-view analysis setting.

## Feature Details

### 1. Sortable Table Columns

All six column headers become clickable sort triggers. Clicking a header sorts by that column; clicking the same header again reverses direction. A small ↑ / ↓ arrow appears inline with the column label on the active column only; inactive columns show no indicator. The sort applies to the derived row list (post-filter) before rendering.

Study Name sorts lexicographically. All numeric columns sort numerically. Medium Quality count is computed (`total - high - low`) before sorting — it is not a raw API field.

Default: `study_name` ascending (alphabetical).

`TooltipHeader.tsx` is extended to accept `sortKey`, `activeSortKey`, `sortDir`, and `onSort` props. When `sortKey` is provided, the header renders as a clickable button that calls `onSort`. The existing tooltip behavior is unchanged.

### 2. Range Filters with Chart Link/Unlink

A collapsible **Filters** panel is exposed by a "Filters" toggle button above the table (right-aligned, same row as the "Study Details" heading). When expanded, a second `<tr>` appears in `<thead>` containing per-column filter inputs:
- **Study column**: single text input, case-insensitive substring match on `study_name` OR `study_id`
- **Numeric columns** (Total Measurements, Avg Quality, High Quality, Med Quality, Low Quality): two small number inputs side-by-side (`min` | `max`), either of which can be left blank (no bound)

Filtering is applied to a derived `filteredStudies` list computed once in the component body. This list feeds both the chart and the table, so logic is never duplicated.

A **Link / Unlink** button sits between the chart section and the table section. Default: linked. When linked, `filteredStudies` is used for the chart. When unlinked, the chart always uses the full unfiltered study list while the table uses `filteredStudies`.

### 3. Chart Mode Toggle

A button group is added to the chart controls bar: `[Grouped] [Stacked] [100%] [Deviation]`.

- **Grouped** (default): current behavior — one bar cluster per study, bands side by side. All controls (scale, zoom, dot) available.
- **Stacked**: `stackId="stack"` added to all `<Bar>` components. Bars stack per study. Band toggles remove segments. Scale/Zoom apply.
- **100%**: Data is transformed before passing to Recharts — each band value is `(count / total_measurements) * 100`. Bars are stacked. Axis shows 0–100 with `%` tickFormatter. Scale and Zoom buttons are disabled (axis is always 0–100). Normalization is always against `total_measurements`, not the visible-band sum — toggling a band off does not rescale the remaining bands.
- **Deviation**: Per-band cross-study mean is computed from the full dataset (all 5 studies, regardless of filters). Each bar value becomes `count - globalMeanForBand`. A `<ReferenceLine y={0} />` marks the baseline. Bars above zero = above average, below zero = below average. Zoom domain is computed from the delta values. Scale is forced to linear; Log/Exp buttons are disabled. Dot mode is available in this mode.

### 4. Dot / Strip Plot

A `[Dot]` toggle button sits in the chart controls. It is only enabled when `chartMode` is `'grouped'` or `'deviation'`; it is disabled (greyed out) in `'stacked'` and `'100pct'` modes.

When active, each `<Bar>` receives a custom `shape` prop (`DotBar` component). `DotBar` renders a filled circle at the endpoint of the bar:
- Horizontal layout: circle at `cx = x + width`, `cy = y + height / 2`
- Vertical layout: circle at `cx = x + width / 2`, `cy = y`

Radius is fixed at 5px. All chart infrastructure (axis, scale, zoom, band toggles) continues to work unchanged — only the visual mark changes from rectangle to circle.

### 5. Saved Views (localStorage)

**Two localStorage keys:**
- `regen_quality_active` — serialized `ViewState` written on every state change via `useEffect`. Read on mount to restore the last session state.
- `regen_quality_views` — `{ name: string; state: ViewState }[]` array of named snapshots.

**`hiddenBands` serialization:** stored as `BandId[]` (array), deserialized back to `Set<BandId>` on read. Never stored as a raw Set.

**Views toolbar** renders above the chart panel as a single row:
```
Views: [ Default ▼ ]   [ Save current view ]   [ Reset to Default ]
```

- **Dropdown**: "Default" always pinned at top (non-deletable). Named views listed alphabetically below. The currently loaded view name is shown as the selected option. Selecting a view immediately applies its `ViewState`.
- Named views in the dropdown show a small `✕` delete button. Clicking `✕` opens a confirmation before removing the view from `regen_quality_views`. After deletion the user must explicitly select another view — no auto-selection.
- **"Save current view"**: reveals an inline text input + "Save" confirm button in the toolbar. On confirm, appends `{ name, state }` to `regen_quality_views`. Duplicate names are allowed (they coexist as separate entries).
- **"Reset to Default"**: applies `DEFAULT_VIEW` to all state fields without touching `regen_quality_views`.

`DEFAULT_VIEW` constant: `{ horizontal: true, hiddenBands: ['medium'], scaleMode: 'linear', zoomed: false, chartMode: 'grouped', dotPlot: false, sortKey: 'study_name', sortDir: 'asc', filters: { studyName: '', totalMeasurements: {min:null,max:null}, avgQualityScore: {min:null,max:null}, highQuality: {min:null,max:null}, mediumQuality: {min:null,max:null}, lowQuality: {min:null,max:null} }, filtersLinked: true }`.

## Files to Change

| File | What changes |
|------|-------------|
| `frontend/src/components/QualityDashboard.tsx` | All new state, chart modes, sort/filter logic, dot shape, view toolbar, localStorage persistence |
| `frontend/src/components/TooltipHeader.tsx` | Add optional `sortKey`, `activeSortKey`, `sortDir`, `onSort` props; render sort indicator and click handler when provided |

No backend changes. No new files required.

## Verification Checklist

### Sortable Table
- [ ] Clicking Study header sorts alphabetically A→Z, then Z→A on second click
- [ ] Clicking each of the 5 numeric columns sorts correctly in both directions
- [ ] ↑ / ↓ arrow appears only on the active sort column
- [ ] Sort state persists on page refresh

### Range Filters
- [ ] "Filters" button above table expands/collapses the filter row
- [ ] Study text filter matches on partial name (case-insensitive)
- [ ] Study text filter matches on partial ID (case-insensitive)
- [ ] Numeric min/max inputs filter rows correctly; leaving either blank applies no bound on that side
- [ ] When linked: chart hides studies excluded by filters
- [ ] When unlinked: chart shows all studies; table shows filtered subset
- [ ] Link/Unlink button toggles clearly and persists on refresh

### Chart Modes
- [ ] Grouped: existing behavior unchanged
- [ ] Stacked: bars stack correctly; hiding a band removes its segment without breaking other segments
- [ ] 100%: axis shows 0–100%; bars for each study reach ~100%; hiding a band does NOT cause remaining bands to rescale to 100%
- [ ] 100%: Scale and Zoom buttons are visually disabled
- [ ] Deviation: bars are positive/negative deltas from global mean; ReferenceLine visible at 0
- [ ] Deviation: Scale buttons (Log/Exp) are visually disabled
- [ ] Deviation: mean is global (unchanged when filters narrow the chart)
- [ ] All modes respect horizontal/vertical orientation toggle
- [ ] All modes respect band visibility toggles

### Dot / Strip Plot
- [ ] Dot button is disabled (greyed out) in Stacked and 100% modes
- [ ] Dot button enabled in Grouped and Deviation modes
- [ ] Active dot mode renders circles at bar endpoints, not rectangles
- [ ] Correct positioning in both horizontal and vertical orientations
- [ ] Zoom + single visible band + dot mode = clearly ranked dots on tight axis

### Saved Views
- [ ] Page refresh restores last active state (no named save required)
- [ ] "Save current view" saves under typed name; view appears in dropdown
- [ ] Selecting a saved view from dropdown restores all state fields
- [ ] "Default" is always at top of dropdown and has no ✕ button
- [ ] ✕ on a named view triggers confirmation before deletion
- [ ] After deletion, user must manually select another view
- [ ] "Reset to Default" restores DEFAULT_VIEW without removing saved views
- [ ] `showPercent` is NOT stored or restored by any view operation
- [ ] `hiddenBands` round-trips correctly (Set → array → Set across save/load)
