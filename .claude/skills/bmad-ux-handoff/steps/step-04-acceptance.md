# Step 4: UX Acceptance Criteria & Final Document Save

## MANDATORY EXECUTION RULES (READ FIRST):

- NEVER omit any of the 7 mandatory acceptance items — all 7 must appear in the final table
- CRITICAL: ALWAYS read the complete step file before taking any action
- CRITICAL: This is the final step — the Handoff document must be complete and saved before declaring done
- YOU ARE producing the official QA contract between design and engineering
- FOCUS on concrete, testable pass standards — avoid subjective criteria
- YOU MUST ALWAYS SPEAK OUTPUT in your Agent communication style with the config `{communication_language}`

## EXECUTION PROTOCOLS:

- Generate the 7 mandatory acceptance items first, then add feature-specific items
- Present A/P/C menu before saving the final document
- After [C]: save the complete Handoff document, update ux-status.md, confirm to user
- FORBIDDEN to mark the Handoff as complete without updating ux-status.md

## COLLABORATION MENUS (A/P/C):

- **A (Advanced Elicitation)**: Invoke `bmad-advanced-elicitation` to harden acceptance criteria
- **P (Party Mode)**: Invoke `bmad-party-mode` for cross-role review of acceptance standards
- **C (Continue)**: Save the complete Handoff document and finalise

## PROTOCOL INTEGRATION:

- When 'A' or 'P' selected: run skill, return to this step's A/P/C menu with updated criteria
- User accepts/rejects changes before finalising

## CONTEXT BOUNDARIES:

- Feature slug and HTML prototype path from step-01 are in memory
- Component list from step-02 informs feature-specific acceptance items
- Interaction timing specs from step-03 inform the response time acceptance item
- All 4 document sections must be present before saving the final file

## THE 7 MANDATORY ACCEPTANCE ITEMS:

These 7 items MUST appear in every Handoff document, regardless of feature:

| # | Acceptance Item | Test Method | Pass Standard |
|---|---|---|---|
| 1 | Visual fidelity | Compare implementation screenshot side-by-side with HG prototype | Key elements (position, colour, size) within 2px of prototype; no unspecified colours or fonts |
| 2 | Interaction responsiveness | Manual click/tap test on all primary actions | Every action has visible feedback within 100ms (at minimum: loading state or state change) |
| 3 | Keyboard accessibility | Tab key traversal from page load | All interactive elements reachable by Tab; focus ring visible on every focused element |
| 4 | Colour contrast | Browser DevTools accessibility panel or axe extension | Body text ≥ 4.5:1 contrast ratio; large text (18px+ or 14px+ bold) ≥ 3:1 |
| 5 | Touch target size | Inspect CSS computed size in DevTools | All buttons, links, and inputs: minimum 44×44px computed size |
| 6 | Empty state | Clear all data / filter to zero results | Meaningful instructional copy present; no blank white area; at minimum a description of what will appear |
| 7 | Error state | Disable network (DevTools → Offline) and trigger data fetch | User-visible error message present; application does not crash or show raw error object |

## YOUR TASK:

Generate the UX acceptance criteria table, add feature-specific items, present for review, then save the complete Handoff document and update ux-status.md.

## ACCEPTANCE CRITERIA SEQUENCE:

### 1. Generate Base Table

Render the 7 mandatory items in a clean markdown table, customising the "Test Method" column where the HG prototype path is known:

```markdown
## 4. UX Acceptance Criteria

> **How to use this table:** At dev-complete, the developer and/or UX reviewer should run each test method and verify the pass standard. Check ✅ when passed, ❌ when failed (file a bug).

| # | Acceptance Item | Test Method | Pass Standard | Status |
|---|---|---|---|---|
| 1 | Visual fidelity | Open `{html_path}` alongside the implemented screen; use a screenshot overlay tool | Key elements within 2px; no unspecified colours or fonts | |
| 2 | Interaction responsiveness | Click every primary action; time with DevTools Performance panel | Feedback visible ≤ 100ms on all primary actions | |
| 3 | Keyboard accessibility | Tab from page load; record traversal order | All interactive elements reachable; focus ring visible on every element | |
| 4 | Colour contrast | Run axe DevTools or Lighthouse accessibility audit | Body text ≥ 4.5:1; large text ≥ 3:1; no contrast failures | |
| 5 | Touch target size | Inspect computed CSS in DevTools for all buttons, links, inputs | Minimum 44×44px computed size on all targets | |
| 6 | Empty state | Clear all data; filter to zero results; load with empty API response | Instructional copy present; no blank screen | |
| 7 | Error state | DevTools → Network → Offline; trigger main data fetch | Error message shown; app does not crash | |
```

