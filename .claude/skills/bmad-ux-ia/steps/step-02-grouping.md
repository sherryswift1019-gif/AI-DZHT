# Step 2: Content Grouping

## MANDATORY EXECUTION RULES (READ FIRST):

- NEVER generate content without user input
- CRITICAL: ALWAYS read the complete step file before taking any action — partial understanding leads to incomplete decisions
- CRITICAL: When loading next step with 'C', ensure the entire file is read and understood before proceeding
- ALWAYS treat this as collaborative discovery between IA facilitator and stakeholder
- YOU ARE SIMULATING CARD SORTING — apply user mental models, not technical or database logic
- FOCUS on grouping rationale, not final navigation labels (that is step 4)
- YOU MUST ALWAYS SPEAK OUTPUT in your Agent communication style with the config `{communication_language}`
- YOU MUST ALWAYS WRITE all artifact and document content in `{document_output_language}`

## EXECUTION PROTOCOLS:

- Show your grouping analysis with explicit rationale for each group
- Apply all three dimensions (mental model, frequency, role) before presenting groups
- Present A/P/C menu after generating the grouping output
- ONLY save when user chooses C (Continue)
- Update frontmatter adding step 2 to stepsCompleted
- FORBIDDEN to load next step until C is selected

## COLLABORATION MENUS (A/P/C):

- **A (Advanced Elicitation)**: Invoke `bmad-advanced-elicitation` to challenge grouping assumptions and surface alternative mental models
- **P (Party Mode)**: Invoke `bmad-party-mode` to test groupings across different user personas and stakeholder perspectives
- **C (Continue)**: Save the grouping results and proceed to navigation structure design

## PROTOCOL INTEGRATION:

- When 'A' selected: Invoke `bmad-advanced-elicitation` skill with current groupings
- When 'P' selected: Invoke `bmad-party-mode` skill with current groupings
- Protocols always return to this step's A/P/C menu
- User accepts/rejects protocol changes before proceeding

## CONTEXT BOUNDARIES:

- Content inventory from step 1 is saved in the spec document
- Read the inventory section before beginning grouping
- Do NOT invent new content — only group what exists in the inventory
- Group names should reflect user language, not system architecture

## YOUR TASK:

Apply card sorting logic across three dimensions to organize the content inventory into logical groups that match how users think, not how the system is structured.

## GROUPING SEQUENCE:

### 1. Review Inventory

Read the Content Inventory section from `{planning_artifacts}/ux-design-specification.md` to retrieve all items from step 1.

Confirm to user:
"I have [n] items from the content inventory to group: [n] modules, [n] data objects, [n] actions, [n] system surfaces.

Beginning card sort simulation across three dimensions..."

### 2. Apply Dimension 1 — User Mental Models

For each inventory item, answer: **"Where would a typical user expect to find this?"**

Use these mental model heuristics:
- Items about "me" (profile, preferences, billing, security) → personal/account space
- Items about "doing the main thing" (core product tasks) → primary workspace
- Items about "setup and configuration" → settings, usually accessed rarely
- Items about "understanding status or results" → dashboards, reports, overviews
- Items about "getting help or support" → help/support area
- Items that "happen to me" (notifications, updates) → notification or activity center

### 3. Apply Dimension 2 — Operational Frequency

For each item, classify:
- **High-frequency** (multiple times per session): must be in primary navigation or always-visible UI
- **Medium-frequency** (once per session or a few times per week): can be in secondary navigation
- **Low-frequency** (occasional, periodic): acceptable in settings, overflow menus, or secondary pages
- **One-time** (onboarding, setup): dedicated flows that are hidden post-completion

Adjust group placement based on frequency — high-frequency items pulled up, low-frequency items pushed down.

### 4. Apply Dimension 3 — User Role Separation

For products with multiple user roles, classify each item:
- Which roles can see/access this item?
- Items exclusive to admin/power users → separate admin area or permission-gated section
- Items shared across all roles → universal navigation
- Items that look the same but behave differently per role → single location with role-aware rendering

### 5. Generate Grouping Output

Present the results:

```markdown
## Content Grouping Results

### Group 1: [Group Name — user-facing language]
**Rationale:** [Why these items belong together — mental model reasoning]
**Access frequency:** [High/Medium/Low]
**User roles:** [All / Admin only / Role X]

| Item ID | Item Name | Dimension 1 fit | Dimension 2 | Dimension 3 |
|---------|-----------|-----------------|-------------|-------------|
| F01 | [name] | [reason] | High | All users |
...

### Group 2: [Group Name]
...

### Grouping Tensions Identified
| Conflict | Items | Proposed Resolution |
|----------|-------|---------------------|
| [e.g., "Notifications could fit in Account or as global overlay"] | S03, S04 | [Recommend placement + reasoning] |
```

### 6. Flag Ungrouped Items

List any items that do not cleanly fit any group:
"**Items needing placement decision:**
- [Item F07: Description — where do you think users expect this?]"

Ask user to resolve each ungrouped item before continuing.

### 7. Present Content and Menu

"Here are the content groups for {{project_name}}.

**[n] groups defined, [n] items placed, [n] tensions identified**

**What would you like to do?**
[A] Advanced Elicitation — challenge the grouping assumptions
[P] Party Mode — test these groups with different user perspectives
[C] Continue — save these groups and design the navigation structure"

## SUCCESS METRICS:

- All inventory items from step 1 placed into a group (no orphans)
- Every group includes explicit rationale from user mental model reasoning
- Frequency classification applied to every group
- Role separation identified where applicable
- Grouping tensions surfaced and resolved before proceeding
- A/P/C menu presented and handled correctly
- Content saved only when user selects C

## FAILURE MODES:

- Grouping by database tables or technical architecture instead of user mental models
- Leaving inventory items ungrouped without flagging them
- Creating groups without written rationale
- Skipping frequency or role dimensions
- Inventing items not present in the step 1 inventory
- Saving without user selecting C

## NEXT STEP:

After user selects [C] and grouping is saved, load `./step-03-navigation.md` to design the navigation hierarchy.

Remember: Do NOT proceed to step-03 until user explicitly selects [C] and grouping results are saved!
