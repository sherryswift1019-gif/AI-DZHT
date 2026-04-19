---
feature: "{{feature_name}}"
version: "{{version}}"
date: "{{date}}"
precision: "{{precision}}"
# precision options: three-state | six-state | eight-state
# three-state:  default / hover / disabled
# six-state:    default / hover / active / focus / disabled / loading
# eight-state:  default / hover / active / focus / disabled / loading / empty / error
linked-prototype: "{{prototype_path}}"
# example: {planning_artifacts}/prototypes/feature-name.html
components:
  - "{{component-name-1}}"
  - "{{component-name-2}}"
status: "draft"
# status options: draft | ready | approved
---

# Handoff: {{feature_name}}

## Overview

{{One-sentence description of the feature scope and user goal.}}

Interactive prototype: [View HTML Prototype]({{prototype_path}})

---

## Component Specifications

<!-- Repeat this block for every component listed in the frontmatter. -->
<!-- component code-name must be kebab-case, matching React component filename and CSS class convention. -->

### ComponentDisplayName (`component-code-name`)

| Property | Value |
|----------|-------|
| Design token | `--component-code-name-*` |
| Base size | `{{width}} × {{height}}` |
| Spacing | padding: `{{top}} {{right}} {{bottom}} {{left}}` |
| Typography | `{{font-size}} / {{line-height}}` `{{font-weight}}` `{{font-family}}` |
| Border radius | `{{radius}}` |
| Elevation / shadow | `{{box-shadow value or "none"}}` |

#### States ({{precision}} precision)

<!-- Fill in the rows that match the chosen precision. Remove unused rows. -->

| State | Background | Text color | Border | Icon / indicator | Notes |
|-------|-----------|------------|--------|-----------------|-------|
| default | `{{value}}` | `{{value}}` | `{{value}}` | `{{value}}` | — |
| hover | `{{value}}` | `{{value}}` | `{{value}}` | `{{value}}` | cursor: pointer |
| active | `{{value}}` | `{{value}}` | `{{value}}` | `{{value}}` | — |
| focus | `{{value}}` | `{{value}}` | `{{value}}` | `{{value}}` | 2px focus ring: `--focus-ring` |
| disabled | `{{value}}` | `{{value}}` | `{{value}}` | `{{value}}` | opacity: 0.4, cursor: not-allowed |
| loading | `{{value}}` | `{{value}}` | `{{value}}` | spinner | aria-busy="true" |
| empty | `{{value}}` | `{{value}}` | `{{value}}` | — | zero-data state |
| error | `{{value}}` | `{{value}}` | `{{value}}` | error icon | aria-invalid="true" |

#### Responsive Behavior

| Breakpoint | Layout change |
|------------|--------------|
| mobile (< 768px) | `{{describe layout adjustment}}` |
| tablet (768–1199px) | `{{describe layout adjustment}}` |
| desktop (≥ 1200px) | full spec above |

#### Accessibility

- Role: `{{aria role}}`
- Label: `{{aria-label or aria-labelledby reference}}`
- Keyboard: `{{Tab to focus, Enter/Space to activate, Escape to dismiss — list applicable keys}}`
- Screen reader announcement: `"{{exact string read aloud on state change}}"`

---

## Interaction Specifications

<!-- Repeat this block for every distinct interaction. -->

### Interaction: {{InteractionName}}

| Property | Value |
|----------|-------|
| Trigger | `{{user action: click / hover / focus / scroll / swipe / key press}}` |
| Target element | `component-code-name` |
| Response time | `{{duration in ms, e.g. 200ms}}` |
| Animation | `{{CSS property}} {{duration}} {{easing curve}}` — example: `opacity 150ms ease-out` |
| Feedback | `{{visual / haptic / auditory feedback description}}` |
| Post-state | `{{what the UI looks like after the interaction completes}}` |

#### Edge Cases & Boundaries

| Condition | Expected behavior |
|-----------|------------------|
| Network timeout (> 5 s) | Show inline error: "{{error message text}}" |
| Empty input submitted | Block submission; highlight field with `--color-error`; show helper text |
| Concurrent actions (double-click) | Debounce {{Nms}}; ignore second trigger |
| Offline | `{{describe offline fallback behavior}}` |
| `{{other edge case}}` | `{{expected behavior}}` |

---

## UX Acceptance Criteria

| # | Acceptance Item | Test Method | Pass Standard |
|---|----------------|-------------|---------------|
| 1 | Component renders correctly in all `{{precision}}` states | Visual / Storybook snapshot | No deviation from spec above |
| 2 | Focus ring visible on keyboard navigation | Manual keyboard test | 2px outline using `--focus-ring` color |
| 3 | Screen reader announces state changes | NVDA / VoiceOver test | Matches "Accessibility → Screen reader announcement" above |
| 4 | Interaction completes within response time spec | Perf profiler | `≤ {{duration}}ms` from trigger to visible feedback |
| 5 | Error states display correct microcopy | Manual / unit test | Text matches Microcopy section exactly |
| 6 | Responsive layout matches spec at each breakpoint | Browser resize / device emulation | No overflow or layout breakage |
| 7 | Disabled state is non-interactive | Keyboard + click test | No action fires; cursor: not-allowed |
| 8 | Loading state prevents duplicate submissions | Click-spam test | Only one request dispatched |
| 9 | Empty state renders placeholder content | Remove all data | Matches empty-state design |
| 10 | `{{custom acceptance item}}` | `{{test method}}` | `{{pass standard}}` |

