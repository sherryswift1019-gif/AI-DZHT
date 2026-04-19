# RS Regression Suite Strategy Workflow

**Goal:** Analyze the health of the regression test suite, identify tests that should be retired, and curate a P0 core test set for smoke testing.

**Your Role:** You are a test suite curator. Tests are a living asset that accumulates debt — you maintain suite health by retiring valueless tests, identifying flaky ones, and ensuring the core regression set stays lean and effective.

---

## INITIALIZATION

### Configuration Loading

Load config from `{project-root}/_bmad/bmm/config.yaml` and resolve:

- `project_name`, `user_name`
- `communication_language`, `document_output_language`
- `implementation_artifacts`
- `date` as system-generated current datetime

### Paths

- `output_file` = `{implementation_artifacts}/tests/regression-suite-report.md`
- `results_dir` = `{project-root}/_bmad-output/test-results/runs/`

### Context

- `project_context` = `**/project-context.md` (load if exists)
- `test_history` = all runs from `{results_dir}/` (TH data)
- `test_files` = scan test directory

### Prerequisites

- TH (Test History) data recommended — at least 3 historical runs for meaningful analysis
- Without history, analysis is limited to static evaluation

---

## EXECUTION

### Step 0: Load Historical Data

Load all available TH run data. For each test, compute:

- Total runs
- Pass count / fail count
- Flake rate (pass/fail flip frequency)
- Average duration
- Last modification date (from git)
- Last failure date

### Step 1: Score Each Test

Score each test on 4 dimensions:

**1. Failure Signal Value (0-5)**
- 0: Never failed in any recorded run (possibly stale)
- 1: Failed once long ago
- 3: Fails occasionally, catching real bugs
- 5: Recent failure that caught a real regression

**2. Execution Cost (0-5, inverted — lower cost = higher score)**
- 5: < 100ms
- 3: 100ms - 1s
- 1: 1s - 10s
- 0: > 10s (expensive test)

**3. Unique Coverage (0-5)**
- 5: Tests functionality no other test covers
- 3: Some overlap but adds boundary/error scenarios
- 1: Completely covered by other tests
- 0: Tests trivial code (getters, toString)

**4. Maintenance Burden (0-5, inverted — lower burden = higher score)**
- 5: Stable, never needed fixes
- 3: Occasional flakiness, fixed quickly
- 1: Frequently breaks on unrelated changes
- 0: Flaky + hard to debug

**Health Score** = sum of 4 dimensions (0-20)

### Step 2: Classify Tests

| Category | Score Range | Action |
|----------|------------|--------|
| **Core (P0)** | 15-20 | Must run on every PR — smoke test set |
| **Standard** | 8-14 | Run in full regression, skip in quick mode |
| **Review** | 4-7 | Consider improving or retiring |
| **Retire** | 0-3 | Recommend for retirement |

### Step 3: Generate P0 Smoke Test Set

Select the minimum set of tests that:
- Cover all critical business flows
- Run in under 60 seconds total
- Have near-zero flake rate
- Provide maximum failure signal per time invested

### Step 4: Generate Retirement Suggestions

For each test in "Retire" category:
- Why: specific reasons (never fails, fully covered by another test, tests trivial code)
- Impact: what coverage would be lost (usually none)
- Alternative: which test already covers this functionality

### Step 5: Output Report

Generate `regression-suite-report.md`:

```markdown
# Regression Suite Report — {project_name}

## Suite Health Score: {X}/100

| Category | Count | % of Suite |
|----------|-------|-----------|
| Core (P0) | X | X% |
| Standard | X | X% |
| Review | X | X% |
| Retire | X | X% |

## P0 Smoke Test Set ({X} tests, ~{Y}s total)

| Test | Score | Duration | Coverage |
|------|-------|----------|----------|
| test_auth_login | 18 | 0.2s | Authentication flow |
| test_create_project | 17 | 0.5s | Core CRUD |

## Retirement Recommendations ({X} tests)

| Test | Score | Reason | Covered By |
|------|-------|--------|-----------|
| test_util_format | 2 | Never failed, trivial | test_api_response |

## Improvement Suggestions ({X} tests in Review)

| Test | Score | Issue | Suggestion |
|------|-------|-------|-----------|
| test_async_flow | 5 | Flaky (15%) | Fix timing dependency |

## Trends (if history available)
- Suite size: {trend over last 5 runs}
- Average duration: {trend}
- Flake rate: {trend}
```

## Keep It Simple

**Do:**

- Base decisions on data, not gut feeling
- Be conservative with retirement (suggest, don't force)
- Keep P0 set small (10-15 tests max for medium project)
- Show clear reasoning for every recommendation

**Avoid:**

- Retiring tests without confirming coverage overlap
- Including flaky tests in P0 set (defeats the purpose)
- Complex scoring that can't be explained to a developer

## Output

Save report to: `{output_file}`

**Done!** Regression suite analyzed. Validate against `./checklist.md`.
