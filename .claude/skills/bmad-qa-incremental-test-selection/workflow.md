# IT Incremental Test Selection Workflow

**Goal:** Analyze git diff to intelligently select only the tests affected by recent changes, reducing test execution time while maintaining confidence.

**Your Role:** You are a test optimization engineer. You understand the dependency graph between source code and tests, and you use this knowledge to skip irrelevant tests while ensuring no regression goes undetected.

---

## INITIALIZATION

### Configuration Loading

Load config from `{project-root}/_bmad/bmm/config.yaml` and resolve:

- `project_name`, `user_name`
- `communication_language`, `document_output_language`
- `implementation_artifacts`
- `date` as system-generated current datetime

### Paths

- `touchfiles_path` = `{project-root}/_bmad-output/test-results/touchfiles.json`
- `output_file` = `{implementation_artifacts}/tests/test-selection-report.md`

---

## EXECUTION

### Step 0: Load or Build Touchfiles Mapping

A "touchfile" maps each test file to the source files it depends on.

**If `touchfiles.json` exists**: Load it.

**If not**: Build it by scanning the test directory:

1. Find all test files (`test_*.py`, `*.spec.ts`, `*.test.ts`, etc.)
2. For each test file, analyze imports and references to determine which source files it tests
3. Build mapping: `{ "tests/test_auth.py": ["src/auth.py", "src/models/user.py"] }`
4. Also add glob patterns for broader matching: `{ "tests/test_api_*.py": ["src/api/**"] }`
5. Save to `touchfiles.json`

### Step 1: Get Changed Files

Detect changes via git:

- Default: `git diff --name-only HEAD` (uncommitted changes)
- If no uncommitted changes: `git diff --name-only HEAD~1` (last commit)
- User can specify: `main...HEAD` (all changes in branch)

Filter to relevant file types (ignore .md, .gitignore, etc. unless test-related).

### Step 2: Match Changes to Tests

For each changed file:

1. Direct match: Is the changed file itself a test? → Select it
2. Dependency match: Which tests import/reference this file? → Select them
3. Glob match: Does the file match any test's glob pattern? → Select those tests
4. Transitive match: If a shared utility changed, select tests that use it

### Step 3: Apply Safety Rules

- If >80% of tests selected, suggest running all tests instead (changes too broad)
- If configuration files changed (package.json, tsconfig, pyproject.toml), run all tests
- If test utilities/fixtures changed, select all tests that use them
- Always include any test that was previously flaky (from TH history if available)

### Step 4: Generate Selection Report

Output `test-selection-report.md`:

```markdown
# Incremental Test Selection — {project_name}

## Changes Detected
- {file1} (modified)
- {file2} (added)

## Selected Tests ({X} of {Y} total)

| Test File | Trigger | Reason |
|-----------|---------|--------|
| tests/test_auth.py | src/auth.py | Direct dependency |
| tests/test_api.py | src/models/*.py | Glob match |

## Skipped Tests ({Z})
[List with reason: "No dependency on changed files"]

## Estimated Time Savings
- Full suite: ~{X}s
- Selected only: ~{Y}s
- Savings: ~{Z}% faster
```

### Step 5: Execute (Optional)

If user requests `--run`, execute the selected tests using the project's test command.

Capture output for TH persistence.

## Keep It Simple

**Do:**

- Err on the side of selecting more tests (false positive > false negative)
- Keep touchfiles.json updated when new tests are added
- Show clear reasoning for each selection

**Avoid:**

- Complex static analysis (import scanning is sufficient)
- Skipping tests when unsure about dependencies
- Running 0 tests (always include at least a smoke test)

## Output

Save report to: `{output_file}`
Update touchfiles: `{touchfiles_path}`

**Done!** Test selection complete. Validate against `./checklist.md`.
