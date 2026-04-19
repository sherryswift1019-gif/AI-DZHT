# Step 3: 10-Category Systematic Audit

## MANDATORY EXECUTION RULES (READ FIRST):

- ANOMALY-DRIVEN OUTPUT — passing items are SILENT. Only report problems found.
- CRITICAL: ALWAYS read the complete step file before taking any action — partial understanding leads to incomplete decisions
- CRITICAL: When loading next step with 'C', ensure the entire file is read and understood before proceeding
- NEVER generate a "pass" list — the absence of findings for a category means no issues found
- EVERY finding must include the standard format: `[Category] | RE-{H/M/L}{n}: {description} | Impact: {user/scenario} | Recommendation: {specific fix}`
- Number findings sequentially within severity across all categories: RE-H1, RE-H2... RE-M1, RE-M2... RE-L1, RE-L2...
- YOU MUST ALWAYS SPEAK OUTPUT in your Agent communication style with the config `{communication_language}`
- YOU MUST ALWAYS WRITE all artifact and document content in `{document_output_language}`

## EXECUTION PROTOCOLS:

- Work through all 10 categories systematically, do not skip any
- Present category-by-category output as you progress
- Apply the quality ceiling from step 1 — do not claim findings you cannot verify at the input type's quality level
- Track total item count processed vs. findings generated
- Present [C] to proceed after all 10 categories are complete

## CONTEXT BOUNDARIES:

- Audit input from step 1 is the primary source — evaluate what EXISTS, not what should exist
- Design intent from UX Spec Part 1 / DESIGN.md provides the intended standard — use for gap detection
- Trunk Test findings from step 2 will become RE findings in this step (carry them forward with IDs)
- Quality ceiling from step 1 constrains what can be reliably assessed

## YOUR TASK:

Execute a systematic audit across 10 categories and 80+ check items. Report every problem found. Register Trunk Test failures from step 2 as RE-H or RE-M findings. Produce a numbered findings list.

## AUDIT EXECUTION:

### Pre-Audit: Register Trunk Test Findings

Convert any Trunk Test failures from step 2 into RE findings:
- Score 0 = RE-H (blocks user orientation = high severity)
- Score 0.5 = RE-M (degrades user orientation = medium severity)
- Score 1 = no finding generated

Begin the sequential counter: RE-H1, RE-H2... for each failure.

---

### Category 1: Visual Hierarchy and Composition (8 items)

**Check items:**
1. Does the primary value proposition or page purpose receive the highest visual weight?
2. Is there a clear visual focal point on each screen (only one "loudest" element)?
3. Is reading order (Z-pattern or F-pattern) respected in layout?
4. Are secondary actions visually subordinate to primary actions?
5. Does visual weight correlate with content importance (larger = more important)?
6. Is negative space used deliberately to group related items?
7. Are decorative elements visually subordinate to functional elements?
8. Does the layout have a discernible grid or alignment system?

**Report findings in format:**
`[Visual Hierarchy] | RE-H{n}: {description} | Impact: {who/when} | Recommendation: {specific fix}`

---

### Category 2: Typography System (15 items)

**Check items:**
1. Are more than 2 typefaces used (excluding icon fonts)?
2. Is there a defined type scale with at most 5–6 size steps?
3. Is body text set at a minimum of 16px (or equivalent)?
4. Is line height for body text between 1.4–1.6?
5. Is line length (measure) within 50–75 characters for body text?
6. Are heading sizes visually distinct enough to convey hierarchy?
7. Is font weight used semantically (bold for emphasis, not decoration)?
8. Is text alignment consistent within content zones (mixed alignment is a violation)?
9. Is there sufficient contrast between heading and body text sizes?
10. Are all-caps used for more than short labels or navigation items?
11. Is letter-spacing applied to body text (reduces readability)?
12. Are there orphaned single words at the end of paragraphs in key UI strings?
13. Is the type scale responsive (does it adapt at mobile breakpoints)?
14. Is the monospace font (if used) appropriate for its context?
15. Do font choices align with the product's emotional tone from the design spec?

**Report findings in format:**
`[Typography] | RE-{H/M/L}{n}: {description} | Impact: {who/when} | Recommendation: {specific fix}`

---

### Category 3: Color and Contrast (10 items)

