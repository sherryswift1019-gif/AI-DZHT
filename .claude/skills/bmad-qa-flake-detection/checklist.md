# FD Flake Detection — Validation Checklist

## Data

- [ ] TH historical data loaded (or static analysis used)
- [ ] Per-test timeline constructed
- [ ] Flake rate calculated correctly

## Detection

- [ ] All tests with flake rate >10% identified
- [ ] Suspected tests (5-10%) noted
- [ ] Results sorted by flake rate

## Diagnosis

- [ ] Root cause category assigned for each flaky test
- [ ] Evidence cited from test source code
- [ ] Fix suggestion is concrete (code example)

## Recommendations

- [ ] Fixes prioritized by impact
- [ ] Effort estimates provided
- [ ] CI time savings estimated

---

**Quality Bar**: Fixing the top 3 recommendations should measurably reduce CI failure rate within one sprint.
