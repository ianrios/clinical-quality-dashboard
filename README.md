# Assessment - Clinical Quality Dashboard

## Project Overview
Optimize and extend a clinical data dashboard application that's experiencing severe performance issues and missing critical features.

## Time Expectation
**4-6 hours** to complete 3 tasks.

**We encourage you to use AI assistants** such as ChatGPT, Claude, GitHub Copilot, etc. You are welcome to leverage AI tools throughout your development process to help solve problems, implement features, and optimize your workflow. Demonstrating effective use of AI can be a valuable part of this assessment. We're evaluating your problem-solving approach and implementation quality, not your ability to memorize syntax.

## Assessment Delivery

This assessment is provided as a **zip file** containing a working but unoptimized fullstack application. You will:

1. **Extract** the project files
2. **Push** to your public GitHub repository
3. **Implement** the required optimizations and features with regular commits
4. **Share** your public repository URL for review with [george.mitra@regeneron.com](mailto:george.mitra@regeneron.com)

## What We'll Review
- **Problem-solving approach**: How you diagnose and resolve performance bottlenecks
- **Commit history**: Regular commits showing development progress and optimization decisions
- **Code quality**: Architecture decisions, clean implementation, and best practices
- **Performance optimization**: Database schema design, indexing, query efficiency
- **Feature completion**: All three tasks completed (implementation + design proposal)
- **UI/UX improvements**: Data presentation, formatting, and user experience
- **Documentation**: Clear explanation of changes and performance improvements
- **Tool utilization and use of AI**: Effective use of available resources, tooling and modern development practices

## Getting Started

### What You'll Start With
Bootstrap application using Docker Compose:

#### 1. Frontend (React/TypeScript/Vite)
- Two working dashboards (Study Overview, Quality Dashboard)

#### 2. API Service (TypeScript/Node.js/Express)
- Two working endpoints

#### 3. Database (Postgres)
- Generates ~500K realistic clinical measurements on startup
- Single denormalized table of the generated data

**Data Characteristics:**
- 5 studies (cardiology, diabetes, oncology, neurology, respiratory)
- ~1000 participants per study
- ~100 measurements per participant
- 10-15 measurement types (glucose, blood_pressure, weight, heart_rate, cholesterol, etc.)
- Quality scores ranging from 0.6 to 1.0
- Data spanning 2-3 years

**Note:** Although you are welcome to modify the database schema as you wish, the expectation of this assessment is that you simply optimize the existing denormalized table as needed by modifying `bootstral.sql` for Task 1 and Task 2.

### 1. Setup Your Repository

```bash
# Extract the provided zip file
unzip clinical-quality-dashboard.zip
cd clinical-quality-dashboard

# Initialize git repository
git init
git add .
git commit -m "Initial project setup"

# Create a public GitHub repository and push
git remote add origin https://github.com/your-username/clinical-quality-dashboard.git
git branch -M main
git push -u origin main
```

### 2. Start the Services

```bash
# Start all services
docker compose up --build

# Wait for database seeding to complete (3-5 minutes)
# Watch logs for: "Database seeding completed"

# Verify services are running
curl http://localhost:3000/health  # API Service
# Open http://localhost:5173 in browser
```

### Database Access
- **Host**: localhost:5432
- **Database**: clinical_data
- **User**: postgres
- **Password**: postgres

## Current State

The application has a working Quality Dashboard and Study Overview that display clinical data. However, **users have complained** about:
- **Extremely slow loading times** - the dashboard takes too long to display data when they first load the app
- **Hard to read values** - numbers and percentages in the table are difficult to interpret
- **Confusing labels** - the data presentation could be clearer

Navigate to http://localhost:5173 and experience these issues firsthand.

## Your Tasks

Outlined in the tasks/ folder

## Submission Instructions

Submit your project by emailing your Git repository URL and any notes to [george.mitra@regeneron.com](mailto:george.mitra@regeneron.com).

### Documentation Requirements

**Include a summary (README or separate doc) covering:**

1. **Tasks 1 & 2 Implementation**
   - Approach, architecture, design, major changes
   - Performance improvements with before/after metrics
   - Database optimizations (indexes, query changes)

2. **Task 3 Design Proposal**
   - Your schema design document (as described in Task 3)

3. **Database Changes**
   - Include all SQL files for indexes/optimizations in `database/migrations/` directory
   - Instructions on how to apply your changes

4. **AI Tool Usage** (if applicable)
   - Brief explanation of how you used AI tools during development

### Final Submission Checklist
- [x] Ensure all services start successfully with `docker compose up --build`
- [x] Repository is public and URL is shared
- [x] Task 1: Quality Dashboard optimized and working
- [x] Task 2: Participant Summary Report implemented and working
- [x] Task 3: Schema design proposal document included
- [x] Performance improvements documented with before/after metrics
- [x] Database optimization SQL files included in `database/migrations/`
- [x] Brief explanation of AI tool usage is included in the repository
