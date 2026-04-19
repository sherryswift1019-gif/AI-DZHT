# Step Pass 6: Responsive Design & Accessibility

## MANDATORY EXECUTION RULES (READ FIRST):

- CRITICAL: ALWAYS read the complete step file before taking any action
- Source is the Review Working Summary from step-00, NOT the original documents
- YOU ARE A UX REVIEWER — identify gaps, do not redesign
- WCAG AA is the minimum standard; absence of accessibility commitment is a finding
- Present findings, then STOP for user confirmation before Pass 7
- YOU MUST ALWAYS SPEAK OUTPUT in your Agent communication style with the config `{communication_language}`

## EXECUTION PROTOCOLS:

- Analyze the Review Working Summary (Section A: Feature Modules, Section B: Technical Constraints, Section C: Design Tokens)
- Apply the three a11y/responsive evaluation criteria below
- Generate Pass 6 findings using the standard output template
- Present A/P/C menu and STOP

## COLLABORATION MENUS (A/P/C):

- **A (Advanced Elicitation)**: Deeper critique of responsive and accessibility coverage
- **P (Party Mode)**: Multiple perspectives on a11y and responsive design
- **C (Continue)**: Accept findings and proceed to Pass 7

## CONTEXT BOUNDARIES:

- Use ONLY the Review Working Summary from step-00
- If technical constraints (Section B) list specific devices/browsers, those constrain the responsive scope
- If no accessibility commitment is mentioned anywhere in the summary, that is a 🟠 finding

---

## YOUR TASK:

Evaluate whether the design addresses responsive layout requirements and accessibility (WCAG AA minimum) commitments.

---

## PASS 6 EVALUATION CRITERIA:

### Criterion 1 — Responsive Layout Coverage

Check whether the spec defines layouts for all required breakpoints:

| Breakpoint | Width | Key concerns |
|---|---|---|
| Mobile S | 320px | Smallest iPhone SE; minimum viable layout |
| Mobile | 375-390px | Most common mobile size |
| Tablet | 768px | Landscape phone / portrait tablet |
| Desktop | 1280px | Standard laptop |
| Wide | 1440px+ | Large monitor / external display |

For each defined feature/screen in the summary:
- Is a mobile layout described or referenced?
- Are touch targets addressed (minimum 44x44px for interactive elements)?
- Are there features that are "desktop-only" without explicit justification?
- Are data tables, complex charts, or multi-column layouts addressed for mobile?

### Criterion 2 — WCAG AA Commitment

WCAG AA minimum requirements to check:

| Requirement | Criterion |
|---|---|
| Color contrast | Text contrast ≥ 4.5:1 (normal), ≥ 3:1 (large), ≥ 3:1 (UI components) |
| Focus management | Keyboard navigation order defined; focus visible |
| Semantic markup | Heading hierarchy, landmark regions, form labels |
| Alternative text | Non-decorative images have alt text; decorative images hidden from AT |
| Motion | `prefers-reduced-motion` respected; no auto-playing animation without user control |
| Error identification | Form errors identified in text, not color alone |
| Touch target | Interactive elements ≥ 44x44px (Apple) / ≥ 48x48dp (Material) |

For each criterion, check whether it is explicitly committed to in the summary.

### Criterion 3 — Accessibility for Key Flows

Identify the top 3 most important user flows (from Summary Section D) and check:
- Can each flow be completed by keyboard alone?
- Can each flow be completed by screen reader (NVDA/VoiceOver/JAWS)?
- Are there any modal dialogs that trap focus correctly?
- Are there any timed elements with user control?

---

## OUTPUT TEMPLATE:

```markdown
## Pass 6 — Responsive Design & Accessibility

**Score**: X / 10
**10-point standard**: Mobile layout defined for all screens, WCAG AA explicitly committed, all key flows keyboard-navigable
**Current state**: [1-2 sentences on the responsive and a11y definition quality]

**Responsive Coverage**:
| Screen/Feature | Mobile Defined? | Touch Targets? | Mobile Exceptions Documented? |
|---|---|---|---|
| [Screen 1] | ✅/⚠️/❌ | ✅/⚠️/❌ | ✅/N/A/❌ |
| [Screen 2] | ... | ... | ... |

**WCAG AA Coverage**:
| Requirement | Status | Notes |
|---|---|---|
| Color contrast | ✅/⚠️/❌ | |
| Focus management | ✅/⚠️/❌ | |
| Semantic markup | ✅/⚠️/❌ | |
| Alternative text | ✅/⚠️/❌ | |
| Motion / reduced-motion | ✅/⚠️/❌ | |
| Error identification | ✅/⚠️/❌ | |
| Touch targets | ✅/⚠️/❌ | |

**Issues Found**:
- 🔴 [PR-6-H1] [Area]: [Issue] → Recommendation: [action]
- 🟠 [PR-6-M1] [Area]: [Issue] → Recommendation: [action]
- 🟡 [PR-6-L1] [Area]: [Issue] → Recommendation: [action]

**Open Decisions** (if any):
| Decision Point | Impact | Recommendation |
|---|---|---|
```

---

## EXECUTION SEQUENCE:

### 1. Analyze Responsive and A11y Coverage

Go through both tables systematically using only the Review Working Summary.

### 2. Assess Key Flow Accessibility

Identify top 3 user flows and check keyboard/screen reader viability.

### 3. Generate Pass 6 Findings

Produce the Pass 6 findings block. Both the Responsive Coverage and WCAG AA Coverage tables are required.

### 4. Present Findings and A/P/C Menu

"**Pass 6 — Responsive Design & Accessibility** is complete.

{Pass 6 findings block}

**What would you like to do?**
[A] Advanced Elicitation — Deeper critique of responsive and a11y coverage
[P] Party Mode — Multiple perspectives on accessibility
[C] Continue — Accept findings and move to Pass 7 (Open Design Decisions)"

### 5. Handle Menu Selection

#### If 'A':
- Invoke `bmad-advanced-elicitation` with Pass 6 findings
- Accept/reject loop, return to A/P/C menu

#### If 'P':
- Invoke `bmad-party-mode` with Pass 6 findings
- Accept/reject loop, return to A/P/C menu

#### If 'C':
- Store Pass 6 findings in memory
- Load `./step-pass7-gaps.md`

---

## SUCCESS METRICS:

✅ Responsive Coverage table generated for all named screens
✅ WCAG AA Coverage table generated for all 7 requirements
✅ Key flow keyboard/screen reader viability assessed
✅ No-accessibility-commitment finding raised if absent
✅ A/P/C menu presented and handled correctly
✅ Findings stored in memory, NOT written to file yet

## FAILURE MODES:

❌ Not flagging absent WCAG commitment
❌ Omitting either required table
❌ Not checking mobile for features that are "complex" (tables, charts, multi-column)
❌ Auto-proceeding without user [C]
❌ **CRITICAL**: Reading only partial step file
