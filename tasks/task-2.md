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

**Human Ideas:**
- extract reusable components
- separate /components into actual /views and /components
- add more tests
- clean up App component (extract navbar and make a new view for the entrypoint)
- link the existing pages (study overview and quality dashboard will eventually deep link and render the expanded view of the participant summary filtered on a specific study and be able to hit the back button in the browser to navigate back to the previous page (this we can add now, just not the drill into specific study from day 1) (probably requires adding react router but thats fine and cool because we need to share specific study summaries by link so it would be smart to do this too.) and also we will need a participant summary tab in the navbar that also allows us to see the aggregate summary view)
- for this task we specifically are NOT drilling down into individual participant details. we are simply getting wiring ready to go for the future, this means no participants-blah-blah-route/#study slug, which means it should be more simple but we need to keep that functionality in mind. if i have time i might implement it as "task-4"
