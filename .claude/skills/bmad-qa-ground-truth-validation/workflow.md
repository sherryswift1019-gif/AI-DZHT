# GT Ground Truth Validation Workflow

**Goal:** Evaluate the test suite's real bug-detection ability by running tests against known planted defects and measuring detection rate.

**Your Role:** You are a test effectiveness analyst. Coverage percentages lie — a test can "cover" code without actually detecting bugs in it. You plant known defects and measure whether the test suite catches them, providing a true measure of detection capability.

---

## INITIALIZATION

### Configuration Loading

Load config from `{project-root}/_bmad/bmm/config.yaml` and resolve:

- `project_name`, `user_name`
- `communication_language`, `document_output_language`
- `implementation_artifacts`
- `date` as system-generated current datetime

### Paths

- `output_file` = `{implementation_artifacts}/tests/ground-truth-validation-report.md`
- `bugs_file` = `{project-root}/tests/fixtures/planted-bugs.json`

### Context

- `project_context` = `**/project-context.md` (load if exists)
- `test_files` = scan test directory

---

## EXECUTION

### Step 0: Load or Generate Planted Bugs

**If `planted-bugs.json` exists**: Load it.

**If not**: Generate a set of realistic planted bugs based on the codebase:

```json
{
  "schema_version": 1,
  "bugs": [
    {
      "id": "BUG-001",
      "category": "off-by-one",
      "severity": "major",
      "target_file": "src/workflow_engine.py",
      "target_function": "execute_step",
      "description": "Change >= to > in step index comparison",
      "detection_hint": "Should cause last step to be skipped",
      "mutation": {
        "original": "if step_idx >= len(steps):",
        "mutated": "if step_idx > len(steps):"
      }
    }
  ]
}
```

Bug categories to include:
- **Off-by-one**: Index errors, boundary conditions
- **Logic inversion**: `>` vs `<`, `and` vs `or`, `==` vs `!=`
- **Missing null check**: Remove null/undefined guards
- **Wrong return**: Return wrong value or status code
- **State corruption**: Skip state update or update wrong field

Generate 5-10 bugs targeting high-risk modules.

### Step 1: Apply Mutations and Run Tests

For each planted bug:

1. Apply the mutation to a temporary copy of the source file
2. Run the test suite (or relevant subset from IT)
3. Record which tests fail (True Positives) and which pass (False Negatives)
4. Restore original source

**Safety**: Never modify the actual source files. Use temporary copies or in-memory patching.

### Step 2: Analyze Detection Results

For each bug, classify:

- **True Positive (TP)**: Test failed, correctly detecting the bug
- **False Negative (FN)**: All tests passed despite the bug existing
- **Evidence quality**: Did the test failure message clearly point to the bug?

Calculate:
- `detection_rate` = TP / (TP + FN)
- `evidence_quality` = % of TPs with clear failure messages

### Step 3: Identify Gaps

For each undetected bug (FN):
- Which test file SHOULD have caught it?
- What assertion is missing?
- Suggest a specific test to add

### Step 4: Output Report

Generate `ground-truth-validation-report.md`:

```markdown
# Ground Truth Validation — {project_name}

## Detection Summary
- Planted bugs: {total}
- Detected (TP): {tp}
- Missed (FN): {fn}
- **Detection Rate: {rate}%**
- Evidence Quality: {quality}%

## Per-Bug Results

| Bug ID | Category | Severity | Target | Detected | Detecting Test |
|--------|----------|----------|--------|----------|---------------|
| BUG-001 | off-by-one | major | workflow_engine.py | YES | test_step_execution |
| BUG-002 | logic | critical | auth.py | NO | — |

## Undetected Bugs — Recommended Tests

### BUG-002: Logic inversion in auth.py
**Mutation**: Changed `role == 'admin'` to `role != 'admin'`
**Why missed**: No test verifies admin-only access restriction
**Suggested test**:
```python
def test_non_admin_cannot_access_admin_endpoint():
    response = client.get("/admin/users", headers=user_headers)
    assert response.status_code == 403
```

## Conclusions
- Suite is strong at detecting: {categories with high TP}
- Suite is weak at detecting: {categories with high FN}
- Priority: Add tests for {highest-impact undetected category}
```

## Keep It Simple

**Do:**

- Generate realistic bugs that mirror real-world defects
- Target high-risk modules (not trivial code)
- Provide specific test code to fix each gap
- Use safe mutation (never modify actual source)

**Avoid:**

- Planting more than 10 bugs (diminishing returns)
- Trivial mutations that no reasonable test would catch (e.g., changing whitespace)
- Complex multi-line mutations that conflate multiple issues

## Output

Save report to: `{output_file}`
Save (or update) planted bugs to: `{bugs_file}`

**Done!** Ground truth validation complete. Validate against `./checklist.md`.
