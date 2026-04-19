# Step 3: Generate DESIGN.md

## MANDATORY EXECUTION RULES (READ FIRST):

- CRITICAL: ALWAYS read the complete step file before taking any action
- ONLY generate content from the confirmed direction chosen in step-02 and context from step-01
- The color system MUST output both dark and light CSS custom properties
- The decision log MUST record every significant decision with rationale and rejected alternatives
- Ask about HTML preview BEFORE writing any files
- YOU MUST ALWAYS SPEAK OUTPUT in your Agent communication style with the config `{communication_language}`

## EXECUTION PROTOCOLS:

- Show a preview of the full DESIGN.md structure before writing
- Present A/P/C menu after preview
- Only write the file when user selects [C]
- After writing, ask about HTML preview
- Update ux-status.md after all writes

## COLLABORATION MENUS (A/P/C):

- **A (Advanced Elicitation)**: Push deeper on any design system section
- **P (Party Mode)**: Multiple perspectives on the design system completeness
- **C (Continue)**: Write DESIGN.md and proceed to preview decision

## CONTEXT BOUNDARIES:

- Use confirmed direction from step-02 memory
- Use product context from step-01 memory
- Every value in DESIGN.md must be derived from the direction — no arbitrary defaults

---

## YOUR TASK:

Generate the complete `DESIGN.md` file from the confirmed aesthetic direction and product context. This is the single source of truth for all visual and interaction decisions in the product.

---

## DESIGN.MD STRUCTURE AND CONTENT RULES:

### Required Sections (all 8 must be present):

#### Section 1 — Aesthetic Direction & Decision Rationale

```markdown
## Aesthetic Direction & Decision Rationale

**Direction**: [Direction name from step-02]
**Established**: {date}
**Product context**: [1 sentence summary from step-01]

### Why this direction

[2-3 paragraphs connecting the chosen direction to the product type, audience, and brand perception adjectives from step-01. Be specific about why alternatives were rejected.]

### SAFE / RISK balance summary

[Table or bullet list of the SAFE/RISK breakdown from step-02, summarizing the intentionality of each significant decision]
```

#### Section 2 — Typography System

Must include ALL of the following:
- Heading font family (name, source URL, fallback stack)
- Body font family (name, source URL, fallback stack)
- MUST verify neither font is on the blacklist
- Modular scale ratio and resulting size sequence (at minimum: xs, sm, base, lg, xl, 2xl, 3xl, 4xl)
- Line height values for each use case (tight/normal/relaxed)
- Letter spacing values (normal, tracked, tight)
- Font weight usage (which weights, when)
- Font blacklist reminder (explicitly listed)
- Usage examples (what level heading uses what size)

CSS variable format:
```css
/* Typography */
--font-heading: 'Font Name', system-ui, sans-serif;
--font-body: 'Font Name', system-ui, sans-serif;
--font-mono: 'Font Name', ui-monospace, monospace;

--text-xs: 0.75rem;    /* 12px */
--text-sm: 0.875rem;   /* 14px */
--text-base: 1rem;     /* 16px */
--text-lg: 1.125rem;   /* 18px */
--text-xl: 1.25rem;    /* 20px */
--text-2xl: 1.5rem;    /* 24px */
--text-3xl: 1.875rem;  /* 30px */
--text-4xl: 2.25rem;   /* 36px */
--text-5xl: 3rem;      /* 48px */

--leading-tight: 1.25;
--leading-normal: 1.5;
--leading-relaxed: 1.75;

--tracking-tight: -0.025em;
--tracking-normal: 0em;
--tracking-wide: 0.025em;
--tracking-widest: 0.1em;
```

#### Section 3 — Color System

MUST include:
- Primary palette (shade scale 50-900 for main brand color)
- Semantic palette (error, warning, success, info — each with default, hover, muted, on-color)
- Neutral/surface palette (background, surface, border, text hierarchy)
- Dark mode AND light mode CSS custom properties (both required, no exceptions)
- Contrast ratio annotations for text/background combinations (WCAG AA compliance)

