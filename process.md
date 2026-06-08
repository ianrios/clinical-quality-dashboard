1. downloaded project and read through the mono repo in vscode, got familiar with the code and files
2. prompted claude to get the app working via docker so that i could navigate to localhost and see the current state
3. right off the bat, i think that the routes seem a bit dangerous with just having raw sql in the output, also, the react component tree seems a bit lacking in terms of child components and linear logical rendering instead of more traditional ternary based conditional rendering and wrapper components
4. I decided the easiest way to batch these 3 tasks from the readme would be to create a tasks folder so that agents wouldnt over index and pull in too many files to the context on load
5. initial thoughts are to preload data, leveraging caching and skeleton loaders. the graph looks a bit messy with the text overlaying the key, so i want to move the key to the right or the left for the Quality Score Distribution by Study, i dont understand what the columns are in Study Details, so i would want on hover descriptions, i want the navbar to be sticky, so that i dont need to scroll to the top to see it. i think the main issue with the data is that the front end might be waiting for calculations to finish when we could be storing calculated data perhaps?
6. killed the setup claude to start fresh with a new context for task 1
7. got a new claude instance to install the packages and make sure local development was good to go by setting up a simple .nvmrc
8. chatted with a planning agent to create a claude md for future sessions (agent 3)
9. got interviewed with agent 4, a planning agent, to create the plan for task 1.
10. plan created, got a sub agent to investigate the plan
11. created planning agent templates for task 2 and 3, created execution agent prompt (decided not to use it instead will break up each chunk of task one into smaller execution agent plan and execute steps)
12. updated docker compose to allow front end hot reloading. litmus tested claude md on updating the default first tab to be study overview and saw that we were using css instead of true conditional rendering to show and hide that tab. fixed.
13. noticed that each time we change tabs, we fetch fresh data, which means we need some sort of local react context storage in addition to the data caching im planning to implement.
14. broke task 1 plan into 10 distinct pieces with dependency ordering and status tracking
15. reverted "hot reload" - agent was wrong - make sure claude md describes restarting docker after changes so that everything works as expected
16. worked on the fetchCount bug and hardened the agent workflow for future sessions so that it knows exactly how i need to interact with the repo
17. discovered we were missing an idempotency guard which caused the database to re-seed on top of existing data each time we restarted docker
18. fixed idempotency guard and am ready to start working on bulk of task 1 after dogfooding local agent repo system with sub tasks and planning. fixed tsx errors
19. came up with a way to measure lcp pre and post task 1
20. planned skeleton loaders and migration process with agent.
21. discussed what indexes I should add in the migration with an agent
