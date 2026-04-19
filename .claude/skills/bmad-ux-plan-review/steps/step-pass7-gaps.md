# Step Pass 7: Open Design Decisions

## MANDATORY EXECUTION RULES (READ FIRST):

- CRITICAL: ALWAYS read the complete step file before taking any action
- Source is the Review Working Summary from step-00, NOT the original documents
- YOU ARE A UX REVIEWER — surface ambiguities that will cause implementation divergence
- This Pass is about what is NOT decided, not what is wrong
- Present findings, then STOP for user confirmation before loading the report step
- YOU MUST ALWAYS SPEAK OUTPUT in your Agent communication style with the config `{communication_language}`

## EXECUTION PROTOCOLS:

- Review ALL previous Pass findings stored in memory for any open decision flags
- Analyze the Review Working Summary holistically for ambiguous language
- Categorize undecided items by implementation risk
- Generate Pass 7 findings using the standard output template
- Present A/P/C menu and STOP

## COLLABORATION MENUS (A/P/C):

- **A (Advanced Elicitation)**: Deeper identification of hidden ambiguities
- **P (Party Mode)**: Multiple perspectives on what decisions are missing
- **C (Continue)**: Accept findings and proceed to the Review Report

## CONTEXT BOUNDARIES:

- Use the Review Working Summary AND the Open Decisions tables from all previous Passes
- This is the final consolidation step before the report
- Categorize by implementation risk: decisions that, if left open, will cause developers to make inconsistent choices

---

## YOUR TASK:

Surface all design decisions that remain ambiguous, unresolved, or undocumented — the gaps that will cause implementation divergence if not resolved before sprint planning.

---

## PASS 7 EVALUATION CRITERIA:

### Criterion 1 — Specification Ambiguity

Identify language in the summary that is deliberately vague or placeholder:
- "TBD", "to be determined", "depends on", "we'll figure out", "flexible"
- Conditional statements without resolution: "if X then Y, otherwise..."
- Options presented without selection: "could be A or B"
- Generic descriptions that require design decision: "show appropriate feedback"

### Criterion 2 — Implementation Fork Points

Identify decisions where two different developers reading the spec could make different, valid choices:
- Component choice forks: "could use a modal or a drawer"
- Behavior forks: "might animate or not"
- Layout forks: "could stack or inline on mobile"
- Content strategy forks: "message tone TBD"

### Criterion 3 — Open Decision Consolidation

Collect ALL open decision items flagged in Passes 1-6 (the "Open Decisions" tables from each Pass).
Deduplicate and re-prioritize by implementation risk:
- **Critical**: Must be decided before first sprint begins
- **High**: Must be decided before the relevant feature is implemented
- **Medium**: Should be decided within the sprint
- **Low**: Can be decided during implementation without significant risk

### Common Sources of Open Decisions

Check these frequent gap areas:
- Copy and microcopy: Are error messages, empty state copy, and CTA labels defined?
- Edge case content: What does the UI show when data exceeds expected length?
- Loading strategy: Skeleton screens, spinners, or progressive disclosure?
- Navigation behavior: Breadcrumbs? Back button behavior? Deep link support?
- Sorting and filtering defaults: What is the default sort order and filter state?
- Notification strategy: Push/in-app/email — which and when?
- Data deletion: Soft delete or hard delete? Recovery window?

---

## OUTPUT TEMPLATE:

```markdown
## Pass 7 — Open Design Decisions

**Score**: X / 10
**10-point standard**: All design decisions are made and documented; zero implementation fork points remain
**Current state**: [1-2 sentences on the overall ambiguity level in the spec]

**Consolidated Open Decisions**:
| # | Decision | Source | Risk Level | Implementation Impact | Recommendation |
|---|---|---|---|---|---|
| 1 | [What is undecided] | [Pass n / Summary] | Critical/High/Medium/Low | [What divergence happens if unresolved] | [Suggested resolution] |
| 2 | ... | | | | |

**Issues Found**:
- 🔴 [PR-7-H1] Critical open decision: [description] — will cause implementation divergence → Must resolve before sprint 1
- 🟠 [PR-7-M1] High-risk ambiguity: [description] → Resolve before feature sprint
- 🟡 [PR-7-L1] Low-risk gap: [description] → Can be resolved during implementation

**Summary Statistics**:
- Total open decisions: {n}
- Critical (must resolve before sprint): {n}
- High (must resolve before feature): {n}
- Medium/Low (can resolve during implementation): {n}
```

---

## EXECUTION SEQUENCE:

### 1. Collect Open Decisions from All Passes

Gather all "Open Decisions" table entries from Passes 1-6 memory.

### 2. Scan Summary for Additional Ambiguities

Look for the patterns listed under Criterion 1 and check the common gap areas from Criterion 3.

### 3. Categorize by Implementation Risk

Assign Critical / High / Medium / Low risk to each open decision.

### 4. Generate Pass 7 Findings

Produce the Pass 7 findings block. The Consolidated Open Decisions table is required and is the primary artifact of this Pass.

### 5. Present Findings and A/P/C Menu

"**Pass 7 — Open Design Decisions** is complete.

{Pass 7 findings block}

This completes all 7 Passes. Ready to generate the final Review Report?

**What would you like to do?**
[A] Advanced Elicitation — Deeper search for hidden ambiguities
[P] Party Mode — Multiple perspectives on open decisions
[C] Continue — Accept findings and generate the Review Report"

### 6. Handle Menu Selection

#### If 'A':
- Invoke `bmad-advanced-elicitation` with Pass 7 findings
- Accept/reject loop, return to A/P/C menu

#### If 'P':
- Invoke `bmad-party-mode` with Pass 7 findings
- Accept/reject loop, return to A/P/C menu

#### If 'C':
- Store Pass 7 findings in memory
- Load `./step-report.md`

---

## SUCCESS METRICS:

✅ Open Decisions consolidated from all previous Passes
✅ Summary scanned for specification ambiguity patterns
✅ Common gap areas checked
✅ Each decision classified by implementation risk
✅ Consolidated Open Decisions table generated
✅ A/P/C menu presented and handled correctly
✅ Findings stored in memory, NOT written to file yet

## FAILURE MODES:

❌ Not collecting open decisions from previous Passes
❌ Only flagging obvious gaps, missing implementation fork points
❌ Omitting the Consolidated Open Decisions table
❌ Auto-proceeding to report without user [C]
❌ **CRITICAL**: Reading only partial step file
