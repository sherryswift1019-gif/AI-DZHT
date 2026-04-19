# TS Test Strategy — Validation Checklist

## Context Coverage

- [ ] PRD requirements analyzed (or user-provided feature list)
- [ ] Architecture/module structure analyzed
- [ ] Tech stack identified and considered
- [ ] Known constraints and risk areas incorporated

## Requirements Traceability

- [ ] Every PRD requirement mapped to at least one test type
- [ ] No orphan requirements (unmapped to any test)
- [ ] Priority assigned based on business impact

## Risk Matrix

- [ ] All significant modules evaluated
- [ ] Scoring criteria consistent across modules
- [ ] Top 3-5 high-risk modules clearly identified
- [ ] Risk scores drive test investment allocation

## Test Pyramid

- [ ] Unit/Integration/E2E ratio reasonable (roughly 70/20/10)
- [ ] E2E tests limited to critical user journeys only
- [ ] Each layer has clear scope (what to test, what not)
- [ ] Mock strategy defined per layer

## Actionability

- [ ] Every recommendation references specific modules/files
- [ ] No vague statements ("improve coverage" without specifics)
- [ ] Quality targets are measurable (pass rate, coverage, flake rate)
- [ ] Execution order and dependencies clear

## Output

- [ ] Strategy document saved to configured output path
- [ ] Document follows required section structure
- [ ] Executive summary provides clear overview

---

**Quality Bar**: A good test strategy should allow a developer to immediately start writing tests for the top-priority module without asking further questions.
