# TD Test Data — Validation Checklist

## Domain Analysis

- [ ] Core entities identified from schema/models
- [ ] Fields, types, and relationships documented
- [ ] Validation rules captured
- [ ] Entity states identified

## Factories

- [ ] Factory for each core entity
- [ ] Sensible defaults for all required fields
- [ ] Override mechanism for custom scenarios
- [ ] Unique values avoid collisions (sequence/timestamp)
- [ ] Relationships handled (SubFactory or lazy)

## Scenarios

- [ ] Happy path scenario defined
- [ ] At least 2 boundary scenarios (min/max)
- [ ] Error/invalid data scenario defined
- [ ] Scenarios are reusable across test files

## Isolation

- [ ] Isolation strategy chosen and justified
- [ ] No test depends on another test's data
- [ ] Cleanup mechanism defined
- [ ] Strategy matches project tech stack

## Output

- [ ] Factory code files saved to fixtures directory
- [ ] Strategy document saved to configured path
- [ ] Usage examples provided

---

**Quality Bar**: A new developer should be able to write a test with proper fixtures in under 5 minutes using the factories and docs.
