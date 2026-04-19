# FD Flake Detection Workflow

**Goal:** Detect flaky tests from historical TH data, diagnose root causes, and recommend targeted fixes or retry strategies.

**Your Role:** You are a test reliability engineer. Flaky tests are worse than no tests — they erode developer trust, waste CI time, and mask real failures. You find them, explain why they flake, and prescribe fixes.

---

## INITIALIZATION

### Configuration Loading

Load config from `{project-root}/_bmad/bmm/config.yaml` and resolve:

- `project_name`, `user_name`
- `communication_language`, `document_output_language`
- `implementation_artifacts`
- `date` as system-generated current datetime

### Paths

- `output_file` = `{implementation_artifacts}/tests/flake-detection-report.md`
- `results_dir` = `{project-root}/_bmad-output/test-results/runs/`

### Context

- `project_context` = `**/project-context.md` (load if exists)
- `test_history` = all runs from TH data

### Prerequisites

- Minimum 3 TH historical runs recommended for meaningful flake detection
- Without history, can do static analysis for flaky patterns

---

## EXECUTION

### Step 0: Load Test History

Load all TH run data and build per-test timeline:

```
test_auth_login:    PASS PASS PASS PASS PASS  → stable
test_async_flow:    PASS FAIL PASS PASS FAIL  → flaky (40%)
test_db_migration:  PASS PASS FAIL PASS PASS  → possible flake (20%)
```

### Step 1: Calculate Flake Rate

For each test:
- `flip_count` = number of times result changed (PASS→FAIL or FAIL→PASS)
- `flake_rate` = flip_count / (total_runs - 1)
- Mark as flaky if `flake_rate > 0.1` (10%)

Sort by flake rate descending.

### Step 2: Diagnose Root Causes

For each flaky test, analyze the test code for common patterns:

| Pattern | Detection | Fix |
|---------|-----------|-----|
| **Timing dependency** | `sleep()`, `setTimeout()`, hardcoded delays | Use polling/waitFor with timeout |
| **External service** | HTTP calls to real APIs | Mock external services |
| **Shared state** | Global variables, shared DB records | Isolate test data |
| **Order dependency** | Fails only when run after specific test | Make tests independent |
| **Resource contention** | Port binding, file locks | Use dynamic ports, temp files |
| **Time dependency** | `Date.now()`, timezone-sensitive | Freeze time in tests |
| **Race condition** | Async operations without proper awaits | Add proper synchronization |

Read the test source code and classify the likely root cause.

### Step 3: Recommend Fixes

For each flaky test, provide:

1. **Root cause category** (from table above)
2. **Evidence** (specific line in test code)
3. **Fix suggestion** (concrete code change)
4. **Priority** (based on flake rate × test importance)

### Step 4: Optional Retry Verification

If user requests `--verify`, re-run each suspected flaky test 5 times:
- If all pass → may be fixed by recent changes, downgrade
- If any fail → confirmed flaky, upgrade priority

### Step 5: Output Report

Generate `flake-detection-report.md`:

```markdown
# Flake Detection Report — {project_name}

## Summary
- Tests analyzed: {total}
- Flaky (>10%): {count}
- Suspected (5-10%): {count}
- Stable (<5%): {count}
- **Suite Reliability: {100 - avg_flake_rate}%**

## Flaky Tests (sorted by flake rate)

### 1. test_async_flow — Flake Rate: 40%
**Timeline**: PASS FAIL PASS PASS FAIL
**Root Cause**: Timing dependency
**Evidence**: Line 15 uses `await sleep(100)` which is insufficient for CI environments
**Fix**:
```python
# Before
await asyncio.sleep(0.1)
assert result.status == 'complete'

# After
await wait_for(lambda: result.status == 'complete', timeout=5.0)
```
**Priority**: HIGH (blocks CI regularly)

### 2. ...

## Stable Tests
[Count and brief note that these are healthy]

## Recommendations
1. Fix top 3 flaky tests — estimated 2 hours, saves ~30 min/day CI time
2. Add retry strategy for external-service tests: `@pytest.mark.flaky(reruns=2)`
3. Consider quarantining {test_name} until fixed
```

## Keep It Simple

**Do:**

- Prioritize by impact (high flake rate × frequently run)
- Provide copy-paste fix code when possible
- Distinguish "confirmed flaky" from "suspected" based on data
- Track improvement over time (reference previous FD reports)

**Avoid:**

- Recommending blanket retries (masks root causes)
- Flagging tests with 1 failure in 20 runs as flaky (may be a real bug)
- Complex statistical analysis when simple flip counting works

## Output

Save report to: `{output_file}`

**Done!** Flake detection complete. Validate against `./checklist.md`.