CSS variable format — BOTH themes required:
```css
/* ===== DARK MODE (default) ===== */
:root,
[data-theme="dark"] {
  /* Backgrounds */
  --bg-base: #000000;
  --bg-surface: #0A0A0A;
  --bg-panel: #141414;
  --bg-overlay: #1C1C1E;

  /* Text */
  --text-primary: rgba(255, 255, 255, 0.92);
  --text-secondary: rgba(255, 255, 255, 0.60);
  --text-tertiary: rgba(255, 255, 255, 0.38);
  --text-disabled: rgba(255, 255, 255, 0.24);

  /* Brand */
  --color-brand: #[hex];
  --color-brand-hover: #[hex];
  --color-brand-muted: #[hex];
  --color-on-brand: #[hex];

  /* Semantic */
  --color-error: #[hex];
  --color-error-muted: #[hex];
  --color-warning: #[hex];
  --color-warning-muted: #[hex];
  --color-success: #[hex];
  --color-success-muted: #[hex];
  --color-info: #[hex];
  --color-info-muted: #[hex];

  /* Borders */
  --border-subtle: rgba(255, 255, 255, 0.08);
  --border-default: rgba(255, 255, 255, 0.15);
  --border-strong: rgba(255, 255, 255, 0.30);
}

/* ===== LIGHT MODE ===== */
[data-theme="light"] {
  /* Backgrounds */
  --bg-base: #FFFFFF;
  --bg-surface: #F9FAFB;
  --bg-panel: #F3F4F6;
  --bg-overlay: #E5E7EB;

  /* Text */
  --text-primary: rgba(0, 0, 0, 0.87);
  --text-secondary: rgba(0, 0, 0, 0.60);
  --text-tertiary: rgba(0, 0, 0, 0.38);
  --text-disabled: rgba(0, 0, 0, 0.24);

  /* Brand */
  --color-brand: #[hex — may differ from dark mode for contrast];
  --color-brand-hover: #[hex];
  --color-brand-muted: #[hex];
  --color-on-brand: #[hex];

  /* Semantic */
  --color-error: #[hex];
  /* ... same structure as dark */

  /* Borders */
  --border-subtle: rgba(0, 0, 0, 0.06);
  --border-default: rgba(0, 0, 0, 0.12);
  --border-strong: rgba(0, 0, 0, 0.24);
}
```

After the CSS variables, include a **Contrast Ratio Table**:
```markdown
| Combination | Ratio | WCAG AA Normal | WCAG AA Large |
|---|---|---|---|
| --text-primary on --bg-base (dark) | X.X:1 | Pass/Fail | Pass/Fail |
| --text-secondary on --bg-base (dark) | X.X:1 | Pass/Fail | Pass/Fail |
| --text-primary on --bg-base (light) | X.X:1 | Pass/Fail | Pass/Fail |
| --color-brand on --bg-base (dark) | X.X:1 | Pass/Fail | Pass/Fail |
```

#### Section 4 — Spacing System

```css
/* Spacing — 4px base unit */
--space-0: 0;
--space-px: 1px;
--space-0_5: 0.125rem;  /* 2px */
--space-1: 0.25rem;     /* 4px */
--space-1_5: 0.375rem;  /* 6px */
--space-2: 0.5rem;      /* 8px */
--space-3: 0.75rem;     /* 12px */
--space-4: 1rem;        /* 16px */
--space-5: 1.25rem;     /* 20px */
--space-6: 1.5rem;      /* 24px */
--space-8: 2rem;        /* 32px */
--space-10: 2.5rem;     /* 40px */
--space-12: 3rem;       /* 48px */
--space-16: 4rem;       /* 64px */
--space-20: 5rem;       /* 80px */
--space-24: 6rem;       /* 96px */
--space-32: 8rem;       /* 128px */
```