**Check items:**
1. Is there a consistent semantic color system (one color = one meaning, applied consistently)?
2. Do primary brand colors maintain meaning across all uses (not repurposed decoratively)?
3. Does body text meet WCAG AA minimum contrast ratio of 4.5:1?
4. Do UI components and icons meet WCAG AA minimum contrast ratio of 3:1?
5. Is color used as the sole differentiator for any critical information (color blindness failure)?
6. Are error states consistently red (or equivalent culturally appropriate warning color)?
7. Are success states consistently green (or equivalent)?
8. Are disabled states visually distinct from enabled states?
9. Is the background color consistent across pages of the same type?
10. Are interactive elements distinguishable from non-interactive elements by more than color alone?

**Report findings in format:**
`[Color & Contrast] | RE-{H/M/L}{n}: {description} | Impact: {who/when} | Recommendation: {specific fix}`

---

### Category 4: Spacing and Layout (12 items)

**Check items:**
1. Is spacing consistent — does the product appear to use a spacing scale (4px, 8px, 16px, 24px, 32px)?
2. Is padding within components consistent across similar components?
3. Is margin between sections consistent (not random)?
4. Are component boundaries clearly communicated without borders (via spacing or color)?
5. Is touch target size at least 44×44px for interactive elements?
6. Are clickable areas padded sufficiently (not just the visible label)?
7. Is content consistently aligned to a grid (or consistent left margin)?
8. Is the content width appropriate for the content type (not full-width for reading copy)?
9. Are related items visually grouped by proximity (Gestalt law of proximity)?
10. Are form fields consistently sized and spaced?
11. Are there inconsistencies in card/panel padding within the same context?
12. Is the spacing between inline elements (icons + labels) consistent?

**Report findings in format:**
`[Spacing & Layout] | RE-{H/M/L}{n}: {description} | Impact: {who/when} | Recommendation: {specific fix}`

---

### Category 5: Interaction State Coverage (10 items)

**Check items (for each interactive element found):**
1. Is a hover state defined for all clickable desktop elements?
2. Is a focus state defined for all keyboard-accessible elements (critical for a11y)?
3. Is a loading/pending state defined for all async actions (buttons, form submits, data fetches)?
4. Is an empty state defined for all list/data views (what shows when there is no content)?
5. Is an error state defined for all data-dependent views (what shows when fetch fails)?
6. Is a success state or confirmation defined for all write operations?
7. Is a disabled state defined for conditionally available actions?
8. Is an active/selected state defined for navigation items and toggle elements?
9. Is a destructive action state defined for irreversible operations (confirmation pattern)?
10. Is a timeout/expiry state defined for session-sensitive operations?

**Report findings in format:**
`[Interaction States] | RE-{H/M/L}{n}: {description} | Impact: {who/when} | Recommendation: {specific fix}`

---

### Category 6: Responsive Design (8 items)

**Check items (4 breakpoints: 375px / 768px / 1024px / 1440px):**
1. Does the layout reflow appropriately at 375px (no horizontal overflow)?
2. Does touch-friendly sizing apply at mobile breakpoints (44px minimum targets)?
3. Does content priority shift appropriately at tablet (768px) — secondary content de-emphasized?
4. Does the navigation pattern change appropriately between mobile and desktop?
5. Are images and media sized appropriately for each breakpoint (no fixed-width images on mobile)?
6. Is typography responsive (minimum 16px body text maintained on mobile)?
7. Are form inputs appropriately sized on mobile (not requiring zoom on tap)?
8. Does the 1440px layout use the additional space meaningfully (not just stretched 1024px)?

**Report findings in format:**
`[Responsive Design] | RE-{H/M/L}{n}: {description} | Impact: {who/when} | Recommendation: {specific fix}`

---

### Category 7: Animation and Transitions (6 items)

**Check items:**
1. Are transition durations appropriate? (100–150ms for micro-interactions, 200–300ms for page transitions)
2. Are easing functions intentional? (ease-out for entrances, ease-in for exits, linear only for loaders)
3. Do animations reinforce spatial relationships? (elements animate from their trigger point)
4. Is `prefers-reduced-motion` media query respected — do animations disable/reduce for accessibility?
5. Are animated elements distracting from primary content? (decorative animation should be subtle)
6. Do loading animations provide meaningful feedback or are they purely decorative?

**Report findings in format:**
`[Animation & Transitions] | RE-{H/M/L}{n}: {description} | Impact: {who/when} | Recommendation: {specific fix}`

---

### Category 8: Content and Microcopy (8 items)

