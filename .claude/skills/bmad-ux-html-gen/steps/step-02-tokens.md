# Step 2: Design Token Extraction

## MANDATORY EXECUTION RULES (READ FIRST):

- NEVER invent token values — extract only from source documents
- CRITICAL: ALWAYS read the complete step file before taking any action
- CRITICAL: Use ux-spec-index.md as quick lookup first; only read full spec file if a token is not found in the index
- YOU ARE extracting real design decisions, not applying generic defaults
- FOCUS on producing a compact, confirmed CSS variable definition block (~30 lines)
- YOU MUST ALWAYS SPEAK OUTPUT in your Agent communication style with the config `{communication_language}`

## EXECUTION PROTOCOLS:

- Use smart document reads: index first, then targeted section reads
- Present the Implementation Spec Summary before writing any CSS
- Present A/P/C menu after the summary
- FORBIDDEN to proceed to step-03 until user selects [C]

## COLLABORATION MENUS (A/P/C):

- **A (Advanced Elicitation)**: Invoke `bmad-advanced-elicitation` to challenge token choices
- **P (Party Mode)**: Invoke `bmad-party-mode` to get multiple design perspectives
- **C (Continue)**: Lock in the token set and proceed to Pretext route selection

## PROTOCOL INTEGRATION:

- When 'A' selected: run skill, return to this step's A/P/C menu with updated tokens
- When 'P' selected: run skill, return to this step's A/P/C menu with updated tokens
- User accepts/rejects protocol changes before finalising

## CONTEXT BOUNDARIES:

- Input source mode from step-01 determines which file to read
- screen name slug from step-01 is available
- Tokens extracted here are the single source of truth for CSS in step-04

## YOUR TASK:

Extract the complete design token set from the source documents, produce a compact Implementation Spec Summary, and get user confirmation.

## TOKEN EXTRACTION SEQUENCE:

### 1. Quick Colour Lookup via Index

IF `{planning_artifacts}/ux-spec-index.md` exists:
- Read the index file first
- Extract colour variable references listed there
- Note line numbers / section anchors for any tokens not found

ELSE:
- Proceed directly to reading the primary source file

### 2. Read Primary Source

Based on mode from step-01:

**SPEC_DRIVEN** — Read `{planning_artifacts}/ux-design-specification.md`
- Focus sections: Design Tokens, Colour System, Typography, Spacing, Visual Style

**DESIGN_DRIVEN** — Read `DESIGN.md` from project root
- Focus sections: Part 1 (Tokens), Part 2 (Typography), Part 3 (Spacing / Radii)

**CONVERSATION_DRIVEN** — Ask user directly:
> "No design spec file was found. Please describe your colour palette, font, and spacing preferences, or paste existing CSS variable definitions."
> Wait for user input.

### 3. Extract Token Categories

Collect values for all of the following. Mark `[MISSING]` if not found in any source:

**Colours**
- Primary brand colour (and tints/shades if specified)
- Surface / background colours (light + dark variants)
- Text colours (primary, secondary, muted)
- Danger / error colour
- Success colour
- Border colour

**Typography**
- Primary font family (UI text)
- Mono font family (if applicable)
- Base font size
- Line height base
- Font weight scale (regular, medium, semibold, bold)

**Spacing Scale**
- Base unit (e.g. 4px or 8px)
- Named steps used: xs, sm, md, lg, xl (or numeric scale)

**Shape**
- Border radius values (sm, md, lg, full/pill)

**Elevation / Shadow**
- Shadow values for card, dropdown, modal levels

### 4. Generate Implementation Spec Summary

Produce a CSS custom property block — maximum 30 lines — using the extracted values:

```css
/* === Implementation Spec Summary — {screen-name} === */
:root {
  /* Colour */
  --color-primary:        {value};
  --color-surface:        {value};
  --color-surface-raised: {value};
  --color-text:           {value};
  --color-text-secondary: {value};
  --color-text-muted:     {value};
  --color-danger:         {value};
  --color-success:        {value};
  --color-border:         {value};

  /* Typography */
  --font-ui:              {value};
  --font-mono:            {value};
  --text-base:            {value};
  --leading-base:         {value};

  /* Spacing */
  --space-xs:  {value};
  --space-sm:  {value};
  --space-md:  {value};
  --space-lg:  {value};
  --space-xl:  {value};

  /* Shape */
  --radius-sm: {value};
  --radius-md: {value};
  --radius-lg: {value};
  --radius-full: 9999px;

  /* Shadow */
  --shadow-card:    {value};
  --shadow-modal:   {value};
}
```

Flag any `[MISSING]` tokens and suggest a sensible default (prefixed `/* default */`).

### 5. Present and Confirm

Show the summary block to the user with a brief narrative:

> "Here are the design tokens I extracted for **{screen-name}**. These will become the CSS custom properties in the generated HTML.
>
> [token block above]
>
> Any `[MISSING]` tokens above use neutral defaults.
>
> **What would you like to do?**
> [A] Advanced Elicitation — challenge my token choices
> [P] Party Mode — get multiple design perspectives
> [C] Continue — lock in these tokens and select the Pretext layout mode"

## SUCCESS METRICS:

- All token categories attempted (no silent omissions)
- Missing tokens explicitly flagged and filled with labelled defaults
- CSS variable block is 30 lines or fewer
- Index file used as first lookup when present
- User has reviewed and confirmed before step-03

## FAILURE MODES:

- Inventing token values not present in any source
- Reading the full spec file when the index provides sufficient colour data
- Generating more than 30 lines in the summary block
- Proceeding to step-03 without A/P/C selection

## NEXT STEP:

After user selects [C], load `./step-03-pretext-route.md` to choose the Pretext API layout mode.

Remember: Do NOT proceed to step-03 until user explicitly selects [C]!