Also include semantic spacing aliases:
```css
/* Semantic spacing */
--spacing-component-xs: var(--space-1);    /* 4px — icon padding */
--spacing-component-sm: var(--space-2);    /* 8px — tight component padding */
--spacing-component-md: var(--space-4);    /* 16px — standard component padding */
--spacing-component-lg: var(--space-6);    /* 24px — comfortable component padding */
--spacing-section-sm: var(--space-8);      /* 32px — small section gap */
--spacing-section-md: var(--space-16);     /* 64px — standard section gap */
--spacing-section-lg: var(--space-24);     /* 96px — large section gap */
--spacing-page-margin: var(--space-6);     /* 24px — page horizontal margin (mobile) */
--spacing-page-margin-lg: var(--space-16); /* 64px — page horizontal margin (desktop) */
```

#### Section 5 — Border Radius System

Values must match the direction's shape philosophy from step-02:

```css
/* Border radius */
--radius-none: 0;
--radius-sm: Xpx;   /* small components: badges, tags */
--radius-md: Xpx;   /* standard components: inputs, buttons */
--radius-lg: Xpx;   /* cards, panels */
--radius-xl: Xpx;   /* modals, sheets */
--radius-2xl: Xpx;  /* large containers */
--radius-full: 9999px; /* pills, avatars, circular elements */
```

Include usage guidance:
- `--radius-sm`: Tags, badges, small chips
- `--radius-md`: Buttons, inputs, dropdowns
- `--radius-lg`: Cards, list items, tooltips
- `--radius-xl`: Dialogs, side panels, bottom sheets
- `--radius-full`: Avatars, toggle buttons, loading dots

#### Section 6 — Shadow System

Match the direction's elevation philosophy:

```css
/* Shadows — elevation levels */
--shadow-none: none;
--shadow-xs: [value];   /* Subtle: hover states, minor elevation */
--shadow-sm: [value];   /* Low elevation: dropdowns, tooltips */
--shadow-md: [value];   /* Medium elevation: cards, popovers */
--shadow-lg: [value];   /* High elevation: modals, side panels */
--shadow-xl: [value];   /* Maximum: full-screen overlays */

/* Focus ring (accessibility) */
--shadow-focus: 0 0 0 3px rgba([brand-color-rgb], 0.4);
--shadow-focus-error: 0 0 0 3px rgba([error-color-rgb], 0.4);
```

Note: For flat/minimalist directions, most shadow values may be `none` with `border` substituting for elevation cues. This is intentional and must be noted.

#### Section 7 — Animation System

```css
/* Duration */
--duration-instant: 50ms;
--duration-fast: 100ms;
--duration-normal: 200ms;
--duration-slow: 300ms;
--duration-slower: 500ms;

/* Easing */
--ease-default: cubic-bezier(0.4, 0, 0.2, 1);   /* Standard: most interactions */
--ease-in: cubic-bezier(0.4, 0, 1, 1);           /* Entering: elements appearing */
--ease-out: cubic-bezier(0, 0, 0.2, 1);          /* Exiting: elements leaving */
--ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1); /* Playful: bouncy interactions */
--ease-linear: linear;                             /* Progress bars, loading */
```

Also include the reduced-motion rule (REQUIRED):
```css
/* Reduced motion — WCAG 2.3 AAA / user preference */
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

Usage guidance by interaction type:
- Hover states → `--duration-fast` + `--ease-default`
- Page transitions → `--duration-slow` + `--ease-out`
- Modal open → `--duration-normal` + `--ease-out`
- Success/celebration → `--duration-slower` + `--ease-spring` (only if direction is Playful/Organic)

#### Section 8 — Decision Log

Every significant design decision from steps 1-3 must be recorded:

```markdown
## Decision Log

