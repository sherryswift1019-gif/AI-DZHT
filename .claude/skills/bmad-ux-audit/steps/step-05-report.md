# Step 5: Report Generation

## MANDATORY EXECUTION RULES (READ FIRST):

- TWO OUTPUT FILES are mandatory — both the spec Part 4 append AND the standalone problem ID file MUST be written
- CRITICAL: ALWAYS read the complete step file before taking any action — partial understanding leads to incomplete decisions
- The problem ID file (`ux-audit-{date}.md`) is the PRIMARY deliverable — it must be machine-readable and checkbox-ready
- Microcopy issues MUST include revised copy in the report, not just problem description
- ux-status.md MUST be updated at the end
- YOU MUST ALWAYS SPEAK OUTPUT in your Agent communication style with the config `{communication_language}`
- YOU MUST ALWAYS WRITE all artifact and document content in `{document_output_language}`

## EXECUTION PROTOCOLS:

- Read all findings from step 3 and scores from step 4 before writing any file
- Write the standalone problem ID file FIRST (primary deliverable)
- Append the audit report to the spec file SECOND
- Update ux-status.md THIRD
- Present completion summary to user

## CONTEXT BOUNDARIES:

- All RE findings (RE-H, RE-M, RE-L) from step 3 are in context
- Design Quality grade and AI Slop Risk score from step 4 are in context
- Prioritized action list from step 4 is in context
- Quick wins identified in step 4 are in context
- `{date}` variable sets the audit file name

## YOUR TASK:

Generate the complete audit report as two files: a standalone structured problem ID file for tracking, and an audit summary appended to the UX Design Specification as Part 4.

## REPORT GENERATION SEQUENCE:

### 1. Read All Audit Data

Confirm:
"Generating audit report for {{project_name}}.

Audit data loaded:
- Total findings: [n] (RE-H: [n], RE-M: [n], RE-L: [n])
- Design Quality: [Grade]
- AI Slop Risk: [n]/10
- Audit file: {planning_artifacts}/ux-audit-{date}.md
- Spec file: {planning_artifacts}/ux-design-specification.md (Part 4)

Writing files now..."

### 2. Write Standalone Problem ID File

Write the complete problem ID file to `{planning_artifacts}/ux-audit-{date}.md`:

```markdown
---
audit_date: {date}
project: {{project_name}}
input_type: [html|ux-spec|text-description]
quality_ceiling: [100%|85%|60-75%]
design_quality_grade: [A|B|C|D|E|F]
ai_slop_risk: [0-10]
total_findings: [n]
findings_high: [n]
findings_medium: [n]
findings_low: [n]
---

# UX Audit — {{project_name}} — {date}

## Audit Metadata

| Field | Value |
|-------|-------|
| Audit Date | {date} |
| Project | {{project_name}} |
| Input Type | [type] |
| Quality Ceiling | [%] |
| Design Quality | [Grade] |
| AI Slop Risk | [score]/10 |
| Total Findings | [n] (High: [n] / Medium: [n] / Low: [n]) |

---

## Critical Issues — Must Fix Before Launch

[For each RE-H finding:]
- [ ] **RE-H[n]**: [Full description]
  - **Category**: [Category name]
  - **Impact**: [Who is affected and in what scenario]
  - **Recommendation**: [Specific, actionable fix]
  [If microcopy issue:]
  - **Revised copy**: Change from: "[current text]" → To: "[improved text]"

---

## Important Issues — Address in Next Sprint

[For each RE-M finding:]
- [ ] **RE-M[n]**: [Full description] [SLOP if applicable]
  - **Category**: [Category name]
  - **Impact**: [Who is affected and in what scenario]
  - **Recommendation**: [Specific, actionable fix]
  [If microcopy issue:]
  - **Revised copy**: Change from: "[current text]" → To: "[improved text]"

---

## Recommended Improvements — Address When Capacity Allows

[For each RE-L finding:]
- [ ] **RE-L[n]**: [Full description]
  - **Category**: [Category name]
  - **Impact**: [Who is affected and in what scenario]
  - **Recommendation**: [Specific, actionable fix]

---

## Quick Wins (High Impact, Low Effort)

[Subset from step 4 quick wins:]
1. **[RE-ID]**: [Description] — [Why fast to fix]
2. ...

---

## Microcopy Revision Summary

[Consolidated list of all copy changes from all categories:]

| Location | Current Text | Revised Text |
|----------|--------------|--------------|
| [page/component] | "[current]" | "[revised]" |
...

---

## Suggested Next Steps

1. Fix all RE-H issues before next user test or launch
2. Schedule RE-M items in next 1–2 sprints
3. Apply quick wins immediately (estimated [n] hours total)
[If AI Slop Risk >= 4:]
4. Conduct visual design review to address AI slop patterns — consider `bmad-ux-html-gen` to regenerate affected sections
5. Re-audit after fixes are applied using `bmad-ux-audit` to verify improvements
```

