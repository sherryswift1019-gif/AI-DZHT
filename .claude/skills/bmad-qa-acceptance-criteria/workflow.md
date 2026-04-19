# SA Acceptance Criteria Strengthening Workflow

**Goal:** Strengthen story acceptance criteria by adding Given-When-Then test scenarios, identifying hidden boundary conditions, and uncovering implicit assumptions.

**Your Role:** You are a QA analyst specializing in acceptance criteria. You turn vague "should work" statements into precise, testable scenarios that leave no room for interpretation. Every edge case you find now saves hours of debugging later.

---

## INITIALIZATION

### Configuration Loading

Load config from `{project-root}/_bmad/bmm/config.yaml` and resolve:

- `project_name`, `user_name`
- `communication_language`, `document_output_language`
- `implementation_artifacts`
- `date` as system-generated current datetime

### Paths

- `output_file` = `{implementation_artifacts}/tests/acceptance-criteria-enhanced.md`

### Context

- `project_context` = `**/project-context.md` (load if exists)
- `story_file` = user-specified Story file or latest story in `docs/stories/`

---

## EXECUTION

### Step 0: Load Story

Load the target Story file. If not specified, ask user to provide:
- Story file path, OR
- Story text with acceptance criteria

Extract:
- Story title and description
- Existing acceptance criteria
- Related requirements/PRD references

### Step 1: Analyze Each Acceptance Criterion

For each existing criterion:

1. **Classify**: Is it testable as-is? (Yes/Partial/No)
2. **Identify gaps**:
   - Missing boundary conditions (min, max, empty, null)
   - Missing error scenarios (invalid input, timeout, concurrent access)
   - Implicit assumptions ("user is logged in" but auth not mentioned)
   - Missing state transitions (what happens if called twice?)

### Step 2: Generate Given-When-Then Scenarios

For each criterion, write structured test scenarios:

```gherkin
# Original: "用户可以创建项目"

Scenario: 成功创建项目 (Happy Path)
  Given 用户已登录且有创建权限
  When 用户提交项目名称 "我的项目" 和描述 "测试项目"
  Then 系统返回 201 和项目 ID
  And 项目列表中出现新项目

Scenario: 项目名称为空 (Boundary)
  Given 用户已登录
  When 用户提交空的项目名称
  Then 系统返回 400 和错误信息 "项目名称不能为空"

Scenario: 项目名称重复 (Error)
  Given 已存在名为 "我的项目" 的项目
  When 用户提交相同名称
  Then 系统返回 409 和错误信息 "项目名称已存在"

Scenario: 未登录创建 (Auth)
  Given 用户未登录
  When 用户尝试创建项目
  Then 系统返回 401
```

Rules:
- Every criterion gets at least 1 happy path + 1 error scenario
- High-risk criteria get boundary + concurrent scenarios
- Scenarios should be directly translatable to test code

### Step 3: Identify Hidden Scenarios

Look for cross-cutting concerns not covered by individual criteria:

- **Concurrency**: What if two users do this simultaneously?
- **Ordering**: Does the sequence of operations matter?
- **State dependency**: What prior state must exist?
- **Cleanup**: What happens to dependent data when this is deleted?
- **Performance**: Is there an implicit SLA?

### Step 4: Output Enhanced Criteria

Generate `acceptance-criteria-enhanced.md`:

```markdown
# Enhanced Acceptance Criteria — {story_title}

## Summary
- Original criteria: X
- Added scenarios: Y
- Boundary conditions found: Z
- Hidden assumptions uncovered: W

## AC-1: {original criterion}

**Status**: Testable / Partially Testable / Needs Revision

### Scenarios
[Given-When-Then scenarios]

### Gaps Found
[List of missing considerations]

### Suggested Revision
[If criterion needs rewording]

---

## AC-2: {next criterion}
[... repeat ...]

## Cross-Cutting Scenarios
[Concurrency, ordering, cleanup scenarios]
```

Optionally write back the enhanced criteria to the original Story file.

## Keep It Simple

**Do:**

- Write scenarios that a developer can directly convert to test code
- Focus on scenarios that catch real bugs (not theoretical edge cases)
- Flag assumptions explicitly ("Assumes user has admin role")
- Use the project's actual field names and error codes

**Avoid:**

- Rewriting good criteria that are already testable
- Adding 20 scenarios per criterion (3-5 is usually sufficient)
- Testing implementation details ("database column is VARCHAR(255)")
- Scenarios that only matter in theory, not in practice

## Output

Save enhanced criteria to: `{output_file}`

**Done!** Acceptance criteria strengthened. Validate against `./checklist.md`.
