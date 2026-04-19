# Step Pass 3: User Journey & Emotional Arc

## MANDATORY EXECUTION RULES (READ FIRST):

- CRITICAL: ALWAYS read the complete step file before taking any action
- Source is the Review Working Summary from step-00, NOT the original documents
- YOU ARE A UX REVIEWER — identify emotional design gaps, do not design the experience
- Present findings, then STOP for user confirmation before Pass 4
- YOU MUST ALWAYS SPEAK OUTPUT in your Agent communication style with the config `{communication_language}`

## EXECUTION PROTOCOLS:

- Analyze the Review Working Summary (Section D: User Roles & Core Journeys, Section A: Feature Modules)
- Apply the three journey evaluation criteria below
- Generate Pass 3 findings using the standard output template
- Present A/P/C menu and STOP

## COLLABORATION MENUS (A/P/C):

- **A (Advanced Elicitation)**: Deeper critique of journey and emotional design
- **P (Party Mode)**: Multiple perspectives on user emotional experience
- **C (Continue)**: Accept findings and proceed to Pass 4

## CONTEXT BOUNDARIES:

- Use ONLY the Review Working Summary from step-00
- Do not re-read source documents
- If journeys are not defined in the summary, that is itself a high-severity finding

---

## YOUR TASK:

Evaluate whether the product design accounts for user emotional expectations at each journey step, and whether key success moments are adequately supported.

---

## PASS 3 EVALUATION CRITERIA:

### Criterion 1 — Emotional Expectation Mapping

For each user role in Summary Section D, evaluate:
- Is the emotional state at the START of the journey defined or inferable?
- Is the expected emotional state at the END of the core journey defined?
- Are there steps where frustration or confusion is predictable but not addressed?

**Emotional states to look for**: anxiety, excitement, confusion, frustration, trust, satisfaction, delight, relief

### Criterion 2 — Key Success Moments (Aha! Moments)

Identify the critical moments where the user first experiences the product's core value.
These should be actively designed, not left to chance.

Questions to answer from the summary:
- Is the **first-use success moment** (first task completion) explicitly designed?
- Is the **onboarding → value moment** transition defined?
- Is the **repeat-use engagement hook** defined (what brings users back)?

### Criterion 3 — Friction Point Mapping

Identify points in the described flows where friction is likely but mitigation is absent:
- Multi-step forms without progress indication
- Irreversible actions without confirmation
- Long waits without feedback
- Context switches that break flow
- Error recovery paths that dead-end

---

## OUTPUT TEMPLATE:

```markdown
## Pass 3 — User Journey & Emotional Arc

**Score**: X / 10
**10-point standard**: All core journeys have defined emotional arc, key success moments are explicitly designed, all high-friction points have mitigation
**Current state**: [1-2 sentences describing the journey definition quality found in the summary]

**Journey Emotional Arc Assessment**:
| User Role | Start Emotion | Target End Emotion | Aha! Moment Defined? | Key Friction Points |
|---|---|---|---|---|
| [Role 1] | [emotion] | [emotion] | ✅/⚠️/❌ | [list or 'none identified'] |
| [Role 2] | ... | ... | ... | ... |

**Issues Found**:
- 🔴 [PR-3-H1] [Journey/Role]: [Issue description] → Recommendation: [action]
- 🟠 [PR-3-M1] [Journey/Role]: [Issue description] → Recommendation: [action]
- 🟡 [PR-3-L1] [Journey/Role]: [Issue description] → Recommendation: [action]

**Open Decisions** (if any):
| Decision Point | Impact | Recommendation |
|---|---|---|
```

---

## EXECUTION SEQUENCE:

### 1. Analyze Journeys from Review Working Summary

Map user roles to journeys. If journeys are absent from the summary, immediately flag as 🔴 finding.

### 2. Generate Pass 3 Findings

Produce the Pass 3 findings block using the output template above.
The Journey Emotional Arc table is required even if cells must be marked ❌.

### 3. Present Findings and A/P/C Menu

"**Pass 3 — User Journey & Emotional Arc** is complete.

{Pass 3 findings block}

**What would you like to do?**
[A] Advanced Elicitation — Deeper critique of journey and emotional design
[P] Party Mode — Multiple perspectives on user emotional experience
[C] Continue — Accept findings and move to Pass 4 (AI Slop Risk)"

### 4. Handle Menu Selection

#### If 'A':
- Invoke `bmad-advanced-elicitation` with Pass 3 findings
- Accept/reject loop, return to A/P/C menu

#### If 'P':
- Invoke `bmad-party-mode` with Pass 3 findings
- Accept/reject loop, return to A/P/C menu

#### If 'C':
- Store Pass 3 findings in memory
- Load `./step-pass4-ai-slop.md`

---

## SUCCESS METRICS:

✅ All named user roles from Summary Section D evaluated
✅ Journey Emotional Arc table generated
✅ Key success moments assessed for each role
✅ High-friction points identified with specific locations
✅ A/P/C menu presented and handled correctly
✅ Findings stored in memory, NOT written to file yet

## FAILURE MODES:

❌ Not flagging absent journey definitions as a finding
❌ Omitting the Journey Emotional Arc table
❌ Generic findings not tied to specific roles or features
❌ Auto-proceeding without user [C]
❌ **CRITICAL**: Reading only partial step file