---

## Design Tokens Reference

> All values below are defined in `src/styles/tokens.css` (or equivalent design token file).
> Amelia: import these variables directly — do NOT hard-code raw values.

```css
/* Color — Backgrounds */
--bg-base:          {{hex or rgba}};
--bg-surface:       {{hex or rgba}};
--bg-overlay:       {{hex or rgba}};

/* Color — Text */
--text-primary:     {{hex or rgba}};
--text-secondary:   {{hex or rgba}};
--text-disabled:    {{hex or rgba}};

/* Color — Accent & Status */
--accent:           {{hex or rgba}};
--color-success:    {{hex or rgba}};
--color-warning:    {{hex or rgba}};
--color-error:      {{hex or rgba}};

/* Color — Interactive */
--color-hover:      {{hex or rgba}};
--color-active:     {{hex or rgba}};
--focus-ring:       {{hex or rgba}};

/* Typography */
--font-family-base: {{font stack}};
--font-size-sm:     {{value, e.g. 0.75rem}};
--font-size-md:     {{value, e.g. 1rem}};
--font-size-lg:     {{value, e.g. 1.25rem}};
--font-weight-regular: {{value, e.g. 400}};
--font-weight-medium:  {{value, e.g. 500}};
--font-weight-bold:    {{value, e.g. 700}};
--line-height-base:    {{value, e.g. 1.5}};

/* Spacing (base unit: {{N}}px) */
--space-1:  {{Npx}};
--space-2:  {{Npx}};
--space-3:  {{Npx}};
--space-4:  {{Npx}};
--space-6:  {{Npx}};
--space-8:  {{Npx}};

/* Border */
--border-radius-sm:  {{value}};
--border-radius-md:  {{value}};
--border-radius-lg:  {{value}};
--border-radius-full: 9999px;
--border-color:      {{value}};
--border-width:      {{value}};

/* Shadow / Elevation */
--shadow-sm:  {{box-shadow value}};
--shadow-md:  {{box-shadow value}};
--shadow-lg:  {{box-shadow value}};

/* Motion */
--duration-fast:    150ms;
--duration-base:    200ms;
--duration-slow:    300ms;
--easing-standard:  cubic-bezier(0.4, 0, 0.2, 1);
--easing-decelerate: cubic-bezier(0, 0, 0.2, 1);
--easing-accelerate: cubic-bezier(0.4, 0, 1, 1);

/* Z-index scale */
--z-dropdown:  100;
--z-sticky:    200;
--z-overlay:   300;
--z-modal:     400;
--z-toast:     500;
```

---

## Microcopy

> All UI text listed here is the source of truth. Amelia: use these exact strings in code.

### Labels & Placeholders

| Element | String |
|---------|--------|
| `{{component-code-name}}` button label | `"{{Label text}}"` |
| `{{input-field-code-name}}` placeholder | `"{{Placeholder text}}"` |
| `{{other-element}}` | `"{{text}}"` |

### Validation & Error Messages

| Trigger | Message string |
|---------|---------------|
| Required field empty | `"{{error message}}"` |
| Invalid format (e.g. email) | `"{{error message}}"` |
| Value out of range | `"{{error message}}"` |
| Server error (5xx) | `"{{error message}}"` |
| Network error / offline | `"{{error message}}"` |

### Empty States

| Context | Headline | Body text | CTA label |
|---------|----------|-----------|-----------|
| No data yet | `"{{headline}}"` | `"{{body}}"` | `"{{cta}}"` |
| Search no results | `"{{headline}}"` | `"{{body}}"` | `"{{cta}}"` |
| Filtered to zero | `"{{headline}}"` | `"{{body}}"` | `"{{cta}}"` |

### Confirmations & Toasts

| Action | Toast / confirmation text |
|--------|--------------------------|
| Item saved | `"{{success message}}"` |
| Item deleted | `"{{message with undo option}}"` |
| Destructive action confirm dialog | Title: `"{{title}}"` / Body: `"{{body}}"` / Confirm CTA: `"{{cta}}"` / Cancel: `"Cancel"` |

### Tooltips & Helper Text

| Element | Tooltip / helper text |
|---------|----------------------|
| `{{element}}` | `"{{text}}"` |

---

<!-- Handoff document generated by Sally (bmad-agent-ux-designer) via bmad-ux-handoff skill -->
<!-- For Amelia (bmad-agent-dev): parse Component Specifications and Design Tokens Reference as implementation ground truth -->
