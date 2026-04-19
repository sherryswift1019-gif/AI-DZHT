# Step Pass 2: Interaction State Coverage

## MANDATORY EXECUTION RULES (READ FIRST):

- CRITICAL: ALWAYS read the complete step file before taking any action
- Source is the Review Working Summary from step-00, NOT the original documents
- YOU ARE A UX REVIEWER — identify missing state definitions, do not design them
- Present findings, then STOP for user confirmation before Pass 3
- YOU MUST ALWAYS SPEAK OUTPUT in your Agent communication style with the config `{communication_language}`

## EXECUTION PROTOCOLS:

- Analyze the Review Working Summary (Section A: Feature Modules, Section E: Known UX Decisions)
- For each feature module, check the five required interaction states
- Generate Pass 2 findings using the standard output template
- Present A/P/C menu and STOP

## COLLABORATION MENUS (A/P/C):

- **A (Advanced Elicitation)**: Deeper critique of state coverage gaps
- **P (Party Mode)**: Multiple perspectives on interaction states
- **C (Continue)**: Accept findings and proceed to Pass 3

## CONTEXT BOUNDARIES:

- Use ONLY the Review Working Summary from step-00
- Do not re-read source documents
- Record any missing state as a finding, not a reason to pause

---

## YOUR TASK:

Evaluate whether all interactive UI components and flows have complete interaction state coverage.

---

## PASS 2 EVALUATION CRITERIA:

### The Five Required States

For every interactive feature or component, the spec must define all five states:

| State | Description | Common omission risk |
|---|---|---|
| **Loading** | System is fetching or processing | Often missing for fast connections assumption |
| **Empty** | No data exists yet (first run or cleared) | Frequently missing from PRDs |
| **Error** | Operation failed or invalid input | Often only HTTP errors considered, not partial failures |
| **Success** | Operation completed successfully | May be assumed, not specified |
| **Partial** | Data is incomplete or access is limited | Almost always missing |

### Feature Coverage Matrix

Build a mental matrix: for each feature module from Summary Section A, check which states are explicitly described anywhere in the summary.

Mark each cell:
- ✅ Explicitly defined in docs
- ⚠️ Implied but not specified
- ❌ Completely absent

Features with two or more ❌ cells are high-severity findings.
Features with any ❌ in Loading or Error are medium-severity findings.

### Edge Case States

Also check for these commonly overlooked states:
- **Offline / connectivity lost** — Is this handled for any feature?
- **Concurrent edit conflict** — If collaborative, is this state defined?
- **Session expiry** — Is the expired-session state during an action defined?
- **Permission change** — What happens mid-flow if user role changes?

---

## OUTPUT TEMPLATE:

```markdown
## Pass 2 — Interaction State Coverage

**Score**: X / 10
**10-point standard**: Every interactive feature has all 5 states (loading/empty/error/success/partial) explicitly defined in the spec
**Current state**: [1-2 sentences describing the state coverage situation found in the summary]

**State Coverage Matrix**:
| Feature Module | Loading | Empty | Error | Success | Partial |
|---|---|---|---|---|---|
| [Feature 1] | ✅/⚠️/❌ | ✅/⚠️/❌ | ✅/⚠️/❌ | ✅/⚠️/❌ | ✅/⚠️/❌ |
| [Feature 2] | ... | ... | ... | ... | ... |

**Issues Found**:
- 🔴 [PR-2-H1] [Feature]: [State] state completely undefined → Recommendation: [specific action]
- 🟠 [PR-2-M1] [Feature]: [State] state implied but not specified → Recommendation: [specific action]
- 🟡 [PR-2-L1] Edge case: [scenario] not addressed → Recommendation: [specific action]

**Open Decisions** (if any):
| Decision Point | Impact | Recommendation |
|---|---|---|
```

---

## EXECUTION SEQUENCE:

### 1. Analyze State Coverage from Review Working Summary

For each feature in Section A, evaluate all five states plus edge cases.

### 2. Generate Pass 2 Findings

Produce the Pass 2 findings block using the output template above.
Include the state coverage matrix — this is a critical deliverable for the team.

### 3. Present Findings and A/P/C Menu

"**Pass 2 — Interaction State Coverage** is complete.

{Pass 2 findings block}

**What would you like to do?**
[A] Advanced Elicitation — Deeper critique of state coverage
[P] Party Mode — Multiple perspectives on interaction states
[C] Continue — Accept findings and move to Pass 3 (User Journey & Emotional Arc)"

### 4. Handle Menu Selection

#### If 'A' (Advanced Elicitation):
- Invoke the `bmad-advanced-elicitation` skill with the current Pass 2 findings
- Ask: "Accept these improvements to Pass 2 findings? (y/n)"
- If yes: Update findings, return to A/P/C menu
- If no: Keep original, return to A/P/C menu

#### If 'P' (Party Mode):
- Invoke the `bmad-party-mode` skill with the current Pass 2 findings
- Ask: "Accept these changes? (y/n)"
- Update or keep, return to A/P/C menu

#### If 'C' (Continue):
- Store Pass 2 findings in memory
- Load `./step-pass3-journey.md`

---

## SUCCESS METRICS:

✅ All feature modules from Summary Section A evaluated
✅ State coverage matrix generated (not optional)
✅ All five states checked per feature
✅ Edge case states evaluated
✅ A/P/C menu presented and handled correctly
✅ Findings stored in memory, NOT written to file yet

## FAILURE MODES:

❌ Re-reading source documents
❌ Omitting the state coverage matrix
❌ Only checking obvious features, missing secondary ones
❌ Auto-proceeding to Pass 3 without user [C]
❌ **CRITICAL**: Reading only partial step file
