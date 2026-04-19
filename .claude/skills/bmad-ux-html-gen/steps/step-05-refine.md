# Step 5: Refinement Loop

## MANDATORY EXECUTION RULES (READ FIRST):

- NEVER re-read the full HTML file to apply a small edit — use the in-memory structure summary
- CRITICAL: ALWAYS read the complete step file before taking any action
- CRITICAL: Use the Edit tool for targeted changes; Write tool only if a full rewrite is explicitly requested
- YOU ARE a focused surgical editor, not a regenerator
- FOCUS on precise, minimal diffs; explain each change in 2-3 lines
- MAXIMUM 10 refinement rounds — enforce the limit
- YOU MUST ALWAYS SPEAK OUTPUT in your Agent communication style with the config `{communication_language}`

## EXECUTION PROTOCOLS:

- Build and maintain the HTML Structure Summary in memory (CSS vars + DOM hierarchy + component list, ~50 lines max)
- Check for RE audit file at loop entry; load high-priority list if found
- After each edit: describe the change, check RE-H tracking, show round counter
- FORBIDDEN to re-read the full HTML file; use the Edit tool with exact target strings

## CONTEXT BOUNDARIES:

- HTML file path from step-04 is in memory
- CSS variable names from step-02 are in memory
- RE audit file path (if found) is in memory for this session
- Changes to design values (colour, size, radius) must be reflected in DESIGN.md

## YOUR TASK:

Enter a collaborative refinement loop: receive user feedback, apply targeted edits with the Edit tool, track RE audit progress, and exit cleanly when done.

## LOOP ENTRY SEQUENCE:

### 1. Build HTML Structure Summary

Do NOT re-read the full HTML file. Reconstruct a compact summary from memory:

```
HTML Structure Summary — {screen-name}
---------------------------------------
CSS Vars:    --color-primary, --color-surface, --font-ui, --space-md, ...  (key vars only)
DOM:
  <body>
    <header>                    [line ~12]
      <nav>                     [line ~15]
    <main>                      [line ~25]
      <section id="...">        [line ~28]
        <article class="...">   [line ~32]
    <script type="module">      [line ~85]

Components:  NavBar, MetricCard, DataTable, ActionButton, ...
```

Maintain this summary and update it after each edit.

### 2. Check for RE Audit File

Look for `{planning_artifacts}/ux-audit-*.md`.

**IF audit file exists:**
- Read only the high-priority issues section (RE-H series)
- Build the RE-H issue list: `{ id: "RE-H1", status: "open", summary: "..." }`
- Show the user:
  > "RE Audit loaded. High-priority issues to address:
  > RE-H1: {summary}
  > RE-H2: {summary}
  > ... "

**IF no audit file exists:**
- Free Refinement Mode — user directs all changes

### 3. Open Loop

Show the loop entry prompt:

```
Refinement Loop — {screen-name}  (Round 1 / 10)
------------------------------------------------
RE High-priority: {N found} / {N total}   [or "Free mode — no audit loaded"]

Open the preview in your browser and describe what you'd like to change.

Commands during the loop:
  [done]    — finish refinement
  [re]      — show RE audit issue list
  [status]  — show round counter and RE-H progress
  [rewrite] — request full regeneration (use sparingly)
```

## REFINEMENT LOOP (REPEAT):

### Per Round:

**A. Receive Feedback**

Wait for user input. Accepted input types:
- Natural language change request: "make the sidebar narrower"
- RE-H ID reference: "fix RE-H1"
- Control command: `done`, `re`, `status`, `rewrite`

**B. Apply Edit**

For natural language or RE-H fix:
1. Identify the exact target in the HTML using the Structure Summary (file + approximate line range)
2. Use the Edit tool to apply a surgical change — do NOT re-read the file first
3. Update the Structure Summary if the DOM structure changed

Example Edit strategy:
- Token change (colour/spacing): target the `:root` CSS variables block
- Layout change (sidebar width): target the specific CSS class rule
- Content change (label text): target the exact text string in HTML
- New component: insert at the identified DOM location

**C. Report the Change**

Describe the edit in 2-3 lines:

> "Changed `--space-sidebar` from `240px` to `200px` in the `:root` block. Sidebar is now narrower on all viewports."

**D. Check Design Decision**

IF the change involved a design value (colour, size, border radius, shadow):
- Append a one-line decision log entry to `DESIGN.md` Part 6:

```
| {date} | HG-refine | {screen-name} | Changed {token} from {old} to {new} — user preference |
```

**E. Check RE-H Tracking**

IF the change addressed a RE-H issue:
- Mark it `✅` in the in-memory RE-H list
- Update the corresponding line in `{planning_artifacts}/ux-audit-*.md`

**F. Show Progress**

At the end of each round:

```
Round {N} / 10 complete
RE High-priority: {fixed} / {total} ✅
```

**G. Check Exit Conditions**

Exit the loop if ANY of:
- User says "done", "finished", "looks good", "I'm happy"
- All RE-H issues are marked ✅
- Round counter reaches 10

## LOOP EXIT:

On exit, produce the Refinement Completion Report:

```
Refinement Complete — {screen-name}
------------------------------------
Rounds completed:  {N}

RE High-Priority Issues:
✅ RE-H1: {summary} — fixed in round {N}
✅ RE-H2: {summary} — fixed in round {N}
...

Unresolved (medium/low priority):
⚠️  RE-M1: {summary} — deferred
⚠️  RE-L1: {summary} — deferred

Final file: {planning_artifacts}/ux-{screen-name}-preview.html
```

### Update ux-status.md

Read `{planning_artifacts}/ux-status.md` and update or append:

```yaml
hg:
  status: completed
  screen: {screen-name}
  html_path: {planning_artifacts}/ux-{screen-name}-preview.html
  re_high_fixed: {N}/{total}
  completed_at: {date}
```

Confirm to the user:

> "ux-status.md updated. The HG workflow for **{screen-name}** is complete.
> To generate the development Handoff, run the **bmad-ux-handoff** skill."

## SUCCESS METRICS:

- Edit tool used for all changes (no full-file rewrites unless explicitly requested)
- HTML Structure Summary maintained and up to date after each round
- All RE-H issues either fixed or explicitly deferred
- Design decisions logged in DESIGN.md when applicable
- ux-status.md updated with HG completion status
- Completion report produced with clear ✅ / ⚠️ breakdown

## FAILURE MODES:

- Re-reading the full HTML file to find a target line
- Doing more than 10 rounds without exit
- Silently ignoring RE-H issues when they exist
- Not updating DESIGN.md when a design token value changes
- Forgetting to update ux-status.md at the end

## NEXT STEP:

This is the final step of the bmad-ux-html-gen skill. On completion, the user can proceed to the **bmad-ux-handoff** skill for development handoff document generation.
