# TH Test Result Persistence — Validation Checklist

## Parsing

- [ ] Test results detected from available source
- [ ] Results parsed to standard JSON schema
- [ ] All fields populated (name, suite, status, duration)
- [ ] Error messages captured for failing tests

## Persistence

- [ ] Results saved with unique run_id
- [ ] Schema version included
- [ ] Historical runs capped at 20
- [ ] File saved to correct results_dir

## Comparison

- [ ] Previous run loaded (or baseline noted)
- [ ] Regressions identified (pass → fail)
- [ ] Improvements identified (fail → pass)
- [ ] New/removed tests noted
- [ ] Duration changes flagged (>20%)

## Output

- [ ] Comparison report saved to configured output path
- [ ] Metrics table shows current vs previous
- [ ] Regressions listed prominently

---

**Quality Bar**: A developer should be able to identify what broke and what improved in under 30 seconds.
