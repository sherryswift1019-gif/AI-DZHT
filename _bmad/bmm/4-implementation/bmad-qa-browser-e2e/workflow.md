# BE Browser E2E Test Workflow

**Goal:** Generate Playwright browser E2E tests using semantic locators, run them in headless Chromium, and capture screenshots at key states.

**Your Role:** You are a browser test automation specialist. You write E2E tests that simulate real user journeys through the UI, using accessible locators that survive refactors and capturing visual evidence of test execution.

---

## INITIALIZATION

### Configuration Loading

Load config from `{project-root}/_bmad/bmm/config.yaml` and resolve:

- `project_name`, `user_name`
- `communication_language`, `document_output_language`
- `implementation_artifacts`
- `date` as system-generated current datetime

### Paths

- `output_file` = `{implementation_artifacts}/tests/browser-e2e-report.md`
- `test_dir` = `{project-root}/tests/e2e/` (or `e2e/` or `playwright/`)
- `screenshots_dir` = `{implementation_artifacts}/tests/screenshots/`

### Context

- `project_context` = `**/project-context.md` (load if exists)
- `ux_spec` = `**/ux-design-spec.md` or `**/ux-design.md` (load if exists)
- `existing_e2e` = scan for existing Playwright/Cypress test files

---

## EXECUTION

### Step 0: Verify Playwright Setup

Check if Playwright is installed:

1. Look for `@playwright/test` in `package.json` dependencies
2. Check for `playwright.config.ts` or `playwright.config.js`
3. If not installed, provide setup instructions:
   ```bash
   npm init playwright@latest
   npx playwright install chromium
   ```

If user prefers Cypress, adapt accordingly (but default to Playwright).

### Step 1: Identify Critical User Journeys

From UX spec and project context, identify the 3-8 most critical user flows:

- **Authentication**: Login, logout, session handling
- **Core CRUD**: Create, read, update, delete of primary entities
- **Key workflows**: The main value proposition flow (e.g., requirement pipeline)
- **Error handling**: Invalid input, network errors, permission denied

Ask user to confirm/adjust the journey list.

### Step 2: Generate Test Files

For each user journey, generate a Playwright test file:

```typescript
import { test, expect } from '@playwright/test'

test.describe('项目创建流程', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the app
    await page.goto('/')
    // Login if required
    await page.getByRole('textbox', { name: '邮箱' }).fill('test@example.com')
    await page.getByRole('textbox', { name: '密码' }).fill('password')
    await page.getByRole('button', { name: '登录' }).click()
    await expect(page.getByRole('heading', { name: '仪表盘' })).toBeVisible()
  })

  test('成功创建新项目', async ({ page }) => {
    // Navigate to project creation
    await page.getByRole('link', { name: '项目管理' }).click()
    await page.getByRole('button', { name: '新建项目' }).click()

    // Fill form
    await page.getByRole('textbox', { name: '项目名称' }).fill('测试项目')
    await page.getByRole('textbox', { name: '描述' }).fill('这是一个测试项目')

    // Screenshot before submit
    await page.screenshot({ path: 'screenshots/create-project-form.png' })

    // Submit
    await page.getByRole('button', { name: '创建' }).click()

    // Verify
    await expect(page.getByText('项目创建成功')).toBeVisible()
    await expect(page.getByText('测试项目')).toBeVisible()

    // Screenshot after success
    await page.screenshot({ path: 'screenshots/create-project-success.png' })
  })

  test('项目名称为空时显示错误', async ({ page }) => {
    await page.getByRole('link', { name: '项目管理' }).click()
    await page.getByRole('button', { name: '新建项目' }).click()

    // Submit empty form
    await page.getByRole('button', { name: '创建' }).click()

    // Verify error
    await expect(page.getByText('项目名称不能为空')).toBeVisible()
  })
})
```

**Locator priority** (most preferred first):
1. `getByRole()` — accessible role + name
2. `getByText()` — visible text content
3. `getByLabel()` — form labels
4. `getByPlaceholder()` — input placeholders
5. `getByTestId()` — data-testid attribute (last resort)

**Never use**: CSS selectors, XPath, or `.nth()` unless absolutely necessary.

### Step 3: Run Tests

Execute tests in headless mode:

```bash
npx playwright test --reporter=html
```

- Capture screenshots at key states (form filled, after action, error state)
- If failures, diagnose and fix common issues:
  - Timing: add `waitFor` for async operations
  - Locator: verify the element exists with the expected role/text
  - State: ensure test data is set up correctly

### Step 4: Output Report

Generate `browser-e2e-report.md`:

```markdown
# Browser E2E Report — {project_name}

## Summary
- User journeys tested: X
- Total scenarios: X
- Passed: X | Failed: X
- Screenshots captured: X

## Results by Journey

### Journey 1: {name}
| Scenario | Status | Duration | Screenshot |
|----------|--------|----------|------------|
| Happy path | PASS | 2.3s | [link] |
| Error state | PASS | 1.1s | [link] |

### Journey 2: ...

## Failed Scenarios (if any)
[Error details and screenshots]

## Locator Audit
- getByRole: X% (target: >70%)
- getByText: X%
- getByTestId: X% (target: <10%)
```

## Keep It Simple

**Do:**

- Test user journeys, not UI components (that's unit test territory)
- Use semantic locators that survive UI refactors
- Keep tests linear — no complex branching or conditional logic
- Screenshot key states for visual debugging
- Max 8-10 E2E tests (they're expensive)

**Avoid:**

- Testing every button and form field (E2E is for flows, not exhaustive UI)
- Hardcoded waits (`page.waitForTimeout(5000)`) — use `expect().toBeVisible()`
- CSS selector chains (`.header > div:nth-child(2) > button`)
- Fragile assertions on exact text that changes frequently

## Output

Save report to: `{output_file}`
Save test files to: `{test_dir}/`
Save screenshots to: `{screenshots_dir}/`

**Done!** Browser E2E tests generated. Validate against `./checklist.md`.
