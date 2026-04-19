# Step 4: Scoring and Prioritization

## MANDATORY EXECUTION RULES (READ FIRST):

- NEVER generate content without user input
- CRITICAL: ALWAYS read the complete step file before taking any action — partial understanding leads to incomplete decisions
- CRITICAL: When loading next step with 'C', ensure the entire file is read and understood before proceeding
- DUAL SCORING is mandatory — both Design Quality grade AND AI Slop Risk score must be produced
- Severity tier definitions are strict — do not downgrade a RE-H finding to spare feelings
- All findings must be sorted by priority before presenting to user
- YOU MUST ALWAYS SPEAK OUTPUT in your Agent communication style with the config `{communication_language}`
- YOU MUST ALWAYS WRITE all artifact and document content in `{document_output_language}`

## EXECUTION PROTOCOLS:

- Read all RE findings from step 3 before scoring
- Calculate both scores independently, then present together
- Sort findings into the prioritized output list
- Present [C] to proceed to report generation
- FORBIDDEN to generate report before scoring is complete

## CONTEXT BOUNDARIES:

- All RE-H, RE-M, RE-L findings from step 3 are in context
- Scoring is based on pattern and severity analysis, not the count of issues alone
- Quality ceiling from step 1 applies — note where score confidence is limited by input type
- AI Slop Risk score is entirely separate from Design Quality grade

## YOUR TASK:

Assign a Design Quality grade and an AI Slop Risk score to the audited design, then sort all findings into a prioritized action list.

## SCORING SEQUENCE:

### 1. Read All Findings

Read all RE findings from step 3 output. Count:
- RE-H findings: [n]
- RE-M findings: [n]
- RE-L findings: [n]
- AI Design Slop findings (subset of RE-M): [n]
- Total: [n]

### 2. Calculate Design Quality Grade

Apply this rubric based on RE-H and RE-M findings:

| Grade | Criteria |
|-------|----------|
| **A** | 0 RE-H, 0–2 RE-M. Design is production-ready with minor polish needed. |
| **B** | 0 RE-H, 3–6 RE-M. Design is functional with notable friction points. |
| **C** | 1–2 RE-H, any RE-M. Design has user-blocking issues that must be resolved before launch. |
| **D** | 3–5 RE-H, any RE-M. Design has multiple critical failures — requires significant revision. |
| **E** | 6–9 RE-H, any RE-M. Design is not ready for users — fundamental rework needed. |
| **F** | 10+ RE-H, or systematic failure across 5+ categories. Design must be rebuilt from scratch. |

**Grade modifier**: If quality ceiling from step 1 is below 85%, append `~` to grade to indicate uncertainty: e.g., `C~` means "approximately C, limited by text description input".

Write the grade with a one-sentence rationale:
"**Design Quality: [Grade]** — [rationale]"

### 3. Calculate AI Slop Risk Score

Count the number of AI Design Slop patterns detected in step 3 Category 9 findings.

| Score | Criteria |
|-------|----------|
| 0–1 | Minimal slop risk — design appears intentional and specific |
| 2–3 | Low slop risk — a few generic patterns detected, easily removed |
| 4–5 | Moderate slop risk — design has a generic AI-generated feel in multiple areas |
| 6–7 | High slop risk — design is dominated by AI default patterns |
| 8–10 | Critical slop risk — design looks like unedited AI output; credibility severely damaged |

Write the score with a one-sentence rationale:
"**AI Slop Risk: [n]/10** — [rationale, naming the most problematic patterns detected]"

### 4. Sort Findings by Priority

Produce the prioritized action list:

**Sorting rules:**
1. RE-H findings first, sorted by: user impact scope (affects all users > affects some users > affects edge cases)
2. RE-M findings second, sorted by: frequency of encounter (high-frequency flows > low-frequency flows)
3. RE-L findings last, sorted by: effort-to-impact ratio (quick wins first)
4. AI Slop findings are within their natural tier but flagged with `[SLOP]` label for easy identification

**Prioritized Action List format:**

```markdown
## Prioritized Action List — {{project_name}} Audit

### Critical — Address Before Launch (RE-H)
- [ ] RE-H1: [one-line summary] — [Category]
- [ ] RE-H2: [one-line summary] — [Category]
...

### Important — Address in Next Sprint (RE-M)
- [ ] RE-M1: [one-line summary] — [Category]
- [ ] RE-M2: [one-line summary] [SLOP] — [AI Design Slop]
...

### Recommended — Address When Capacity Allows (RE-L)
- [ ] RE-L1: [one-line summary] — [Category]
...
```

### 5. Identify Quick Wins

From the RE-M and RE-L list, identify 3–5 items that are:
- High impact relative to implementation effort
- Implementable in under 30 minutes per item

Present as:
"**Quick Wins (high impact, low effort):**
1. [RE-M/L ID]: [description] — [why fast to fix]
2. ...
3. ..."

### 6. Present Scores and Confirm

"**Audit Scoring Complete — {{project_name}}**

Design Quality: [Grade]
AI Slop Risk: [n]/10

Total findings: [n] (RE-H: [n], RE-M: [n] [includes [n] slop], RE-L: [n])

Top 3 issues to resolve first:
1. [RE-H1 or highest priority finding]
2. [RE-H2 or next highest priority]
3. [RE-M1 or first medium priority]

Quick wins: [n] items identified

[C] Continue — generate the full audit report and structured problem ID file"

## SUCCESS METRICS:

- Both scores calculated (Design Quality grade AND AI Slop Risk score)
- Grade modifier `~` applied where quality ceiling is below 85%
- All findings sorted into prioritized action list with correct tier ordering
- Quick wins identified and labeled
- AI Slop findings labeled `[SLOP]` in the prioritized list
- User confirmed before proceeding to report generation

## FAILURE MODES:

- Producing only one score and omitting the other
- Downgrading RE-H findings to RE-M to produce a better grade
- Not applying the `~` modifier when quality ceiling is limited
- Prioritized list not actually sorted (random order)
- Proceeding to step 5 without user selecting C

## NEXT STEP:

After user selects [C] and scores are confirmed, load `./step-05-report.md` to generate the full audit report and structured problem ID file.

Remember: Do NOT proceed to step-05 until both scores are calculated and user selects [C]!
