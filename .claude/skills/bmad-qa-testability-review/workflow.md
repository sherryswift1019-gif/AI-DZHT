# TRV Testability Review Workflow

**Goal:** Review PRD acceptance criteria for testability — assess whether each requirement is measurable, automatable, and has clear boundary conditions.

**Your Role:** You are a Shift-Left QA specialist. You catch untestable requirements early, BEFORE they become expensive bugs. Your review prevents "works on my machine" situations by ensuring every requirement has verifiable acceptance criteria.

---

## INITIALIZATION

### Configuration Loading

Load config from `{project-root}/_bmad/bmm/config.yaml` and resolve:

- `project_name`, `user_name`
- `communication_language`, `document_output_language`
- `implementation_artifacts`
- `date` as system-generated current datetime

### Paths

- `output_file` = `{implementation_artifacts}/tests/testability-review.md`

### Context

- `project_context` = `**/project-context.md` (load if exists)
- `prd` = `**/prd.md` (load if exists, **required input**)

---

## EXECUTION

### Step 0: Load PRD

Load the PRD document. If not found, ask the user to provide:
- The PRD file path, OR
- A list of requirements with acceptance criteria

Extract all functional requirements and their acceptance criteria.

### Step 1: Per-Requirement Testability Assessment

For each requirement/acceptance criterion, evaluate on 4 dimensions:

1. **Measurability (0-3)**
   - 0: No measurable outcome ("system should be fast")
   - 1: Subjective measure ("system should be user-friendly")
   - 2: Partially measurable ("response time under 2 seconds" but no load condition)
   - 3: Fully measurable ("API response < 200ms at P95 under 100 concurrent users")

2. **Automation Readiness (0-3)**
   - 0: Cannot be automated (requires human judgment, e.g., "UI should look good")
   - 1: Needs significant manual setup (complex external dependencies)
   - 2: Partially automatable (some steps need manual intervention)
   - 3: Fully automatable (clear inputs, deterministic outputs)

3. **Boundary Clarity (0-3)**
   - 0: No boundaries defined ("supports multiple users")
   - 1: Partial boundaries ("handles errors gracefully")
   - 2: Most boundaries defined ("input 1-100 characters")
   - 3: All boundaries clear (min, max, empty, null, Unicode, concurrent access)

4. **Isolation (0-3)**
   - 0: Deeply coupled with external systems, untestable in isolation
   - 1: Requires multiple external dependencies
   - 2: Can be partially isolated with mocks
   - 3: Fully testable in isolation

Testability Score = sum of 4 dimensions (0-12).

### Step 2: Classify Requirements

Group by testability:

- **Green (10-12)**: Fully testable, ready for test design
- **Yellow (6-9)**: Partially testable, needs improvement
- **Red (0-5)**: Untestable as-is, requires PRD revision

### Step 3: Generate Improvement Suggestions

For each Yellow/Red requirement:

- Identify the specific weakness (which dimension scored low)
- Provide a concrete rewrite suggestion that would improve the score
- Example: "用户应该能快速登录" → "用户从输入凭据到进入主页 < 3 秒（P95），错误凭据返回明确错误码 401"

### Step 4: Overall Assessment

Calculate:

- Overall Testability Score (0-100) = (sum of all requirement scores) / (total requirements × 12) × 100
- Number of Green/Yellow/Red requirements
- Top 3 systemic issues (e.g., "most requirements lack boundary conditions")

### Step 5: Output Report

Generate `testability-review.md`:

```markdown
# Testability Review — {project_name}

## Overall Score: {score}/100

| Category | Count | Percentage |
|----------|-------|------------|
| Green (Ready) | X | X% |
| Yellow (Improve) | X | X% |
| Red (Rewrite) | X | X% |

## Detailed Assessment

### REQ-001: {requirement}
- Measurability: X/3
- Automation: X/3
- Boundaries: X/3
- Isolation: X/3
- **Score: X/12** [GREEN/YELLOW/RED]
- Suggestion: {if Yellow/Red}

[... repeat for each requirement ...]

## Systemic Issues
1. {issue description + recommendation}

## Recommended Actions
1. [Priority] Fix Red requirements before development starts
2. [Medium] Improve Yellow requirement boundary conditions
3. [Optional] Add performance criteria to Green requirements
```

## Keep It Simple

**Do:**

- Be specific about what makes a requirement untestable
- Provide concrete rewrite suggestions (not just "needs improvement")
- Focus on acceptance criteria, not implementation details
- Flag hidden assumptions ("assumes user is logged in" but no auth spec)

**Avoid:**

- Nitpicking well-written requirements
- Suggesting unnecessary complexity
- Blocking on minor issues (Yellow is fine, only Red needs fixing)

## Output

Save report to: `{output_file}`

**Done!** Testability review complete. Validate against `./checklist.md`.
