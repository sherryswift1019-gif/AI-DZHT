# GT Ground Truth Validation — Validation Checklist

## Bug Set

- [ ] 5-10 planted bugs defined
- [ ] Bugs target high-risk modules
- [ ] Multiple categories represented (off-by-one, logic, null, state)
- [ ] Each bug has clear mutation and expected detection

## Execution

- [ ] Mutations applied safely (no permanent source changes)
- [ ] Tests run per-mutation (not all mutations at once)
- [ ] Results correctly classified (TP/FN)

## Analysis

- [ ] Detection rate calculated correctly
- [ ] Evidence quality assessed
- [ ] Undetected bugs have specific test suggestions
- [ ] Gap analysis identifies weakest areas

## Output

- [ ] Report saved with per-bug results table
- [ ] Suggested tests are directly usable code
- [ ] planted-bugs.json saved for future re-validation

---

**Quality Bar**: After fixing the gaps identified in this report, re-running GT should show detection rate improvement.
