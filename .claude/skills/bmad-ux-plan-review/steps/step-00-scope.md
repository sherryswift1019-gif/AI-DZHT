# Step 0: Review Scope Assessment & Document Condensation

## MANDATORY EXECUTION RULES (READ FIRST):

- STOP: NEVER proceed to any Pass without completing document condensation first
- CRITICAL: ALWAYS read the complete step file before taking any action
- YOU ARE A UX REVIEW FACILITATOR, not a content generator
- FOCUS on scoping and condensation only — do not run any Pass in this step
- YOU MUST ALWAYS SPEAK OUTPUT in your Agent communication style with the config `{communication_language}`

## EXECUTION PROTOCOLS:

- Show your document discovery findings before taking any action
- Generate the Review Working Summary ONLY after confirming documents with user
- STOP and wait for user confirmation before loading Pass 1
- FORBIDDEN to run any Pass until summary is confirmed

## CONTEXT BOUNDARIES:

- Variables from workflow.md are available in memory
- This step produces the Review Working Summary that ALL subsequent Passes use
- After this step, no Pass will re-read source documents — only the summary
- Keep the summary to 100-200 lines (strict limit)

---

## YOUR TASK:

Assess the review scope by discovering input documents, condensing them into a focused Review Working Summary, and providing an initial UX completeness score.

---

## EXECUTION SEQUENCE:

### 1. Input Document Discovery

Discover and load input documents from the following locations:

- `{planning_artifacts}/**`
- `{project-root}/docs/**`
- `{project-root}/**/*prd*.md`
- `{project-root}/**/*architecture*.md`
- `{project-root}/DESIGN.md`

Target documents (in priority order):

| Document | Pattern | Role |
|---|---|---|
| PRD | `*prd*.md` | Feature modules, user stories, acceptance criteria |
| Architecture Doc | `*architecture*.md` or `*arch*.md` | Technical constraints, stack, API boundaries |
| UX Specification | `*ux-design-specification*.md` | Design tokens, components, patterns |
| Product Brief | `*brief*.md` | Business goals, target audience |
| DESIGN.md | `DESIGN.md` | Design system tokens and decisions |

Also search for sharded folders: if `*prd*` file is not found, look for a `prd/index.md` folder structure.

Report what was found to the user and ask:

"I've discovered the following documents for review:

**Found:**
- PRD: {filename or 'Not found'}
- Architecture: {filename or 'Not found'}
- UX Specification: {filename or 'Not found'}
- Product Brief: {filename or 'Not found'}
- DESIGN.md: {filename or 'Not found'}

Would you like to add any other documents before I begin scoping? Or shall I proceed with what's available?"

### 2. Document Condensation (Critical Step)

After user confirms the document list, extract UX-relevant content from ALL loaded documents and generate a **Review Working Summary** of 100-200 lines.

The summary MUST contain all five sections below:

```markdown
# Review Working Summary — {project_name}
Generated: {date}

## A. Feature Module List (from PRD)
<!-- List all named features/pages/screens/flows, one line each -->
- [Feature/Page Name]: [1-sentence description]

## B. Technical Constraints (from Architecture)
<!-- Constraints that directly affect UX decisions -->
- [Constraint]: [UX implication]

## C. Design Token Core Variables (from UX Spec / DESIGN.md)
<!-- Only the most critical tokens: primary color, font, spacing unit, border-radius -->
- Primary color: ...
- Font family: ...
- Base spacing unit: ...
- Border radius base: ...

## D. User Roles & Core Journeys (from PRD / Brief)
<!-- Named personas and their single most important task -->
- [Role]: [Primary task / goal]

## E. Known UX Decisions Already Made
<!-- Decisions already locked in the spec, to avoid re-questioning them in Passes -->
- [Decision]: [Location in doc]
```

### 3. Initial UX Completeness Score

After generating the summary, provide an initial completeness assessment:

**Initial UX Completeness Score: X / 10**

Scoring guide:
- 9-10: All five sections are well-populated, no obvious gaps
- 7-8: Most sections present, some gaps in technical constraints or journeys
- 5-6: Feature list exists but technical constraints or design tokens are sparse
- 3-4: Only partial PRD available, no architecture or design tokens
- 1-2: Minimal input, review will be largely assumption-based

Note any sections that are missing or sparse — these indicate higher risk areas for the Passes.

### 4. Present Summary and STOP

Present the complete Review Working Summary and initial score to the user:

"**Review Working Summary** ({line count} lines)

{full summary content}

---

**Initial UX Completeness Score: {X}/10**

Basis: {1-2 sentences explaining the score}

**Sparse areas** (higher risk in Passes): {list any empty or thin sections}

This summary will be used as the sole reference for all 7 Passes. No source documents will be re-read.

Ready to begin Pass 1 — Information Architecture?

[C] Continue to Pass 1"

### 5. Wait for User Confirmation

STOP here. Do NOT proceed to Pass 1 until the user explicitly selects [C].

After [C] is selected, load `./step-pass1-ia.md`.

---

## SUCCESS METRICS:

✅ All available documents discovered and confirmed with user
✅ Review Working Summary generated within 100-200 line limit
✅ All five sections present (even if sparse)
✅ Initial completeness score provided with clear basis
✅ STOP checkpoint respected — did not auto-proceed to Pass 1

## FAILURE MODES:

❌ Proceeding to any Pass before summary is confirmed
❌ Summary exceeding 200 lines (context bloat)
❌ Missing any of the five required summary sections
❌ Re-reading source documents in subsequent Passes
❌ Skipping document discovery and working from memory
❌ **CRITICAL**: Not waiting for user [C] confirmation before loading next step
