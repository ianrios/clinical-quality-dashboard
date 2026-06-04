### Task 1: Optimize Quality Dashboard Performance & Usability ⚠️ SLOW

**User Story:**
"As a research coordinator, I'm frustrated with the Quality Dashboard. It takes forever to load when I first open the app - I sometimes think it's frozen. Once it finally loads, the numbers are really hard to read and I have to squint to make sense of the quality scores. I need this dashboard to be fast and easy to use so I can quickly review our study data without getting a headache."

**Your Task:**
1. **Diagnose the issues**: Use the application, investigate the codebase, and identify the specific performance and usability problems causing the user's frustration
2. **Fix the problems**: Implement solutions to address all issues you discover
3. **Document your findings**: Explain what you found, what you changed, and measure the improvements

Navigate to http://localhost:5173 and experience the issues firsthand.

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

As you work on this task, Document the Approach, architecture, design, major changes, Performance improvements with before/after metrics, Database optimizations (indexes, query changes) and anything else in a task-1-retro-summary.md file. if the file exists, add to it.

**Decision Points:**
- **Propose upfront:** Which aggregations should live in the database query vs. computed in the frontend? (e.g., age distribution calculation, site distribution rollup)
