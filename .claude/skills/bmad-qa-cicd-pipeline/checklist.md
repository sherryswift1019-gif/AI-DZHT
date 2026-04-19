# CI CI/CD Pipeline — Validation Checklist

## Detection

- [ ] CI platform identified correctly
- [ ] Test frameworks and commands detected
- [ ] Existing CI config considered (extend, not replace)

## PR Gate

- [ ] Lint + type check included
- [ ] Unit tests (incremental if possible)
- [ ] Build verification
- [ ] Target: < 5 minutes

## Full Regression

- [ ] All test types included (unit + integration + E2E)
- [ ] Parallelization configured (sharding)
- [ ] Coverage reporting configured

## Quality Gate

- [ ] QG thresholds enforced in pipeline
- [ ] Failure blocks merge/deploy

## Optimizations

- [ ] Dependency caching configured
- [ ] E2E conditional on frontend changes
- [ ] Artifacts uploaded on failure (screenshots, logs)

---

**Quality Bar**: A new developer should get CI feedback on their first PR within 5 minutes.
