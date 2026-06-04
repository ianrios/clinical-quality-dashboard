### Task 1: Optimize Quality Dashboard Performance & Usability ⚠️ SLOW

**User Story:**
"As a research coordinator, I'm frustrated with the Quality Dashboard. It takes forever to load when I first open the app - I sometimes think it's frozen. Once it finally loads, the numbers are really hard to read and I have to squint to make sense of the quality scores. I need this dashboard to be fast and easy to use so I can quickly review our study data without getting a headache."

**Your Task:**
1. **Diagnose the issues**: Use the application, investigate the codebase, and identify the specific performance and usability problems causing the user's frustration
2. **Fix the problems**: Implement solutions to address all issues you discover
3. **Document your findings**: Explain what you found, what you changed, and measure the improvements

Navigate to http://localhost:5173 and experience the issues firsthand.

As you work on this task, Document the Approach, architecture, design, major changes, Performance improvements with before/after metrics, Database optimizations (indexes, query changes) and anything else in a task-1-retro-summary.md file. if the file exists, add to it.

**Decision Points:**
- UX improvements to propose separately (before implementing): sticky navbar, repositioning Quality Score Distribution graph key, hover descriptions on column headers
- Consider: Should calculated aggregations be pre-computed and stored in the database, or computed at query/render time? (Storage vs. speed tradeoff)
- Consider: Frontend caching/memoization vs. backend query optimization—which gives better ROI?
