# TH Test Result Persistence Workflow

**Goal:** Persist test results in a standardized format and generate historical comparison reports to track quality trends over time.

**Your Role:** You are a test results analyst. You standardize, store, and compare test results across runs, helping the team understand quality trends, detect regressions, and celebrate improvements.

---

## INITIALIZATION

### Configuration Loading

Load config from `{project-root}/_bmad/bmm/config.yaml` and resolve:

- `project_name`, `user_name`
- `communication_language`, `document_output_language`
- `implementation_artifacts`
- `date` as system-generated current datetime

### Paths

- `results_dir` = `{project-root}/_bmad-output/test-results/runs/`
- `output_file` = `{implementation_artifacts}/tests/test-comparison-report.md`

### Setup

Ensure `results_dir` exists (create if needed).

---

## EXECUTION

### Step 0: Detect Test Results

Look for test results from:

1. **Recent test run output** — if QA/BE command just ran, parse its output
2. **pytest output** — look for pytest terminal output format
3. **vitest/jest output** — look for JS test framework output format
4. **JUnit XML** — look for `*.xml` test reports
5. **Coverage JSON** — look for coverage.json, lcov.info

If no results found, ask the user to:
- Run tests and share output, OR
- Point to a test results file

### Step 1: Parse to Standard Format

Normalize results to a standard record format:

```json
{
  "schema_version": 1,
  "run_id": "{timestamp}-{short_hash}",
  "timestamp": "ISO 8601",
  "project": "{project_name}",
  "framework": "pytest|vitest|jest|playwright",
  "total": 0,
  "passed": 0,
  "failed": 0,
  "skipped": 0,
  "duration_ms": 0,
  "tests": [
    {
      "name": "test_function_name",
      "suite": "test_file_or_describe_block",
      "status": "passed|failed|skipped",
      "duration_ms": 0,
      "error_message": null
    }
  ]
}
```

### Step 2: Persist Results

Save to `{results_dir}/{run_id}.json`.

Keep at most 20 historical runs. If more exist, delete the oldest.

### Step 3: Load Previous Run

Load the most recent previous run from `{results_dir}/` (excluding current).

If no previous run exists, skip comparison and note this is the baseline run.

### Step 4: Generate Comparison

Compare current vs previous run:

- **New tests**: tests in current but not in previous
- **Removed tests**: tests in previous but not in current
- **Regressions**: tests that passed before but fail now
- **Improvements**: tests that failed before but pass now
- **Duration changes**: tests with >20% duration change
- **Overall metrics**: pass rate change, total count change, duration change

### Step 5: Output Report

Generate `test-comparison-report.md`:

```markdown
# Test Results — {project_name}

## Run: {run_id}
Date: {timestamp}
Framework: {framework}

## Summary

| Metric | Current | Previous | Change |
|--------|---------|----------|--------|
| Total Tests | X | X | +/-X |
| Pass Rate | X% | X% | +/-X% |
| Duration | Xs | Xs | +/-Xs |

## Regressions (X)
[List of tests that went from pass → fail, with error messages]

## Improvements (X)
[List of tests that went from fail → pass]

## New Tests (X)
[List of newly added tests]

## Duration Changes
[Tests with >20% duration change]

## Failing Tests
[Complete list of currently failing tests with errors]
```

## Keep It Simple

**Do:**

- Auto-detect test framework and parse results automatically
- Highlight regressions prominently (they need immediate attention)
- Keep historical data compact (20 runs max)
- Include error messages for failing tests (essential for debugging)

**Avoid:**

- Storing raw test output (too large, parse to standard format)
- Complex aggregation across many runs (keep it current vs previous)
- Duplicating results already visible in CI logs

## Output

Save report to: `{output_file}`
Save results to: `{results_dir}/{run_id}.json`

**Done!** Test results persisted and compared. Validate against `./checklist.md`.
