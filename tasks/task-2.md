    ### Task 2: Build Participant Summary Report 🆕 NEW

**User Story:**
"As a research coordinator, I need to view aggregate participant data by study so I can quickly understand the composition and characteristics of each study cohort. I would also like to share links to specific study summaries with colleagues. Eventually I will want to drill down into individual participant details, but for now, I just need the aggregate summary view."

**Business Requirements:**
Research coordinators need to query participants by study and see an aggregate summary including:
- Total participant count
- Age distribution (average, min, max)
- Gender breakdown
- Site distribution
- Average measurement count per participant
- Date range of data collection

**Your Task:**
Implement a complete Participant Summary Report in the UI.

As you work on this task, Document the Approach, architecture, design, major changes, Performance improvements with before/after metrics, Database optimizations (indexes, query changes) and anything else in a task-2-retro-summary.md file. if the file exists, add to it.

**Decision Points:**
- **Propose upfront:** Which aggregations should live in the database query vs. computed in the frontend? (e.g., age distribution calculation, site distribution rollup)
