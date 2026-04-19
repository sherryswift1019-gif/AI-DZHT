# CT Cost & Performance Tracking Workflow

**Goal:** Track test execution cost (time, tokens, API calls) and detect performance regressions by comparing against rolling averages.

**Your Role:** You are a test efficiency analyst. You monitor the cost of running tests (both computational and monetary) and alert when costs spike unexpectedly, helping teams keep their test infrastructure lean.

---

## INITIALIZATION

### Configuration Loading

Load config from `{project-root}/_bmad/bmm/config.yaml` and resolve:

- `project_name`, `user_name`
- `communication_language`, `document_output_language`
- `implementation_artifacts`
- `date` as system-generated current datetime

### Paths

- `metrics_dir` = `{project-root}/_bmad-output/test-results/metrics/`
- `output_file` = `{implementation_artifacts}/tests/cost-performance-report.md`

### Setup

Ensure `metrics_dir` exists (create if needed).

---

## EXECUTION

### Step 0: Collect Current Run Metrics

From the most recent test run (or current execution), collect:

- **Duration**: Total wall-clock time, per-suite times, per-test times
- **Token Usage**: If LLM-based testing, count input/output tokens
- **API Calls**: Number of external API calls (LLM calls, test target API calls)
- **Resource Usage**: Memory peak, CPU time (if measurable)

If some metrics are unavailable, record what's available and note gaps.

### Step 1: Persist Metrics

Save to `{metrics_dir}/{run_id}-metrics.json`:

```json
{
  "schema_version": 1,
  "run_id": "{timestamp}-{short_hash}",
  "timestamp": "ISO 8601",
  "project": "{project_name}",
  "total_duration_ms": 0,
  "total_tokens": 0,
  "total_api_calls": 0,
  "estimated_cost_usd": 0.0,
  "suites": [
    {
      "name": "suite_name",
      "duration_ms": 0,
      "test_count": 0,
      "tokens": 0,
      "api_calls": 0
    }
  ]
}
```

Keep at most 20 historical metric files.

### Step 2: Load Historical Data

Load the last 5 metric runs from `{metrics_dir}/`.

Calculate rolling averages for:
- Total duration
- Token usage
- API call count
- Estimated cost

### Step 3: Detect Anomalies

Flag any metric that exceeds thresholds vs rolling 5-run average:

- Duration increase > 20% → Warning
- Token usage increase > 30% → Warning
- API call increase > 50% → Alert
- Cost increase > 30% → Warning

For each anomaly, identify the likely cause:
- Which suite/test contributed most to the increase?
- Was it a new test added, or an existing test slowing down?

### Step 4: Output Report

Generate `cost-performance-report.md`:

```markdown
# Cost & Performance Report — {project_name}

## Current Run: {run_id}
Date: {timestamp}

## Summary

| Metric | Current | Avg (5 runs) | Change | Status |
|--------|---------|-------------|--------|--------|
| Duration | Xs | Xs | +X% | OK/WARN |
| Tokens | X | X | +X% | OK/WARN |
| API Calls | X | X | +X% | OK/ALERT |
| Est. Cost | $X.XX | $X.XX | +X% | OK/WARN |

## Anomalies (if any)
- [WARN] Duration increased 25% — test_heavy_operation added 3s
- [ALERT] API calls doubled — new integration test suite making live calls

## Per-Suite Breakdown

| Suite | Duration | Tests | Tokens | Cost |
|-------|----------|-------|--------|------|
| backend_api | Xs | X | X | $X.XX |
| frontend_e2e | Xs | X | X | $X.XX |

## Trend (last 5 runs)
[Simple text-based trend showing direction]

## Optimization Suggestions
- [If duration high] Consider parallelizing suite X
- [If tokens high] Review prompt length in LLM-based tests
- [If API calls high] Add mocking for external service calls
```

## Keep It Simple

**Do:**

- Track what's available, don't block on missing metrics
- Focus on trends and anomalies, not absolute numbers
- Provide actionable optimization suggestions for anomalies

**Avoid:**

- Complex cost modeling (simple token × price is sufficient)
- Tracking metrics that don't lead to actionable insights
- Alerting on normal variance (20% threshold prevents noise)

## Output

Save report to: `{output_file}`
Save metrics to: `{metrics_dir}/{run_id}-metrics.json`

**Done!** Cost and performance tracked. Validate against `./checklist.md`.