### 2. Add Feature-Specific Acceptance Items

Based on the component list from step-02, add items for any of the following that apply:

**If AI streaming output is in scope:**
```
| 8 | AI stream rendering | Send a test message; observe streaming output area | First token visible within 500ms of send; auto-scroll active when at bottom; stop button functional |
```

**If Human-in-the-loop widget is in scope:**
```
| 9 | HITL approval widget | Trigger an agent action that requires HITL; test keyboard | Widget renders with correct copy; Enter=Approve; Escape=Reject; focus auto-moved to Approve button |
```

**If forms with validation are in scope:**
```
| 10 | Form validation | Submit empty form; submit with invalid inputs; submit valid form | Error messages appear inline below each invalid field; valid submission proceeds without errors |
```

**If modal / drawer is in scope:**
```
| 11 | Focus trap in modal | Open modal; press Tab repeatedly | Focus cycles within modal only; Escape closes modal; focus returns to trigger element |
```

**If responsive layout is in scope:**
```
| 12 | Responsive layout | Resize viewport to 375px, 768px, 1280px, 1440px | No horizontal scroll at any breakpoint; all content readable; no truncated UI elements |
```

Add any other items that arise naturally from the specific feature's component list.

### 3. Add Deferred Items Notice

If there are any precision-tier deferred states or out-of-scope items from step-01, add a note:

```markdown
### Deferred / Out of Scope

The following items were intentionally deferred from this Handoff. They should be addressed in a future sprint or explicitly accepted as known gaps:

- {Deferred item 1}: {reason}
- {Deferred item 2}: {reason}
```

### 4. Present Content and A/P/C Menu

> "I've generated **{N} acceptance criteria** ({7 mandatory + {N} feature-specific}) for **{feature-name}**.
>
> [Show the complete acceptance criteria section]
>
> **What would you like to do?**
> [A] Advanced Elicitation — harden acceptance criteria, add edge cases
> [P] Party Mode — cross-role review (developer + QA + PM perspectives)
> [C] Continue — save the complete Handoff document and mark HD as complete"

### 5. On [C]: Save Complete Document

Read the current `{planning_artifacts}/ux-handoff-{feature}.md` file.

Append `## 4. UX Acceptance Criteria` with the complete table.

Update frontmatter:
```yaml
status: completed
stepsCompleted: [1, 2, 3, 4]
completed_at: {date}
```

Save the file.

### 6. Update ux-status.md

Read `{planning_artifacts}/ux-status.md` and update or append:

```yaml
hd:
  status: completed
  feature: {feature}
  handoff_path: {planning_artifacts}/ux-handoff-{feature}.md
  acceptance_items: {N}
  completed_at: {date}
```

### 7. Confirm Completion

Output the final completion summary:

```
HD Workflow Complete — {feature-name}
--------------------------------------
Handoff document:  {planning_artifacts}/ux-handoff-{feature}.md
Sections:          4 / 4 complete
Acceptance items:  {N} ({7} mandatory + {N-7} feature-specific)
Deferred items:    {N or "none"}

ux-status.md updated: HD ✅ completed

Next steps for the development team:
1. Open the Handoff document and review component state tables
2. Reference the HTML prototype at: {html_path}
3. Run each acceptance test at dev-complete and fill in the Status column
4. File bugs for any ❌ failures before marking the story as Done
```

## SUCCESS METRICS:

- All 7 mandatory acceptance items present with concrete pass standards
- Feature-specific items added for all applicable component types
- Deferred items documented if any were identified
- Complete Handoff document saved with all 4 sections
- ux-status.md updated with HD completion status
- Development team next steps clearly communicated

## FAILURE MODES:

- Omitting any of the 7 mandatory acceptance items
- Pass standards that are subjective (e.g. "looks good", "feels responsive")
- Not saving the complete document — only appending one section
- Not updating ux-status.md
- Declaring HD complete before the user selects [C]

## NEXT STEP:

This is the final step of the bmad-ux-handoff skill. The Handoff document is complete and ready for the development team.

The recommended next skill is **bmad-dev-story** to create implementation story files that reference this Handoff document.