| # | Decision | Chosen | Rationale | Rejected Alternatives | Date |
|---|---|---|---|---|---|
| 1 | Aesthetic direction | [chosen] | [why] | [what was considered and why rejected] | {date} |
| 2 | Heading font | [chosen] | [why] | [alternatives considered] | {date} |
| 3 | Body font | [chosen] | [why] | [alternatives considered] | {date} |
| 4 | Primary color | [hex] | [why] | [alternatives considered] | {date} |
| 5 | Dark mode default | [yes/no] | [why] | [n/a or alternative] | {date} |
| 6 | Border radius philosophy | [value] | [why] | [alternatives] | {date} |
| 7 | Shadow approach | [value] | [why] | [alternatives] | {date} |
| 8 | Animation philosophy | [value] | [why] | [alternatives] | {date} |
| ... | ... | | | | |
```

---

## EXECUTION SEQUENCE:

### 1. Draft Full DESIGN.md in Memory

Produce the complete DESIGN.md document from all 8 sections using the confirmed direction and product context.

### 2. Present Preview and A/P/C Menu

Show a structural summary of what will be written:

"I've drafted the complete DESIGN.md for {project_name}.

**Structure preview:**
- Aesthetic Direction: {direction name} — {n} SAFE, {n} RISK decisions
- Typography: {heading font} + {body font}, {scale ratio} scale
- Color: {primary color} — {n} tokens defined, dark + light modes
- Spacing: 4px base unit, {n} semantic aliases
- Border Radius: {philosophy, e.g., 'slightly rounded — 4px/8px'}
- Shadows: {philosophy, e.g., 'minimal elevation — borders primary cue'}
- Animation: {philosophy, e.g., 'fast and purposeful, reduced-motion included'}
- Decision Log: {n} decisions recorded

**What would you like to do?**
[A] Advanced Elicitation — Refine specific sections before writing
[P] Party Mode — Multiple perspectives on the design system
[C] Continue — Write DESIGN.md to disk"

### 3. Handle Menu Selection

#### If 'A':
- Ask which section to focus on
- Invoke `bmad-advanced-elicitation` with that section
- Accept/reject loop, return to A/P/C menu

#### If 'P':
- Invoke `bmad-party-mode` with the design system summary
- Accept/reject loop, return to A/P/C menu

#### If 'C':
- Write the complete DESIGN.md to `{project-root}/DESIGN.md`
- Proceed to step 4

### 4. Ask About HTML Preview

After writing DESIGN.md, ask:

"DESIGN.md has been written to `{project-root}/DESIGN.md`.

Would you like me to generate a visual design preview?

A preview HTML file will render your typography, color palette, spacing scale, and component examples so you can visually verify the design system.

[Y] Yes — Generate design preview HTML (invokes bmad-ux-html-gen)
[N] No — Skip preview, finalize the workflow"

#### If Y:
- Invoke the `bmad-ux-html-gen` skill with the DESIGN.md content as input
- The HTML preview will be saved to `{project-root}/design-preview.html`

#### If N:
- Proceed to step 5

### 5. Update ux-status.md

Find or create `{planning_artifacts}/ux-status.md` and add/update:

```markdown
## Design System Status
- **DESIGN.md created**: {date}
- **Direction**: {direction name}
- **Primary color**: {hex}
- **Fonts**: {heading font} + {body font}
- **Dark mode**: {yes/no}
- **Decision log entries**: {n}
- **Preview HTML**: {generated/skipped}
- **Status**: Complete
```

### 6. Final Summary

Present to user:

"**Design System Complete** — {date}

**Files created:**
- `{project-root}/DESIGN.md` — {n lines} — complete design system
{if preview: `- {project-root}/design-preview.html` — visual design preview}
- `{planning_artifacts}/ux-status.md` — design system status updated

**Design summary:**
- Direction: {direction name} ({n} SAFE, {n} RISK decisions)
- Typography: {heading} / {body}
- Primary: {hex}
- Tokens: {n} CSS custom properties
- Decision log: {n} entries

Next step: Run `bmad-ux-plan-review` to validate UX feasibility before sprint planning, or `bmad-create-ux-design` to build the full UX specification."

---

## SUCCESS METRICS:

✅ All 8 DESIGN.md sections generated
✅ Both dark and light mode CSS variables written
✅ Contrast ratio table included
✅ Reduced-motion media query included
✅ Decision log has an entry for every significant decision
✅ No blacklisted fonts used
✅ A/P/C menu presented before writing
✅ ux-status.md updated after writing

## FAILURE MODES:

❌ Generating only dark OR light mode CSS (both required)
❌ Missing the contrast ratio table
❌ Missing the reduced-motion media query
❌ Decision log entries without rejected alternatives
❌ Using a blacklisted font
❌ Writing the file without user [C] confirmation
❌ Not updating ux-status.md
❌ **CRITICAL**: Reading only partial step file
