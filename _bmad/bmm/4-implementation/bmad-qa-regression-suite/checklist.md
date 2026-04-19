# RS Regression Suite — Validation Checklist

## Data Collection

- [ ] TH historical data loaded (or static analysis noted)
- [ ] Per-test metrics computed (runs, pass/fail, duration, flake rate)
- [ ] Git last-modified dates checked

## Scoring

- [ ] All tests scored on 4 dimensions
- [ ] Scores consistent across similar tests
- [ ] Categories assigned correctly per score range

## P0 Core Set

- [ ] P0 set covers all critical business flows
- [ ] P0 set total duration under 60 seconds
- [ ] No flaky tests in P0 set
- [ ] P0 set size reasonable (10-15 for medium project)

## Retirement

- [ ] Every retirement suggestion has specific reason
- [ ] Coverage overlap confirmed before recommending retirement
- [ ] Impact assessment provided

## Output

- [ ] Report saved to configured path
- [ ] All tables properly formatted
- [ ] Trends included (if history available)

---

**Quality Bar**: Running only the P0 set should catch 80%+ of real regressions while taking <60 seconds.
