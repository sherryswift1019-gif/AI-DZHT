# IT Incremental Test Selection — Validation Checklist

## Change Detection

- [ ] Git diff captured correctly
- [ ] Changed files filtered to relevant types
- [ ] Diff scope appropriate (uncommitted / last commit / branch)

## Touchfiles

- [ ] Touchfiles mapping loaded or built
- [ ] Test-to-source dependencies identified
- [ ] Glob patterns included for broad matching

## Selection

- [ ] Every changed source file matched to affected tests
- [ ] Direct, dependency, and glob matches all checked
- [ ] Safety rules applied (>80% threshold, config changes, flaky tests)
- [ ] No test incorrectly skipped when its dependency changed

## Report

- [ ] Selection report saved with clear reasoning
- [ ] Skipped tests listed with reason
- [ ] Time savings estimated

---

**Quality Bar**: If a developer reviews the selection and finds a missed test, that's a critical failure. Err on inclusion.
