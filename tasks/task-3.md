### Task 3: Database Schema Design Proposal 📝 DESIGN

**Context:**
The current application uses a single denormalized table with ~500K rows. While this works for the current scale, the business is planning significant expansion:
- Adding 20+ new studies over the next year
- Each study may have 5,000-10,000 participants
- Expanding to 50+ measurement types
- Projected growth to 50-100 million rows within 2 years
- Need to support more complex queries (participant history, site analytics, longitudinal studies)

**Your Task:**
Based on your experience implementing Tasks 1 & 2, write a design proposal to optimize the data layer. Your design proposal may include schema changes, DB infrastructure strategies or alternative technologies. Think **advanced/hybrid**, not just incremental indexing.

Include:
- Architecture and/or ERD Diagram
- Expected performance/scaling impact
- Downsides/tradeoffs
- Rationale

**Deliverable:** A written document (Markdown, PDF, or included in your README) explaining your proposed design. You do NOT need to implement this schema - focus on clear explanation and justification of your decisions.

**Decision Point:**
- **Propose your design approach before writing.** Options to consider:
  - Normalized relational schema (studies → participants → measurements with proper FK relationships)
  - Time-series database (TimescaleDB, InfluxDB) for measurement-heavy workloads
  - Columnar store (DuckDB, Apache Parquet) for analytics-heavy queries
  - Hybrid approach (hot/cold data separation, event sourcing, CQRS pattern)
  - Other novel approaches you identify from Tasks 1 & 2

As you work on this task, Document the Approach, architecture, design, major changes, Performance improvements with before/after metrics, Database optimizations (indexes, query changes) and anything else in a task-1-retro-summary.md file. if the file exists, add to it.

---

## Code Review Findings — Context for This Design

A principal-engineer code review was completed after task 2. The following findings are **root-cause structural issues** that the design proposal should address. They are not bugs to patch — they are the reasons the schema needs redesign.

### Schema

**All dimension columns are TEXT.** `participant_dob`, `measurement_timestamp`, `quality_score`, `study_start_date`, and `participant_enrollment_date` are all stored as `TEXT`. Every query that does arithmetic casts at runtime (`quality_score::numeric`, `participant_dob::date`). Three of the six indexes are on cast expressions — these are fragile workarounds, not solutions. The proposed schema should use proper column types (`NUMERIC`, `TIMESTAMPTZ`, `DATE`).

**No dimension tables — everything denormalized onto every row.** Study metadata (`study_name`, `study_phase`, `study_start_date`), participant attributes (`participant_dob`, `participant_gender`, `participant_enrollment_date`), and site metadata (`site_name`, `site_location`, `site_coordinator`) are repeated on every measurement row. A participant with 100 measurements has their date of birth stored 100 times. The proposed schema should normalize this into `studies`, `participants`, and `sites` tables with proper foreign keys.

**`participant_name` is stored but never queried.** It's PII with no masking or access controls. The design should decide where PII lives — whether it belongs in this database at all, and if so what access controls are required.

**No `NOT NULL` constraints on key columns.** `study_id`, `participant_id`, `measurement_type`, and `measurement_value` are all implicitly nullable. The new schema should enforce integrity at the DB layer.

### API — Symptoms of the flat schema

**`/studies/list` and `/studies/overview` are redundant.** Both query `clinical_data_raw` for study dimension data. Both are fetched on every page load. With a normalized `studies` table, a single cheap lookup replaces both endpoints.

**`study_info` CTE rescans the raw table unnecessarily.** In `/api/participants/summary`, the `study_info` CTE does a second `SELECT DISTINCT` scan of `clinical_data_raw` just to recover `study_name` and `study_phase` — data already available from the `participant_data` CTE. This exists because there is no `studies` dimension table to join against. The proposed schema eliminates this pattern entirely.

**Expression indexes are workarounds for TEXT columns.** The indexes on `(quality_score::numeric)` and `(measurement_timestamp::timestamp)` exist only because those columns are TEXT. Proper column types make these unnecessary.

### Wire Format

**TEXT-to-number round-trip is invisible to consumers.** The SQL casts numeric fields to `::text` inside `json_build_object` (e.g., site counts, ages), the `pg` driver returns them as strings, and `transform.ts` parses them back to numbers. This round-trip is entirely a consequence of TEXT columns. The design should eliminate the need for a parsing layer by having the DB return correctly-typed values.
