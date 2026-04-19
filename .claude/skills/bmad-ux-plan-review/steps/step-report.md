# Step: Review Summary Report

## MANDATORY EXECUTION RULES (READ FIRST):

- CRITICAL: ALWAYS read the complete step file before taking any action
- Aggregate findings from ALL 7 Passes stored in memory
- Apply verdict thresholds EXACTLY as specified — do not soften or adjust
- Write the report to TWO destinations: PRD file and UX Specification
- Update ux-status.md after writing
- YOU MUST ALWAYS SPEAK OUTPUT in your Agent communication style with the config `{communication_language}`

## EXECUTION PROTOCOLS:

- Compile all Pass findings from memory
- Compute overall score and high-priority issue count
- Determine verdict using the mandatory thresholds
- Write to all destinations
- Present final summary to user

## CONTEXT BOUNDARIES:

- Use ALL 7 Pass findings accumulated in memory
- Do not re-read source documents
- Verdict thresholds are absolute and non-negotiable

---

## YOUR TASK:

Aggregate all 7 Pass findings into a final Review Report, determine the verdict, write the report to the PRD and UX Specification, and update ux-status.md.

---

## REPORT GENERATION:

### Step 1 — Compile Scores and Issues

From each Pass in memory, extract:
- Pass score (X/10)
- Count of High-severity issues (🔴)
- Count of Medium-severity issues (🟠)
- Count of Low-severity issues (🟡)
- Count of Open Decisions

### Step 2 — Calculate Overall Score

Overall UX Readiness Score = weighted average of 7 Pass scores:

| Pass | Weight | Rationale |
|---|---|---|
| Pass 1 — IA | 15% | Structural foundation |
| Pass 2 — States | 20% | Implementation completeness |
| Pass 3 — Journey | 15% | User experience quality |
| Pass 4 — AI Slop | 10% | Design quality signal |
| Pass 5 — Design System | 15% | Implementation consistency |
| Pass 6 — A11y | 15% | Non-negotiable compliance |
| Pass 7 — Gaps | 10% | Specification completeness |

Total High-priority issue count = sum of all 🔴 findings across all Passes.

### Step 3 — Apply Verdict Thresholds (MANDATORY)

These thresholds are absolute. Apply exactly:

| Condition | Verdict |
|---|---|
| Score ≥ 8.0 AND high-priority issues = 0 | **PASS** — Ready for implementation |
| Score 6.0–7.9 OR high-priority issues ≤ 2 | **CONDITIONAL PASS** — Revise and re-review |
| Score < 6.0 OR high-priority issues ≥ 3 | **BLOCKED** — Cannot proceed to sprint planning |

If both the score and the issue count would trigger different verdicts, use the MORE RESTRICTIVE verdict.

### Step 4 — Generate Report Content

Produce the full report in this format:

```markdown
## UX Design Review

**Reviewed by**: AI UX Reviewer (bmad-ux-plan-review)
**Review date**: {date}
**Input documents**: {list from step-00}
**Verdict**: [PASS / CONDITIONAL PASS / BLOCKED]

### Review Scorecard

| Pass | Dimension | Score | High Issues | Med Issues | Open Decisions |
|---|---|---|---|---|---|
| Pass 1 | Information Architecture | X/10 | n | n | n |
| Pass 2 | Interaction State Coverage | X/10 | n | n | n |
| Pass 3 | User Journey & Emotional Arc | X/10 | n | n | n |
| Pass 4 | AI Slop Risk | X/10 | n | n | n |
| Pass 5 | Design System Alignment | X/10 | n | n | n |
| Pass 6 | Responsive & Accessibility | X/10 | n | n | n |
| Pass 7 | Open Design Decisions | X/10 | n | n | n |
| **Overall UX Readiness** | | **X.X/10** | **n total** | **n total** | **n total** |

### Verdict Rationale

**{VERDICT}** — {1-2 sentences explaining the specific score and issue count that determined the verdict}

### All High-Priority Issues (🔴)

{List all 🔴 findings from all Passes with their IDs, or "None — all high-priority issues resolved."}

### All Open Decisions Requiring Resolution Before Sprint

{List all Critical and High-risk open decisions from Pass 7 Consolidated table}

### Next Steps

{If PASS}: Implementation may proceed. The {n} medium-priority issues and {n} open decisions should be addressed during sprint planning but do not block implementation.

{If CONDITIONAL PASS}: The following {n} issues must be resolved and the relevant sections re-reviewed before sprint planning:
1. [Issue ID]: [resolution action needed]
2. ...

{If BLOCKED}: Implementation is blocked. The following high-priority issues prevent a reliable implementation:
1. [Issue ID]: [what needs to happen to unblock]
```

---

## WRITE DESTINATIONS:

### Destination 1 — PRD File

Find the PRD file used in step-00 (the one loaded from `*prd*.md`).

If the PRD file does NOT have a `## UX Design Review` section:
- Append the full report at the end of the PRD file

If the PRD file ALREADY has a `## UX Design Review` section:
- Replace the existing section with the new report (preserving all other PRD content)

### Destination 2 — UX Specification Part 5

Append to `{planning_artifacts}/ux-design-specification.md`:

Find the `## Part 5` section (or create it if absent) and append the Review Scorecard and Verdict.

### Destination 3 — UX Specification Part 6 (Open Decisions)

Append all Critical and High-risk open decisions from Pass 7 to the `## Part 6` section (or create it) of `{planning_artifacts}/ux-design-specification.md`.

Format for Part 6 entries:
```markdown
### Open Decision: {decision title}
**Source**: Pass {n} / {area}
**Risk**: Critical / High
**Impact**: {implementation impact}
**Recommendation**: {suggested resolution}
**Status**: Unresolved — {date}
```

### Destination 4 — ux-status.md

Find or create `{planning_artifacts}/ux-status.md` and update:

```markdown
## UX Plan Review Status
- **Last review**: {date}
- **Verdict**: {PASS / CONDITIONAL PASS / BLOCKED}
- **Overall score**: {X.X}/10
- **High issues**: {n}
- **Open decisions (Critical+High)**: {n}
- **Next action**: {what needs to happen next}
```

---

## FINAL PRESENTATION:

After all writes are complete, present to the user:

"**UX Plan Review Complete** — {date}

**Verdict: {VERDICT}**

{Summary scorecard table}

**Files updated:**
- {PRD file path} — `## UX Design Review` section {added/updated}
- `{ux-design-specification.md}` — Part 5 review findings appended
- `{ux-design-specification.md}` — Part 6 open decisions appended ({n} items)
- `ux-status.md` — Review status updated

{Next steps message based on verdict}"

---

## SUCCESS METRICS:

✅ All 7 Pass scores compiled and weighted average computed
✅ Verdict applied using mandatory thresholds without adjustment
✅ Full report written to PRD file (appended or replaced correctly)
✅ Part 5 of UX Specification updated
✅ Part 6 open decisions updated
✅ ux-status.md updated
✅ Final summary presented to user

## FAILURE MODES:

❌ Softening or adjusting verdict thresholds
❌ Using the wrong verdict when score and issue count conflict (must use more restrictive)
❌ Forgetting to write to any of the 4 destinations
❌ Duplicating the UX Design Review section in the PRD instead of replacing
❌ **CRITICAL**: Reading only partial step file
