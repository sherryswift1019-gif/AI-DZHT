# Step Pass 1: Information Architecture

## MANDATORY EXECUTION RULES (READ FIRST):

- CRITICAL: ALWAYS read the complete step file before taking any action
- Source is the Review Working Summary from step-00, NOT the original documents
- YOU ARE A UX REVIEWER, not a designer — identify gaps, do not redesign
- Present findings, then STOP for user confirmation before Pass 2
- YOU MUST ALWAYS SPEAK OUTPUT in your Agent communication style with the config `{communication_language}`

## EXECUTION PROTOCOLS:

- Analyze the Review Working Summary (Section A: Feature Modules, Section D: User Roles & Journeys)
- Apply the three IA evaluation criteria below
- Generate Pass 1 findings using the standard output template
- Present A/P/C menu and STOP

## COLLABORATION MENUS (A/P/C):

- **A (Advanced Elicitation)**: Use discovery protocols to develop deeper IA critique
- **P (Party Mode)**: Bring multiple perspectives on the IA structure
- **C (Continue)**: Accept findings and proceed to Pass 2

## CONTEXT BOUNDARIES:

- Use ONLY the Review Working Summary from step-00
- Do not re-read source documents
- Record any missing information as a finding, not a reason to pause

---

## YOUR TASK:

Evaluate the Information Architecture quality of the proposed product using the Review Working Summary.

---

## PASS 1 EVALUATION CRITERIA:

### Criterion 1 — Trunk Test
Can a new user instantly answer all 6 questions from the homepage/main screen?
1. What site/app is this?
2. What can I do here?
3. Where am I right now?
4. What are my main options?
5. Where can I search?
6. Where do I start?

Assess based on the feature module list and user journey descriptions in the summary.

### Criterion 2 — Sitemap Depth
- Is a sitemap or navigation structure defined anywhere in the documents?
- Are all pages/screens reachable within 3 clicks/taps from the root?
- Are there any orphan pages (no clear navigation path to them)?

### Criterion 3 — Hierarchy Clarity
- Is the hierarchy between primary, secondary, and tertiary navigation clear?
- Are related features grouped logically?
- Are there naming conflicts or ambiguous labels?

---

## OUTPUT TEMPLATE:

Generate the following markdown block as the Pass 1 findings:

```markdown
## Pass 1 — Information Architecture

**Score**: X / 10
**10-point standard**: Sitemap defined, all pages ≤ 3 levels deep, homepage passes all 6 Trunk Test questions
**Current state**: [1-2 sentences describing what was found in the summary regarding IA]

**Issues Found**:
- 🔴 [PR-1-H1] [High severity issue] → Recommendation: [specific action]
- 🟠 [PR-1-M1] [Medium severity issue] → Recommendation: [specific action]
- 🟡 [PR-1-L1] [Low severity / suggestion] → Recommendation: [specific action]

**Open Decisions** (if any):
| Decision Point | Impact | Recommendation |
|---|---|---|
| [What is unclear] | [What goes wrong if unresolved] | [Suggested resolution] |
```

Issue severity codes:
- 🔴 High (H): Blocks implementation or creates fundamental UX confusion
- 🟠 Medium (M): Degrades experience, should be resolved before sprint
- 🟡 Low (L): Nice to have improvement

Issue IDs follow the pattern: PR-{pass number}-{severity}{sequence} (e.g. PR-1-H1, PR-1-M2)

If no issues are found in a severity tier, omit that tier row.

---

## EXECUTION SEQUENCE:

### 1. Analyze IA from Review Working Summary

Silently evaluate the three criteria against the summary content.

### 2. Generate Pass 1 Findings

Produce the Pass 1 findings block using the output template above.

### 3. Present Findings and A/P/C Menu

"**Pass 1 — Information Architecture** is complete.

{Pass 1 findings block}

**What would you like to do?**
[A] Advanced Elicitation — Deeper critique of the IA structure
[P] Party Mode — Multiple perspectives on the architecture
[C] Continue — Accept findings and move to Pass 2 (Interaction States)"

### 4. Handle Menu Selection

#### If 'A' (Advanced Elicitation):
- Invoke the `bmad-advanced-elicitation` skill with the current Pass 1 findings
- Ask: "Accept these improvements to Pass 1 findings? (y/n)"
- If yes: Update findings, then return to A/P/C menu
- If no: Keep original findings, return to A/P/C menu

#### If 'P' (Party Mode):
- Invoke the `bmad-party-mode` skill with the current Pass 1 findings
- Ask: "Accept these changes to Pass 1 findings? (y/n)"
- If yes: Update findings, then return to A/P/C menu
- If no: Keep original findings, return to A/P/C menu

#### If 'C' (Continue):
- Store Pass 1 findings in memory (do not write to file yet — all Passes are written together in step-report.md)
- Load `./step-pass2-states.md`

---

## SUCCESS METRICS:

✅ Trunk Test evaluated based on summary content
✅ Sitemap depth assessed
✅ Hierarchy clarity assessed
✅ All findings use the standard output template
✅ Issue IDs follow PR-{pass}-{severity}{seq} format
✅ A/P/C menu presented and handled correctly
✅ Findings stored in memory, NOT written to file

## FAILURE MODES:

❌ Re-reading source documents instead of using the Review Working Summary
❌ Redesigning instead of reviewing (proposing new IA instead of flagging gaps)
❌ Writing findings to file before all Passes are complete
❌ Auto-proceeding to Pass 2 without user [C] selection
❌ Omitting the Open Decisions table when unclear decisions exist
❌ **CRITICAL**: Reading only partial step file
