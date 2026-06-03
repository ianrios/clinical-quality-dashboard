### Task 3: Database Schema Design Proposal 📝 DESIGN

**Context:**
The current application uses a single denormalized table with ~500K rows. While this works for the current scale, the business is planning significant expansion:
- Adding 20+ new studies over the next year
- Each study may have 5,000-10,000 participants
- Expanding to 50+ measurement types
- Projected growth to 50-100 million rows within 2 years
- Need to support more complex queries (participant history, site analytics, longitudinal studies)

**Your Task:**
Based on your experience implementing Tasks 1 & 2, write a design proposal to optimize the data layer. Your design proposal may include schema changes, DB infrastructure strageies or alternative technologies.

Include:
- Architecture and/or ERD Diagram
- Expected performance/scaling impact
- Downsides/radeoffs
- Rationale

**Deliverable:** A written document (Markdown, PDF, or included in your README) explaining your proposed design. You do NOT need to implement this schema - focus on clear explanation and justification of your decisions.

As you work on this task, Document the Approach, architecture, design, major changes, Performance improvements with before/after metrics, Database optimizations (indexes, query changes) and anything else in a task-1-retro-summary.md file. if the file exists, add to it.
