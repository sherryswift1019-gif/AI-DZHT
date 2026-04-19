# LJ LLM Quality Judge Workflow

**Goal:** Use LLM-based evaluation to score test quality across 5 dimensions, identify weakest areas, and provide actionable improvement suggestions.

**Your Role:** You are a test quality auditor. You evaluate test suites not just by coverage numbers, but by the actual quality of the tests — are they testing the right things? Are the assertions meaningful? Would they catch real bugs?

---

## INITIALIZATION

### Configuration Loading

Load config from `{project-root}/_bmad/bmm/config.yaml` and resolve:

- `project_name`, `user_name`
- `communication_language`, `document_output_language`
- `implementation_artifacts`
- `date` as system-generated current datetime

### Paths

- `output_file` = `{implementation_artifacts}/tests/quality-evaluation-report.md`

### Context

- `project_context` = `**/project-context.md` (load if exists)
- `test_files` = scan `tests/` for test files
- `source_files` = corresponding source files being tested

---

## EXECUTION

### Step 0: Collect Test Files

Scan the test directory and collect:
- All test files matching patterns (`test_*.py`, `*.spec.ts`, `*.test.ts`)
- Their corresponding source files (inferred from imports/naming)

If too many files, ask user which module/suite to evaluate, or pick the most recently modified.

### Step 1: Evaluate Each Test File on 5 Dimensions

For each test file, score 1-5 on:

**1. Clarity (清晰度)**
- Test names describe behavior, not implementation
- Arrange-Act-Assert pattern visible
- No magic numbers; constants are named
- Score 1: `test1()`, `test_it()` — Score 5: `test_create_project_returns_201_with_valid_input()`

**2. Completeness (完整度)**
- Happy path covered
- At least 1 error path covered
- Boundary conditions tested
- Score 1: Only happy path — Score 5: Happy + error + boundary + concurrency

**3. Actionability (可操作性)**
- Failure message tells you WHAT failed and WHY
- Test is self-contained (doesn't require reading 5 other files)
- Can run independently (no order dependency)
- Score 1: `assert result` — Score 5: `assert response.status == 201, f"Expected 201, got {response.status} for valid project creation"`

**4. Assertion Quality (断言质量)**
- Asserts business outcomes, not implementation details
- Multiple assertions per scenario (not just status code)
- Negative assertions where relevant ("should NOT contain...")
- Score 1: `assert True` — Score 5: Asserts status + body + side effects + error messages

**5. Boundary Coverage (边界覆盖)**
- Empty/null inputs tested
- Min/max values tested
- Type mismatches handled
- Concurrent access considered
- Score 1: No boundaries — Score 5: Systematic boundary coverage

### Step 2: Compute Summary Scores

For each test file:
- Individual dimension scores (1-5)
- File quality score = average of 5 dimensions

For the entire suite:
- Suite average per dimension
- Overall suite score
- Weakest dimension (focus area for improvement)

### Step 3: Generate Improvement Suggestions

For each dimension scoring ≤ 3:
- Cite specific test examples that scored low
- Provide concrete rewrite suggestions
- Prioritize by impact (fixing assertion quality catches more bugs than fixing names)

### Step 4: Output Report

Generate `quality-evaluation-report.md`:

```markdown
# Test Quality Evaluation — {project_name}

## Overall Score: {X.X}/5.0

### Dimension Breakdown

| Dimension | Suite Avg | Weakest File | Strongest File |
|-----------|----------|-------------|---------------|
| Clarity | X.X | file.py (X) | file.py (X) |
| Completeness | X.X | ... | ... |
| Actionability | X.X | ... | ... |
| Assertion Quality | X.X | ... | ... |
| Boundary Coverage | X.X | ... | ... |

### Per-File Scores

| File | Clarity | Complete | Action | Assert | Boundary | Avg |
|------|---------|----------|--------|--------|----------|-----|
| test_auth.py | 4 | 3 | 4 | 2 | 3 | 3.2 |

## Top Improvement Opportunities

### 1. {Weakest dimension}: {specific issue}
**Current**: {code example}
**Suggested**: {improved code example}
**Impact**: {what bugs this would catch}

### 2. ...

## Strengths
[What the test suite does well — reinforce good patterns]
```

## Keep It Simple

**Do:**

- Cite specific code examples for every score
- Provide before/after code for improvement suggestions
- Focus on the top 3-5 actionable improvements
- Acknowledge what's already good

**Avoid:**

- Scoring without evidence (every score needs an example)
- Suggesting improvements that don't catch more bugs
- Perfectionism (3.5/5.0 is a good suite; focus on ≤2.0 areas)

## Output

Save report to: `{output_file}`

**Done!** Quality evaluation complete. Validate against `./checklist.md`.
