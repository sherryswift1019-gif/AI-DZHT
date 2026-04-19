# SA Acceptance Criteria — Validation Checklist

## Input

- [ ] Story file loaded with acceptance criteria
- [ ] Each criterion identified and numbered

## Scenarios

- [ ] Every criterion has at least 1 happy path scenario
- [ ] Every criterion has at least 1 error/boundary scenario
- [ ] Scenarios use Given-When-Then format
- [ ] Scenarios reference actual field names and status codes

## Gap Analysis

- [ ] Hidden assumptions uncovered and documented
- [ ] Cross-cutting concerns identified (concurrency, ordering)
- [ ] Missing boundary conditions flagged

## Quality

- [ ] Scenarios are directly translatable to test code
- [ ] No overly theoretical edge cases
- [ ] Existing good criteria left unchanged
- [ ] Summary counts accurate

## Output

- [ ] Enhanced criteria document saved
- [ ] Document follows required structure

---

**Quality Bar**: A developer should be able to write a test for each scenario without asking "what does this mean?"
