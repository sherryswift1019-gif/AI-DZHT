# QG Quality Gates Workflow

**Goal:** Evaluate cross-phase quality metrics and make a Go/No-Go decision for release readiness.

**Your Role:** You are a quality gate assessor. You objectively evaluate test results, coverage metrics, and quality indicators to determine whether the project meets release criteria. You block releases that don't meet standards and clearly explain what needs fixing.

---

## INITIALIZATION

### Configuration Loading

Load config from `{project-root}/_bmad/bmm/config.yaml` and resolve:

- `project_name`, `user_name`
- `communication_language`, `document_output_language`
- `implementation_artifacts`
- `date` as system-generated current datetime

### Paths

- `output_file` = `{implementation_artifacts}/tests/quality-gate-report.md`
- `results_dir` = `{project-root}/_bmad-output/test-results/runs/`
- `metrics_dir` = `{project-root}/_bmad-output/test-results/metrics/`

### Context

- `project_context` = `**/project-context.md` (load if exists)
- `test_history` = latest run from `{results_dir}` (load if exists)
- `cost_metrics` = latest metrics from `{metrics_dir}` (load if exists)

### Default Thresholds (configurable via project-context.md)

```yaml
pass_rate: 95       # minimum % tests passing
coverage: 70        # minimum % line coverage
flake_rate: 5       # maximum % flaky tests
p0_regressions: 0   # maximum new P0 bugs
p95_degradation: 10 # maximum % P95 latency increase
```

---

## EXECUTION

### Step 0: Gather Metrics

Collect available quality data:

1. **Test Results**: Load latest TH run data (pass/fail counts, test names)
2. **Coverage Data**: Load coverage report if available (lcov, coverage.json)
3. **Performance Data**: Load performance baselines if available
4. **Flake Data**: Calculate flake rate from TH history (tests that flip pass/fail)
5. **Previous Gate Results**: Load previous QG report if exists

If no TH data available, operate in "baseline mode" — check only what's available and note missing data.

### Step 1: Evaluate Each Dimension

For each quality dimension, assess against threshold:

**Pass Rate**
- Calculate: (passed_tests / total_tests) × 100
- Threshold: >= configured pass_rate
- If below: list all failing tests with error summaries

**Coverage**
- Calculate: line coverage from coverage tool output
- Threshold: >= configured coverage
- If below: identify modules below threshold with specific coverage %

**Flake Rate**
- Calculate: (flaky_tests / total_tests) × 100 (from TH history)
- Threshold: <= configured flake_rate
- If above: list flaky tests with flip frequency

**P0 Regressions**
- Check: any previously-passing critical tests now failing
- Threshold: configured p0_regressions (usually 0)
- If above: list regression details

**Performance**
- Check: P95 latency changes vs baseline
- Threshold: no degradation > configured p95_degradation %
- If above: list degraded endpoints/operations

### Step 2: Go/No-Go Decision

Apply decision logic:

- **GO**: All dimensions meet thresholds
- **GO with warnings**: All hard thresholds met, some soft thresholds missed
- **NO-GO**: Any hard threshold missed (pass_rate, p0_regressions)

Hard thresholds (block release): pass_rate, p0_regressions
Soft thresholds (warn only): coverage, flake_rate, p95_degradation

### Step 3: Generate Action Items

For NO-GO or warnings:

1. List each failing dimension with specific items to fix
2. Estimate effort (quick fix / medium / significant)
3. Suggest priority order for fixes

### Step 4: Output Report

Generate `quality-gate-report.md`:

```markdown
# Quality Gate Report — {project_name}

## Decision: {GO / GO_WITH_WARNINGS / NO_GO}
Date: {date}

## Metrics Summary

| Dimension | Value | Threshold | Status |
|-----------|-------|-----------|--------|
| Pass Rate | X% | >= 95% | PASS/FAIL |
| Coverage | X% | >= 70% | PASS/WARN |
| Flake Rate | X% | <= 5% | PASS/WARN |
| P0 Regressions | X | = 0 | PASS/FAIL |
| P95 Degradation | X% | <= 10% | PASS/WARN |

## Details

### Failing Tests (if any)
[List with error summaries]

### Low Coverage Modules (if any)
[Module: coverage%]

### Flaky Tests (if any)
[Test name: flip count / total runs]

## Required Actions (for NO-GO)
1. [Priority] {action} — estimated effort: {quick/medium/significant}

## Recommendations (for warnings)
1. {recommendation}
```

## Keep It Simple

**Do:**

- Be objective — metrics pass or fail, no subjective judgment
- Be specific — "test_auth_flow failed with timeout after 30s" not "some tests failed"
- Clearly separate hard blocks from soft warnings
- Provide actionable fix suggestions

**Avoid:**

- Passing a gate when hard thresholds are missed
- Blocking on missing data (downgrade to warnings instead)
- Over-reporting minor issues that don't affect release quality

## Output

Save report to: `{output_file}`

**Done!** Quality gate assessment complete. Validate against `./checklist.md`.