**Check items:**
1. Are error messages written in plain user-facing language (not technical codes or system messages)?
2. Do error messages tell users what went wrong AND what to do next?
3. Are empty states helpful — do they explain why there is no content and provide a next action?
4. Are button labels action verbs that describe the outcome (not "Submit" or "Click here")?
5. Are confirmation dialogs for destructive actions specific about what will be destroyed?
6. Are loading messages informative (not just "Loading...")?
7. Is placeholder text in form fields instructive (not used as a label substitute)?
8. Is tooltip and tooltip trigger copy consistent and non-redundant?

**Report findings in format:**
`[Microcopy] | RE-{H/M/L}{n}: {description} | Impact: {who/when} | Recommendation: {specific fix}`

**SPECIAL RULE FOR MICROCOPY FINDINGS:** For every microcopy issue found, provide the revised copy directly in the Recommendation field — not just "fix the error message" but "Change from: '[current text]' → To: '[improved text]'"

---

### Category 9: AI Design Slop Detection (10 items)

**Blacklist — each detected pattern is a finding (severity: RE-M by default, RE-H if it dominates the primary view):**

1. **Purple gradient hero**: large purple-to-pink or purple-to-blue gradient covering the hero area
2. **Three-column grid**: everything arranged in 3 equal columns regardless of content relationship
3. **Colorful icon circles**: feature icons inside colored circular backgrounds (flat illustration style)
4. **Center-everything layout**: marketing-style centered text for product functionality UI
5. **Uniform bubble cards**: all content cards identical size with rounded corners and drop shadow, regardless of content priority differences
6. **Decorative blob/orb shapes**: SVG blobs or glowing orbs used as background decoration
7. **Emoji as design elements**: emoji used in headings, buttons, or navigation labels for visual effect
8. **Colorful border cards**: cards with colored left-border or top-border accent (overused pattern)
9. **Generic hero copy**: headline like "The [adjective] way to [generic verb] [category]" with no specificity
10. **Cookie-cutter rhythm**: every section alternates image-left/text-right regardless of content type

**Report findings in format:**
`[AI Design Slop] | RE-M{n}: AI slop pattern detected — {pattern name}: {description of how it appears} | Impact: Design feels generic and untrustworthy | Recommendation: {specific replacement approach}`

---

### Category 10: Performance as Design (6 items)

**Check items:**
1. Are loading states defined for all network-dependent content?
2. Are skeleton screens used for content that has a known shape (lists, cards, profiles)?
3. Is there a timeout/error state for requests that take longer than expected?
4. Are images optimized/lazy-loaded (check for `loading="lazy"` or equivalent pattern)?
5. Is there perceived performance consideration — does content appear in priority order (above-fold first)?
6. Are heavy animations or transitions that could degrade performance on low-end devices identified?

**Report findings in format:**
`[Performance as Design] | RE-{H/M/L}{n}: {description} | Impact: {who/when} | Recommendation: {specific fix}`

---

### Audit Summary

After completing all 10 categories, present:

```
## Audit Findings Summary

### High Priority (RE-H) — Blocks user flow
[List all RE-H findings with one-line summary]

### Medium Priority (RE-M) — Degrades experience
[List all RE-M findings with one-line summary]

### Low Priority (RE-L) — Optimization opportunities
[List all RE-L findings with one-line summary]

---
Audited: 80+ items across 10 categories
Passed: [n] items (silent)
Issues found: [total] (RE-H: [n], RE-M: [n], RE-L: [n])
```

Confirm:
"[C] Continue — proceed to scoring and prioritization"

## SUCCESS METRICS:

- All 10 categories evaluated (no categories skipped)
- Trunk Test failures from step 2 registered as RE findings with proper IDs
- Finding counter sequential and non-duplicated across severity levels
- Microcopy findings include revised copy in Recommendation field
- AI design slop patterns explicitly enumerated and called by their pattern name
- Anomaly-driven output — no passing items listed
- Summary statistics accurate

## FAILURE MODES:

- Listing passing items in the output (wastes context, violates anomaly-driven protocol)
- Skipping a category because "not applicable" without stating why
- Using vague recommendations like "fix the typography" without specifics
- Missing the microcopy revised-copy rule
- Not carrying forward Trunk Test failures as RE findings
- Using duplicate RE IDs within the same severity tier

## NEXT STEP:

After user selects [C] and all findings are documented, load `./step-04-score.md` to score and prioritize the findings.

Remember: Do NOT proceed to step-04 until all 10 categories are evaluated and summary statistics are presented!
