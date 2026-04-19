# BE Browser E2E — Validation Checklist

## Setup

- [ ] Playwright installed and configured
- [ ] Browser (Chromium) available for headless execution
- [ ] Screenshots directory exists

## Test Quality

- [ ] Tests cover critical user journeys (3-8 flows)
- [ ] Each journey has happy path + at least 1 error scenario
- [ ] Semantic locators used (getByRole > getByText > getByTestId)
- [ ] No CSS selectors or XPath
- [ ] No hardcoded waits (use expect().toBeVisible())
- [ ] Tests are independent (no order dependency)

## Execution

- [ ] All tests run in headless Chromium
- [ ] Screenshots captured at key states
- [ ] Failed tests have diagnostic screenshots
- [ ] Tests pass consistently (no flaky tests)

## Output

- [ ] Test files saved to e2e directory
- [ ] Report saved with per-journey results
- [ ] Locator audit shows >70% getByRole usage

---

**Quality Bar**: Tests should survive a UI color change without failing. Only structural changes (removed buttons, renamed pages) should break them.