### 3. Append Audit Summary to UX Design Specification

Append to `{planning_artifacts}/ux-design-specification.md` as **Part 4: UX Audit**:

```markdown
## Part 4: UX Audit

### Audit Summary — {date}

| Metric | Value |
|--------|-------|
| Input Type | [type] |
| Quality Ceiling | [%] |
| Design Quality Grade | [Grade] — [one-sentence rationale] |
| AI Slop Risk | [score]/10 — [one-sentence rationale] |
| Total Findings | [n] (High: [n] / Medium: [n] / Low: [n]) |
| Audit File | `ux-audit-{date}.md` |

### Key Findings Overview

**Critical (RE-H):**
[Bulleted list of RE-H finding titles only — details in audit file]

**Top Medium Priority (RE-M) — first 5:**
[Bulleted list of top 5 RE-M findings — details in audit file]

**Notable Patterns:**
- AI Design Slop patterns detected: [n] ([list pattern names if any])
- Microcopy issues with revised copy: [n] items in audit file

### Recommended Actions

1. [Top 3 recommended actions, ordered by priority]
2. ...
3. ...

*Full findings and checkbox list: see `{planning_artifacts}/ux-audit-{date}.md`*
```

### 4. Update Status File

Update `{planning_artifacts}/ux-status.md`:
- Add or update the RE row:
  `RE: COMPLETED {date} | Grade: [Grade] | Slop: [n]/10 | Findings: [n] | File: ux-audit-{date}.md`

### 5. Present Completion Summary

"**Audit report generated for {{project_name}}**

**Files written:**
- Problem ID file: `{planning_artifacts}/ux-audit-{date}.md` ([n] findings, checkbox-ready)
- Spec update: `{planning_artifacts}/ux-design-specification.md` Part 4 appended
- Status: `{planning_artifacts}/ux-status.md` updated

**Results:**
- Design Quality: [Grade]
- AI Slop Risk: [n]/10
- [n] total findings ([n] critical, [n] medium, [n] low)
- [n] quick wins identified
- [n] microcopy revisions included

**Recommended next steps:**
1. Open `ux-audit-{date}.md` and start resolving RE-H items
2. Apply quick wins ([n] items, estimated [n] hours)
[If slop risk >= 4:] 3. Run `bmad-ux-html-gen` to regenerate AI-slop-affected sections with corrected design
4. Re-run `bmad-ux-audit` after fixes to verify improvement

**UX Audit workflow is complete.**"

## SUCCESS METRICS:

- Problem ID file written to `{planning_artifacts}/ux-audit-{date}.md` with frontmatter metadata
- Every finding has a checkbox `[ ]`, ID, full description, impact, and specific recommendation
- All microcopy issues include revised copy in both the ID file and the microcopy revision table
- Audit summary appended to spec file as Part 4
- ux-status.md updated with RE completion record
- Completion summary presented with file paths and statistics

## FAILURE MODES:

- Writing only the spec append and omitting the standalone problem ID file
- Omitting frontmatter from the problem ID file (makes automated processing impossible)
- Microcopy findings without revised copy (saying "fix it" without showing the fix)
- Not updating ux-status.md after completing the report
- Presenting completion without providing the file paths
- Omitting the "Suggested Next Steps" section in the problem ID file

## NEXT STEP:

This is the final step of the UX Audit workflow. After writing both files and updating ux-status.md, the RE skill is complete.

The problem ID file `{planning_artifacts}/ux-audit-{date}.md` is the handoff artifact — share it with the development team to begin resolving findings.

If the user wants to verify fixes were applied correctly, suggest re-running `bmad-ux-audit` after implementation is complete.
