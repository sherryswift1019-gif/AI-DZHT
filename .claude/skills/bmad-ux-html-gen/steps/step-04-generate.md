# Step 4: Generate Self-Contained HTML

## MANDATORY EXECUTION RULES (READ FIRST):

- NEVER use lorem ipsum or placeholder content — all text must be extracted from the UX spec or obtained from the user
- NEVER apply the AI Design Slop blacklist items listed below — zero tolerance
- CRITICAL: ALWAYS read the complete step file before taking any action
- CRITICAL: The generated HTML must pass every item in the Required Checklist before saving
- YOU ARE a production-grade HTML craftsperson, not a template-filler
- FOCUS on generating a complete, self-contained file in one pass
- YOU MUST ALWAYS SPEAK OUTPUT in your Agent communication style with the config `{communication_language}`

## EXECUTION PROTOCOLS:

- Announce generation start and the output file path before writing
- Run through the Required Checklist mentally before saving
- Save the file, then output the preview server command
- FORBIDDEN to enter step-05 until the file is saved and the server command is shown

## CONTEXT BOUNDARIES:

- Vendor resolution (local / CDN) from step-01 is in memory
- CSS custom properties from step-02 token block are in memory
- Pretext API mode from step-03 is in memory
- All real content must be sourced from spec or conversation — never invented

## AI DESIGN SLOP BLACKLIST (NEVER generate these):

- Purple/blue gradient hero backgrounds
- 3-column "Features / Benefits / Pricing" grid with icon + heading + paragraph
- Decorative blob/wave/dot-pattern SVG backgrounds
- Generic CTA button text: "Get Started", "Learn More", "Sign Up Free", "Try It Today"
- Glassmorphism overlays with no functional purpose
- Spinning loader on first paint (before any interaction)
- Rainbow or pastel gradient text headings

If any of these would appear naturally given the spec, substitute with a spec-correct alternative and note the substitution.

## YOUR TASK:

Generate a complete self-contained HTML file that implements the confirmed screen using the Pretext engine and design tokens, then save it and provide the preview server command.

## REQUIRED CHECKLIST (verify before saving):

- [ ] **Pretext engine included** — local vendor path if LOCAL_VENDOR, CDN URL if CDN_FALLBACK
- [ ] **CSS custom properties** — complete token block from step-02, inlined in `<style>`
- [ ] **Dual theme** — `@media (prefers-color-scheme: dark)` overrides present
- [ ] **`document.fonts.ready` gate** — first `prepare()` call is inside `await document.fonts.ready`
- [ ] **Semantic HTML5** — uses `<main>`, `<nav>`, `<header>`, `<section>`, `<article>`, `<aside>` appropriately
- [ ] **`ResizeObserver`** — attached to container, calls `layout()` or equivalent on resize
- [ ] **`prefers-reduced-motion`** — all CSS transitions are wrapped in `@media (prefers-reduced-motion: no-preference)`
- [ ] **Touch targets** — every `<button>`, `<a>`, `<input>` has `min-width: 44px; min-height: 44px`
- [ ] **Real content** — no lorem ipsum; all text extracted from spec or conversation
- [ ] **Preview server comment** — contains the startup comment at the top of `<body>`
- [ ] **No blacklist items** — zero items from the AI Design Slop Blacklist present

## GENERATION SEQUENCE:

### 1. Announce Generation

Tell the user:

> "Generating HTML preview for **{screen-name}**...
>
> Output: `{planning_artifacts}/ux-{screen-name}-preview.html`
> Pretext: {vendor mode + path/URL}
> API Mode: {Mode A / B / C} — {function calls}
> Theme: light + dark auto-detect"

### 2. Build HTML Structure

Generate the complete file following this structure:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{Screen Name} — UX Preview</title>
  <style>
    /* === Design Tokens (from step-02) === */
    :root { ... }
    @media (prefers-color-scheme: dark) { :root { ... } }

    /* === Reset & Base === */
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: var(--font-ui); background: var(--color-surface); color: var(--color-text); }

    /* === Layout === */
    /* Structural layout rules — no decorative elements */

    /* === Components === */
    /* Per-component styles using token references */

    /* === Animations (gated) === */
    @media (prefers-reduced-motion: no-preference) {
      /* transition and animation rules here */
    }

    /* === Touch Targets === */
    button, a, input, [role="button"] {
      min-width: 44px;
      min-height: 44px;
    }
  </style>
</head>
<body>
  <!--
    UX Preview: {screen-name}
    Generated: {date}
    Preview server: python3 -m http.server 7788 --directory {planning_artifacts}
    Then open: http://localhost:7788/ux-{screen-name}-preview.html
  -->

  <!-- Semantic HTML structure here -->
  <header>...</header>
  <main>...</main>

  <!-- Pretext Engine -->
  <script type="module">
    // LOCAL_VENDOR: import { prepare, layout } from './vendor/pretext.js';
    // CDN_FALLBACK: import { prepare, layout } from 'https://esm.sh/@chenglou/pretext@0.0.5';
    import { {api calls} } from '{vendor path or CDN URL}';

    const container = document.querySelector('[data-pretext-root]');

    await document.fonts.ready; // Gate: wait for fonts before first layout

    // Mode A:
    prepare(container, content);
    const ro = new ResizeObserver(() => layout());
    ro.observe(container);
    layout();

    // Mode B: prepareWithSegments + walkLineRanges
    // Mode C: prepareWithSegments + layoutNextLine loop
  </script>
</body>
</html>
```

### 3. Populate Real Content

From the UX spec or conversation, extract:
- Navigation items and labels
- Page heading and subheading
- Section titles
- Data labels and units (for dashboards)
- Form field labels and placeholder text
- Button labels
- Error and empty state copy

Populate the HTML with this real content. Do NOT invent anything.

### 4. Run Checklist

Go through every item in the Required Checklist above. Fix any gaps before saving.

### 5. Save and Confirm

Save the complete file to `{planning_artifacts}/ux-{screen-name}-preview.html`.

Then output:

```
HTML Preview Generated
----------------------
File:    {planning_artifacts}/ux-{screen-name}-preview.html

To preview, run:
  python3 -m http.server 7788 --directory {planning_artifacts}

Then open:
  http://localhost:7788/ux-{screen-name}-preview.html

[C] Continue to refinement loop (step-05)
```

## SUCCESS METRICS:

- All 11 Required Checklist items pass
- Zero blacklist items present
- File saved to correct path
- Preview server command shown with correct directory
- All content sourced from spec (no lorem ipsum)

## FAILURE MODES:

- Generating any item from the AI Design Slop Blacklist
- Using lorem ipsum or "Sample text" placeholders
- Missing `document.fonts.ready` gate before first `prepare()`
- Missing `ResizeObserver` for dynamic re-layout
- Missing `prefers-reduced-motion` media query on animations
- Touch targets smaller than 44x44px
- Using wrong Pretext API for the chosen mode

## NEXT STEP:

After the file is saved and the preview command is shown, load `./step-05-refine.md` to enter the refinement loop.

Remember: Do NOT load step-05 until the HTML file is confirmed saved!
