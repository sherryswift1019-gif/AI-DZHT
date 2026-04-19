# CI CI/CD Pipeline Workflow

**Goal:** Generate CI/CD pipeline configuration that integrates test automation, quality gates, and efficient parallel execution.

**Your Role:** You are a CI/CD engineer specializing in test infrastructure. You design pipelines that run the right tests at the right time — fast feedback on PRs, comprehensive validation before release, with smart caching and parallelization.

---

## INITIALIZATION

### Configuration Loading

Load config from `{project-root}/_bmad/bmm/config.yaml` and resolve:

- `project_name`, `user_name`
- `communication_language`, `document_output_language`
- `implementation_artifacts`
- `date` as system-generated current datetime

### Paths

- `output_file` = `{implementation_artifacts}/tests/cicd-pipeline-config.md`

### Context

- `project_context` = `**/project-context.md` (load if exists)
- `existing_ci` = check for `.github/workflows/`, `.gitlab-ci.yml`, `Jenkinsfile`
- `test_strategy` = from TS data (test pyramid, priority)
- `package_json` / `pyproject.toml` = detect test commands

---

## EXECUTION

### Step 0: Detect CI Platform and Test Stack

Identify:
1. CI platform: GitHub Actions (default), GitLab CI, Jenkins, CircleCI
2. Test frameworks: pytest, vitest, jest, playwright
3. Build tools: npm, pnpm, yarn, pip, poetry
4. Existing CI config (if any) — extend rather than replace

### Step 1: Design Pipeline Architecture

Two pipeline tiers:

**PR Gate (fast, on every push)**:
- Lint + type check
- Unit tests (via IT incremental selection if available)
- Build verification
- Target: < 5 minutes

**Full Regression (on merge to main / scheduled)**:
- All unit tests
- Integration tests
- Browser E2E tests (BE)
- Coverage report
- Quality gate check (QG thresholds)
- Target: < 15 minutes

### Step 2: Generate Pipeline Config

**GitHub Actions example**:

```yaml
name: CI
on:
  pull_request:
    branches: [main]
  push:
    branches: [main]
  schedule:
    - cron: '0 6 * * 1-5'  # Weekday mornings

jobs:
  pr-gate:
    if: github.event_name == 'pull_request'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4  # or setup-python
        with:
          cache: 'npm'
      - run: npm ci
      - run: npm run lint
      - run: npm run type-check
      - run: npm test -- --changed  # Incremental
    timeout-minutes: 5

  full-regression:
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    strategy:
      matrix:
        shard: [1, 2, 3]  # Parallel shards
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npm test -- --shard=${{ matrix.shard }}/3
      - uses: actions/upload-artifact@v4
        with:
          name: coverage-${{ matrix.shard }}
          path: coverage/

  e2e:
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npx playwright install --with-deps chromium
      - run: npx playwright test
      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: e2e-screenshots
          path: test-results/

  quality-gate:
    needs: [full-regression, e2e]
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - run: echo "Check pass rate >= 95%, coverage >= 70%"
      # Integrate with QG command results
```

### Step 3: Add Optimizations

- **Caching**: Node modules, pip cache, Playwright browsers
- **Parallelization**: Test sharding for large suites
- **Conditional E2E**: Only run browser tests if frontend changed
- **PR comments**: Post test summary as PR comment

### Step 4: Output

Generate pipeline config file and documentation:

```markdown
# CI/CD Pipeline Configuration — {project_name}

## Architecture
[Diagram of pipeline tiers]

## PR Gate
[Config + what it runs + expected duration]

## Full Regression
[Config + sharding strategy + coverage aggregation]

## Quality Gate Integration
[How QG thresholds are enforced in CI]

## Optimization Notes
[Caching, parallelization, conditional execution]
```

## Keep It Simple

**Do:**

- Start with PR gate (most impact per effort)
- Use the project's existing CI platform
- Cache aggressively (node_modules, pip, browsers)
- Keep PR gate under 5 minutes

**Avoid:**

- Over-engineering pipeline for small projects
- Running E2E on every PR (too slow, save for main)
- Complex matrix strategies when simple sharding works
- Secrets in pipeline config (use CI platform secrets)

## Output

Save config and docs to: `{output_file}`
Save pipeline YAML to appropriate location (`.github/workflows/`, etc.)

**Done!** CI/CD pipeline configured. Validate against `./checklist.md`.
