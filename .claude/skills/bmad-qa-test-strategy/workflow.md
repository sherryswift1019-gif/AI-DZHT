# TS Test Strategy Workflow

**Goal:** Generate a comprehensive test strategy with risk matrix, test pyramid planning, and requirements traceability mapping.

**Your Role:** You are a senior QA strategist. You analyze the project's requirements, architecture, and codebase to produce a risk-driven test strategy that guides all subsequent testing activities.

---

## INITIALIZATION

### Configuration Loading

Load config from `{project-root}/_bmad/bmm/config.yaml` and resolve:

- `project_name`, `user_name`
- `communication_language`, `document_output_language`
- `implementation_artifacts`
- `date` as system-generated current datetime
- YOU MUST ALWAYS SPEAK OUTPUT in your Agent communication style with the config `{communication_language}`

### Paths

- `output_file` = `{implementation_artifacts}/tests/test-strategy.md`

### Context

- `project_context` = `**/project-context.md` (load if exists)
- `prd` = `**/prd.md` (load if exists, critical input)
- `architecture` = `**/system-architecture.md` (load if exists, critical input)
- `code_context` = from WorkspaceManager.build_code_context (if available)

---

## EXECUTION

### Step 0: Context Analysis

Load and analyze all available context:

- PRD: Extract functional requirements, acceptance criteria, business-critical features
- Architecture: Extract modules, dependencies, integration points, external services
- Code Structure: Identify high-complexity modules, frequently changed files (via git log if accessible)
- Project Context: Extract tech stack, constraints, known issues

If PRD or architecture is missing, ask the user for key information about:
- Core business features (ranked by importance)
- Tech stack and architecture overview
- Known risk areas

### Step 1: Requirements Traceability Matrix

For each functional requirement in the PRD:

1. Assign a requirement ID (REQ-001, REQ-002, ...)
2. Map to test types needed: Unit / Integration / E2E
3. Estimate test count per type
4. Link to responsible module/component

Output as a table:

| REQ ID | Requirement | Module | Unit | Integration | E2E | Priority |
|--------|-------------|--------|------|-------------|-----|----------|

### Step 2: Risk Matrix

Evaluate each module/component on 3 dimensions:

- **Complexity**: Code size, cyclomatic complexity, number of dependencies
- **Change Frequency**: How often this module changes (from git history or estimation)
- **Business Impact**: How critical this is to core user workflows (from PRD)

Score each dimension 1-5, compute Risk = Complexity x ChangeFreq x Impact.

Output as a risk matrix table:

| Module | Complexity | Change Freq | Business Impact | Risk Score | Test Priority |
|--------|-----------|-------------|-----------------|------------|---------------|

Sort by Risk Score descending. Top modules get the most test investment.

### Step 3: Test Pyramid Planning

Based on risk analysis, plan the test distribution:

- **Unit Tests**: Target 60-70% of total. Focus on high-complexity, high-risk modules. Each public function with business logic.
- **Integration Tests**: Target 20-30%. Focus on module boundaries, API contracts, database operations, external service integrations.
- **E2E Tests**: Target 5-15%. Focus on critical user journeys only (max 10 E2E tests for a medium project).

For each layer, specify:
- What to test (specific modules/features)
- What NOT to test (trivial getters, framework code)
- Mock strategy (what to mock at each layer)
- Estimated count

### Step 4: Test Data Strategy

Identify data requirements:

- Core entities needed for tests
- Fixture strategy: factory functions vs static fixtures
- Data isolation approach: transaction rollback, dedicated test DB, or namespace isolation
- External service mocking strategy

### Step 5: Output Strategy Document

Generate `test-strategy.md` with sections:

```markdown
# Test Strategy — {project_name}

## 1. Executive Summary
[2-3 sentences: project context, risk assessment, recommended approach]

## 2. Requirements Traceability Matrix
[Table from Step 1]

## 3. Risk Matrix
[Table from Step 2]

## 4. Test Pyramid
### 4.1 Unit Tests
[Scope, targets, estimated count]
### 4.2 Integration Tests
[Scope, targets, estimated count]
### 4.3 E2E Tests
[Critical paths only, estimated count]

## 5. Test Data Strategy
[Fixtures, mocking, isolation]

## 6. Execution Plan
[Suggested order, dependencies, CI integration notes]

## 7. Quality Targets
- Pass Rate: >= 95%
- Coverage: >= 70% (lines)
- Flake Rate: < 5%
- E2E Ratio: <= 15% of total tests
```

## Keep It Simple

**Do:**

- Focus on risk — highest risk modules get the most tests
- Be specific — "test the approval flow in workflow_engine.py" not "test the backend"
- Be actionable — every recommendation should be directly executable
- Reference actual code paths and module names

**Avoid:**

- Generic statements like "comprehensive testing is important"
- Over-planning — this is a strategy, not a test plan with every test case
- Recommending more E2E tests than necessary (they're expensive)

## Output

Save strategy to: `{output_file}`

**Done!** Test strategy generated. Validate against `./checklist.md`.
