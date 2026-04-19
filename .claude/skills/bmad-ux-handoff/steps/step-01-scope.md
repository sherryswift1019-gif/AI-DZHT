# Step 1: Scope Confirmation & Precision Tier Selection

## MANDATORY EXECUTION RULES (READ FIRST):

- NEVER begin writing component specs before the scope and precision tier are confirmed
- CRITICAL: ALWAYS read the complete step file before taking any action
- CRITICAL: When loading next step with 'C', ensure the entire file is read and understood before proceeding
- YOU ARE a Handoff facilitator, not a content auto-generator
- FOCUS on confirming exactly what features are in scope and to what precision
- YOU MUST ALWAYS SPEAK OUTPUT in your Agent communication style with the config `{communication_language}`

## EXECUTION PROTOCOLS:

- Read ux-status.md first to confirm HG completion and retrieve the HTML prototype path
- Ask scope and precision questions in sequence — do not batch them
- Initialise the Handoff document framework before proceeding
- FORBIDDEN to load step-02 until the document framework is created and user selects [C]

## CONTEXT BOUNDARIES:

- `planning_artifacts` variable from workflow.md is in memory
- HTML prototype path is sourced from ux-status.md (do not guess)
- Feature slug becomes part of the output filename

## YOUR TASK:

Confirm the Handoff scope, precision tier, and source file paths, then create the initial Handoff document framework.

## SCOPE CONFIRMATION SEQUENCE:

### 1. Read ux-status.md

Read `{planning_artifacts}/ux-status.md`.

Extract:
- HG completion status
- `html_path` (confirmed HTML prototype location)
- Screen/feature name

IF HG status is NOT completed:
> "Note: ux-status.md does not show a completed HG prototype for this feature. The Handoff will reference the UX spec directly instead of an HTML baseline. Continue? [Y/N]"

### 2. Confirm Feature Scope

Ask the user:

> "What feature or screen does this Handoff cover?
>
> Please provide:
> - **Feature name** (used in the output filename, e.g. `agent-chat`)
> - **Pages / components / flows in scope** (list them or say 'all screens from the HG prototype')
>
> Out-of-scope items will be noted as deferred in the document."

Wait for user response. Derive `{feature}` slug from the feature name.

### 3. Select Precision Tier

Ask the user to choose a precision level:

> "What component state precision level do you need for this Handoff?
>
> **A. Core 3-state** (default + error + loading)
> Recommended for: Sprint kick-off, early development, rapid prototyping
> Coverage: ~60% of user-facing states
>
> **B. Standard 6-state** (+ hover + focus + disabled) ← Recommended
> Recommended for: Most feature deliveries, polished sprint work
> Coverage: ~90% of user-facing states
>
> **C. Full 8-state** (+ active/pressed + empty state)
> Recommended for: Final delivery, design QA, accessibility audit
> Coverage: 100% of specified states
>
> Enter A, B, or C:"

Record the selection as `precision_tier` for use in step-02.

### 4. Confirm Source File Paths

Show the user the source files that will be used:

```
Source Files for Handoff
------------------------
UX Spec:         {planning_artifacts}/ux-design-specification.md
HTML Prototype:  {html_path from ux-status.md}
RE Audit:        {planning_artifacts}/ux-audit-*.md  (if exists)
```

Ask:
> "Are there any additional documents you want included (e.g. brand guidelines, API response shapes, copy deck)? List them or say 'no'."

### 5. Create Handoff Document Framework

Initialise `{planning_artifacts}/ux-handoff-{feature}.md` with this frontmatter and skeleton:

```markdown
---
feature: {feature}
precision_tier: {A / B / C}
html_prototype: {html_path}
ux_spec: {planning_artifacts}/ux-design-specification.md
status: in_progress
created_at: {date}
stepsCompleted: [1]
---

# UX Development Handoff — {Feature Name}

## 1. Scope

**Feature:** {feature name}
**Precision tier:** {A / B / C} — {tier description}
**In scope:** {list from user}
**Out of scope / deferred:** (to be filled)

## 2. Component State Specifications

(populated in step-02)

## 3. Interaction Behaviour Annotations

(populated in step-03)

## 4. UX Acceptance Criteria

(populated in step-04)
```

Save the file, then confirm:

```
Handoff Document Initialised
-----------------------------
File:           {planning_artifacts}/ux-handoff-{feature}.md
Feature:        {feature name}
Precision tier: {A / B / C}
Source HTML:    {html_path}

[C] Continue to component state specifications
```

## SUCCESS METRICS:

- HG status checked from ux-status.md (not assumed)
- Feature slug and precision tier confirmed by user
- All source file paths identified and shown
- Handoff document framework created with correct frontmatter
- User confirmed before step-02 is loaded

## FAILURE MODES:

- Guessing the HTML prototype path instead of reading ux-status.md
- Starting component specs before precision tier is confirmed
- Creating the document without proper frontmatter
- Proceeding to step-02 without [C] confirmation

## NEXT STEP:

After user selects [C], load `./step-02-component-states.md` to define component state specifications.

Remember: Do NOT proceed to step-02 until the document framework is saved and user selects [C]!
