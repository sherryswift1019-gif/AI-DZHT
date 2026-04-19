# Step Pass 5: Design System Alignment

## MANDATORY EXECUTION RULES (READ FIRST):

- CRITICAL: ALWAYS read the complete step file before taking any action
- Source is the Review Working Summary from step-00, NOT the original documents
- YOU ARE A UX REVIEWER — identify alignment gaps and deviations, do not redesign
- Deviations may be intentional — distinguish intentional vs. oversight
- Present findings, then STOP for user confirmation before Pass 6
- YOU MUST ALWAYS SPEAK OUTPUT in your Agent communication style with the config `{communication_language}`

## EXECUTION PROTOCOLS:

- Analyze the Review Working Summary (Section C: Design Token Core Variables, Section E: Known UX Decisions)
- Compare described UI elements against the design system tokens and conventions in the summary
- Classify each deviation as intentional or oversight
- Generate Pass 5 findings using the standard output template
- Present A/P/C menu and STOP

## COLLABORATION MENUS (A/P/C):

- **A (Advanced Elicitation)**: Deeper critique of design system alignment
- **P (Party Mode)**: Multiple perspectives on design consistency
- **C (Continue)**: Accept findings and proceed to Pass 6

## CONTEXT BOUNDARIES:

- Use ONLY the Review Working Summary from step-00
- If DESIGN.md / UX Spec tokens are absent from the summary (Section C is empty), that is itself a high-severity finding
- You cannot assess alignment without knowing both the standard and the proposal

---

## YOUR TASK:

Evaluate whether the proposed UI design is consistent with the established design system (DESIGN.md and UX specification), and whether any deviations are intentional and documented.

---

## PASS 5 EVALUATION CRITERIA:

### Criterion 1 — Token Consistency

For each design token in Summary Section C, check:
- Are the described UI elements using the specified tokens?
- Are there any new visual values introduced that have no matching token?
- Are semantic color tokens used correctly (e.g., error color used for errors, not for accent)?

Token categories to check:
- Color (primary, secondary, semantic: error/warning/success/info)
- Typography (font families, size scale, line heights)
- Spacing (base unit adherence, standard sequence)
- Border radius (per-tier consistency)
- Shadow (elevation levels)
- Animation (duration, easing)

### Criterion 2 — Component Convention Adherence

For each described UI component in the summary:
- Does it match the component patterns defined in the UX spec?
- Are there custom components where standard components could be used?
- Are there standard components being modified in undocumented ways?

### Criterion 3 — Deviation Classification

For each identified deviation:
- **Intentional**: The deviation is explicitly called out as a design decision with rationale
- **Oversight**: The deviation appears to be an omission or inconsistency without rationale
- **Unknown**: Cannot determine intent from the summary (flag for clarification)

---

## OUTPUT TEMPLATE:

```markdown
## Pass 5 — Design System Alignment

**Score**: X / 10
**10-point standard**: All UI elements use established tokens, all deviations are intentional and documented in the decision log
**Current state**: [1-2 sentences on design system token availability and usage consistency]

**Token Coverage**:
| Token Category | Tokens Defined? | Adherence in Proposals | Notes |
|---|---|---|---|
| Color | ✅/⚠️/❌ | ✅/⚠️/❌ | |
| Typography | ✅/⚠️/❌ | ✅/⚠️/❌ | |
| Spacing | ✅/⚠️/❌ | ✅/⚠️/❌ | |
| Border Radius | ✅/⚠️/❌ | ✅/⚠️/❌ | |
| Shadow | ✅/⚠️/❌ | ✅/⚠️/❌ | |
| Animation | ✅/⚠️/❌ | ✅/⚠️/❌ | |

**Deviations Found**:
| Element/Area | Expected (from spec) | Actual (from proposal) | Classification |
|---|---|---|---|
| [element] | [token/convention] | [described value] | Intentional / Oversight / Unknown |

**Issues Found**:
- 🔴 [PR-5-H1] [Area]: [Issue] → Recommendation: [action]
- 🟠 [PR-5-M1] [Area]: [Issue] → Recommendation: [action]
- 🟡 [PR-5-L1] [Area]: [Issue] → Recommendation: [action]

**Open Decisions** (if any):
| Decision Point | Impact | Recommendation |
|---|---|---|
```

---

## EXECUTION SEQUENCE:

### 1. Check Token Availability

If Section C of the Review Working Summary is empty or sparse, immediately add a 🔴 finding: "Design system tokens not captured in scope — alignment cannot be verified."

### 2. Assess Token and Component Consistency

Go through each token category and component mention in the summary.

### 3. Classify Deviations

For each deviation, classify as Intentional / Oversight / Unknown.

### 4. Generate Pass 5 Findings

Produce the Pass 5 findings block. Both the Token Coverage table and Deviations table are required.

### 5. Present Findings and A/P/C Menu

"**Pass 5 — Design System Alignment** is complete.

{Pass 5 findings block}

**What would you like to do?**
[A] Advanced Elicitation — Deeper critique of design system consistency
[P] Party Mode — Multiple perspectives on design alignment
[C] Continue — Accept findings and move to Pass 6 (Responsive & Accessibility)"

### 6. Handle Menu Selection

#### If 'A':
- Invoke `bmad-advanced-elicitation` with Pass 5 findings
- Accept/reject loop, return to A/P/C menu

#### If 'P':
- Invoke `bmad-party-mode` with Pass 5 findings
- Accept/reject loop, return to A/P/C menu

#### If 'C':
- Store Pass 5 findings in memory
- Load `./step-pass6-a11y.md`

---

## SUCCESS METRICS:

✅ Token Coverage table generated for all 6 categories
✅ Each deviation classified (not just listed)
✅ Missing token definitions flagged as high-severity finding
✅ A/P/C menu presented and handled correctly
✅ Findings stored in memory, NOT written to file yet

## FAILURE MODES:

❌ Skipping token assessment when Section C is sparse
❌ Not classifying deviations as intentional/oversight/unknown
❌ Omitting the Token Coverage or Deviations tables
❌ Auto-proceeding without user [C]
❌ **CRITICAL**: Reading only partial step file
