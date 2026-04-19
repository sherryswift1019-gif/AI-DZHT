# XA Cross-Agent Quality Collaboration Workflow

**Goal:** Analyze current quality state and generate targeted feedback for other agents (Dev, PM, SM, Architect) to improve upstream quality and close quality gaps.

**Your Role:** You are a quality communication bridge. You translate quality data into actionable feedback specific to each team role — developers need code-level fixes, PMs need requirement-level improvements, SMs need sprint impact assessments, architects need structural recommendations.

---

## INITIALIZATION

### Configuration Loading

Load config from `{project-root}/_bmad/bmm/config.yaml` and resolve:

- `project_name`, `user_name`
- `communication_language`, `document_output_language`
- `implementation_artifacts`
- `date` as system-generated current datetime

### Paths

- `output_file` = `{implementation_artifacts}/tests/quality-feedback-report.md`

### Context

- `project_context` = `**/project-context.md` (load if exists)
- `test_history` = from TH data
- `cost_metrics` = from CT data
- `quality_gate` = from QG data
- `test_strategy` = from TS data

---

## EXECUTION

### Step 0: Gather Quality Intelligence

Load all available quality data:
- TH: Pass rates, regressions, flaky tests
- CT: Cost trends, duration anomalies
- QG: Gate results, threshold violations
- TS: Risk matrix, coverage gaps
- LJ: Quality scores per dimension

If some data is unavailable, work with what exists.

### Step 1: Generate Dev Feedback (→ Amelia)

Focus: Code-level quality issues that developers should fix.

```markdown
### To Dev (Amelia):

**Testability Issues**:
- `workflow_engine.py:execute_step()` has cyclomatic complexity 15 — consider extracting helper functions to simplify testing
- `llm.py:_chat()` mixes IO with business logic — inject the client for easier mocking

**Regression Alert**:
- `test_approval_flow` regressed in last 2 runs — check recent changes to approval logic

**Coverage Gaps**:
- `backend/app/context.py` has 0% test coverage — all scope filtering logic is untested
```

### Step 2: Generate PM Feedback (→ John/Lena)

Focus: Requirement-level quality issues affecting testability.

```markdown
### To PM (John/Lena):

**Untestable Requirements**:
- REQ-005 "系统应响应迅速" — no measurable SLA; suggest: "API 响应 < 200ms at P95"
- REQ-012 "界面友好" — subjective; suggest: "所有表单提供即时验证反馈"

**Missing Acceptance Criteria**:
- 3 stories in current sprint have no acceptance criteria defined

**Quality Trend**:
- Pass rate declined 3% over last 5 runs — may indicate scope creep or insufficient specs
```

### Step 3: Generate SM Feedback (→ Bob)

Focus: Sprint-level quality status and velocity impact.

```markdown
### To SM (Bob):

**Sprint Quality Dashboard**:
- Current sprint coverage: 72% (target: 70%) ✅
- Stories without tests: 2 of 8 (25%)
- Estimated quality debt: ~4 hours of test writing needed

**Velocity Risk**:
- 3 flaky tests causing false CI failures, wasting ~30 min/day
- Recommend: allocate 1 story point for flake fixes this sprint
```

### Step 4: Generate Architect Feedback (→ Winston)

Focus: Structural quality issues and contract clarity.

```markdown
### To Architect (Winston):

**Contract Gaps**:
- `workflow_engine` and `llm` modules lack clear interface contracts — integration tests are fragile
- Suggest: define explicit TypedDict/Pydantic models for inter-module communication

**Architecture Testability**:
- Database access scattered across 4 modules — consider repository pattern for test isolation
- External LLM calls not easily mockable — suggest async client injection

**Technical Debt**:
- 3 modules have circular import potential — affects test isolation
```

### Step 5: Generate Context Updates

Prepare `suggestedContextUpdates` for injection into project context:

```json
[
  {
    "type": "lesson",
    "title": "workflow_engine 测试脆弱性",
    "scope": "dev",
    "correctApproach": "为 workflow_engine 添加集成测试，覆盖步骤间状态传递"
  },
  {
    "type": "rule",
    "scope": "qa",
    "text": "所有新模块必须达到 70% 测试覆盖率才能合并"
  }
]
```

### Step 6: Output Report

Generate `quality-feedback-report.md`:

```markdown
# Cross-Agent Quality Feedback — {project_name}

## Quality State Summary
[1-paragraph overview of current quality health]

## Feedback by Role

### → Dev (Amelia)
[Step 1 content]

### → PM (John/Lena)
[Step 2 content]

### → SM (Bob)
[Step 3 content]

### → Architect (Winston)
[Step 4 content]

## Suggested Context Updates
[Step 5 content]

## Priority Actions
1. [Highest impact] {action}
2. ...
```

## Keep It Simple

**Do:**

- Tailor language to each role (code terms for dev, business terms for PM)
- Be specific — cite file names, test names, requirement IDs
- Prioritize — top 3 items per role, not a laundry list
- Include context updates for automatic project learning

**Avoid:**

- Generic feedback ("improve quality") — always be specific
- Blaming ("PM wrote bad requirements") — frame as improvements
- Overwhelming with data — each role gets 3-5 actionable items max

## Output

Save report to: `{output_file}`

**Done!** Cross-agent feedback generated. Validate against `./checklist.md`.
