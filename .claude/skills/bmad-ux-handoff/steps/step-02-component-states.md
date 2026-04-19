# Step 2: Component State Specifications

## MANDATORY EXECUTION RULES (READ FIRST):

- NEVER invent state visual descriptions — derive from the UX spec and HTML prototype
- CRITICAL: ALWAYS read the complete step file before taking any action
- CRITICAL: When loading next step with 'C', ensure the entire file is read and understood before proceeding
- YOU ARE documenting what was designed, not designing from scratch
- FOCUS: identify critical components first, apply full precision to those, core precision to the rest
- YOU MUST ALWAYS SPEAK OUTPUT in your Agent communication style with the config `{communication_language}`

## EXECUTION PROTOCOLS:

- Identify critical components (top 3-5 by user interaction frequency) before writing any tables
- Apply `precision_tier` from step-01 to all components, but critical components always get full precision regardless of tier
- Present A/P/C menu after generating the component section
- FORBIDDEN to load step-03 until user selects [C]

## COLLABORATION MENUS (A/P/C):

- **A (Advanced Elicitation)**: Invoke `bmad-advanced-elicitation` to challenge component state coverage
- **P (Party Mode)**: Invoke `bmad-party-mode` for multi-perspective review of state completeness
- **C (Continue)**: Append the component section to the Handoff document and proceed

## PROTOCOL INTEGRATION:

- When 'A' or 'P' selected: run skill, return to this step's A/P/C menu with updated content
- User accepts/rejects changes before finalising

## CONTEXT BOUNDARIES:

- `precision_tier` from step-01 is in memory (A / B / C)
- UX spec file path from step-01 is available
- HTML prototype path is available for visual cross-reference
- CSS token names from the UX spec inform the "CSS Token Reference" column

## STATE DEFINITIONS BY PRECISION TIER:

| State | Tier A (3) | Tier B (6) | Tier C (8) |
|---|---|---|---|
| default | included | included | included |
| error | included | included | included |
| loading | included | included | included |
| hover | — | included | included |
| focus | — | included | included |
| disabled | — | included | included |
| active/pressed | — | — | included |
| empty | — | — | included |

## YOUR TASK:

Identify critical components, classify all in-scope components, and generate state specification tables at the confirmed precision tier.

## COMPONENT SPEC SEQUENCE:

### 1. Identify All In-Scope Components

From the UX spec and HTML prototype, list all interactive components for the feature scope.

Categories to check:
- Navigation (nav bar, sidebar, breadcrumbs, tabs)
- Input controls (text field, textarea, select, checkbox, radio, toggle)
- Action controls (primary button, secondary button, icon button, link button)
- Feedback (toast / snackbar, inline alert, error message, loading spinner)
- Data display (table row, card, list item, metric tile, badge)
- Overlay (modal, drawer, tooltip, dropdown menu)
- AI-specific (stream output area, Human-in-the-loop approval widget, thinking indicator)

### 2. Identify Critical Components

Flag the 3-5 components with the highest user interaction frequency as "CRITICAL". These always receive full 8-state precision regardless of the selected tier.

Ask the user to confirm:

> "Based on the spec, I've identified these as **critical components** (full state coverage regardless of precision tier):
>
> 1. {ComponentName} — {reason, e.g. 'primary action in every flow'}
> 2. {ComponentName} — {reason}
> 3. {ComponentName} — {reason}
>
> Does this look right, or would you adjust the list? [Y to confirm / list your own]"

### 3. Generate Component State Tables

For each component, write a section using this format:

```markdown
### {ComponentName}
**Design name:** {name as it appears in UX spec}
**Code name:** `{kebab-case-name}` (recommended)
**Precision:** {CRITICAL — Full 8-state / Tier A / Tier B / Tier C}

| State | Visual Description | CSS Token Reference |
|---|---|---|
| default | {background, border, text, icon colour at rest} | `--color-surface`, `--color-text` |
| error | {red border, error icon, error text below field} | `--color-danger`, `--color-text` |
| loading | {spinner replaces icon, button text fades to 60%} | `--color-text-muted` |
| hover | {background darkens 8%, cursor pointer} | `--color-primary` |
| focus | {2px focus ring, offset 2px, same colour as primary} | `--color-primary` |
| disabled | {40% opacity, cursor not-allowed, no pointer events} | `--color-text-muted` |
| active/pressed | {scale(0.97), background darkens 16%} | `--color-primary` |
| empty | {placeholder illustration + instructional copy} | `--color-text-muted` |

**Notes:**
- {Any component-specific behaviour that doesn't fit in the table}
- {Animation: e.g. 'spinner enters with fade-in 150ms ease-out'}
```

Only include rows for states applicable to the component's precision tier (or all 8 for CRITICAL components).

### 4. Present Content and A/P/C Menu

After generating all component sections, show:

> "I've documented **{N} components** for **{feature-name}** at **Precision Tier {A/B/C}**.
> Critical components ({N}) received full 8-state coverage.
>
> [Show the component section content here]
>
> **What would you like to do?**
> [A] Advanced Elicitation — challenge state coverage completeness
> [P] Party Mode — get multiple perspectives on component design
> [C] Continue — save to Handoff document and define interaction behaviours"

### 5. On [C]: Append to Document

Append the complete component section under `## 2. Component State Specifications` in `{planning_artifacts}/ux-handoff-{feature}.md`.

Update frontmatter: add `2` to `stepsCompleted` array.

## SUCCESS METRICS:

- All in-scope interactive components identified and listed
- Critical components (3-5) flagged and confirmed by user
- State tables contain real visual descriptions referencing CSS token names
- Empty states included for all data-display components at Tier C
- AI-specific components (stream area, HITL widget) included if applicable
- A/P/C menu presented before saving

## FAILURE MODES:

- Using generic descriptions like "primary colour" instead of `--color-primary`
- Writing empty state descriptions for input controls (empty state only applies to containers)
- Including states beyond the precision tier without marking them as CRITICAL
- Not confirming the critical component list with the user
- Appending to document before user selects [C]

## NEXT STEP:

After user selects [C] and content is saved, load `./step-03-interaction-spec.md` to define interaction behaviour annotations.

Remember: Do NOT proceed to step-03 until user explicitly selects [C]!
