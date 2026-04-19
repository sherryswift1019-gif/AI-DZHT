# Step 4: Page Naming Convention

## MANDATORY EXECUTION RULES (READ FIRST):

- NEVER generate content without user input
- CRITICAL: ALWAYS read the complete step file before taking any action — partial understanding leads to incomplete decisions
- ALWAYS read the complete step file before taking any action
- USE BUSINESS LANGUAGE — never use technical or database terms as page names
- ALL names must be consistent with terminology already used in the PRD
- EVERY page/section in the navigation must have a row in the naming table — no orphans
- Bilingual output is required: display name (English) + route name (code-safe English slug)
- THIS IS THE FINAL IA STEP — trigger all output and status update actions at the end
- YOU MUST ALWAYS SPEAK OUTPUT in your Agent communication style with the config `{communication_language}`
- YOU MUST ALWAYS WRITE all artifact and document content in `{document_output_language}`

## EXECUTION PROTOCOLS:

- Read navigation structure from step 3 and PRD terminology before generating names
- Present naming table for user review before saving
- Perform PRD terminology consistency check
- After user confirms with C, execute ALL four closing actions (save to spec, update index, update status, return to CU if applicable)
- FORBIDDEN to close IA workflow without completing all four closing actions

## COLLABORATION MENUS (A/P/C):

- **A (Advanced Elicitation)**: Invoke `bmad-advanced-elicitation` to review names for clarity, consistency, and user comprehension
- **P (Party Mode)**: Invoke `bmad-party-mode` to validate names with different user perspectives (new users vs. power users vs. developers)
- **C (Continue)**: Save the naming convention, update all status files, and close the IA workflow

## PROTOCOL INTEGRATION:

- When 'A' selected: Invoke `bmad-advanced-elicitation` skill with current naming table
- When 'P' selected: Invoke `bmad-party-mode` skill with current naming table
- Protocols always return to this step's A/P/C menu
- User accepts/rejects protocol changes before proceeding

## CONTEXT BOUNDARIES:

- Navigation structure from step 3 is the definitive list of pages to be named
- PRD terminology governs business language choices
- Route names must be URL-safe: lowercase, hyphens only (no spaces, no underscores, no camelCase)
- This step produces the final IA artifact for Part 2 of the spec document

## YOUR TASK:

Define the formal display names, route names, and descriptions for every page and functional area in the navigation structure. Then close the IA workflow by saving all outputs and updating status files.

## NAMING SEQUENCE:

### 1. Read Navigation Structure and PRD Terminology

Read from `{planning_artifacts}/ux-design-specification.md`:
- The Sitemap section added in step 3 (all navigation nodes)
- Part 1 UX Discovery section (design language and product terminology)

Read from `{planning_artifacts}/*prd*.md` (if exists):
- Feature names and terminology used throughout the PRD
- Any glossary section

Confirm to user:
"I've read the navigation structure ([n] pages/sections to name) and PRD terminology. Building the naming table now..."

### 2. Apply Naming Rules

For each page/section, apply these rules:

**Display Name rules:**
- Use nouns that reflect what the user will find, not what the system does
- Match terminology already established in the PRD
- Avoid: "Management", "Administration", "Module", "Panel", "Dashboard" as generic suffixes
- Use specific names: "Team Members" not "User Management"; "Your Workspace" not "Dashboard"
- Maximum 3 words for any navigation label
- Screen reader friendly — understandable out of context

**Route Name rules (code-safe slug):**
- Lowercase only
- Hyphens as separators (not underscores, not slashes within the slug)
- Abbreviated where appropriate for DX (developer experience)
- Examples: `workspace`, `team-members`, `billing`, `project-settings`

**Description rules:**
- One sentence
- Written for a developer reading the codebase, not an end user
- Explains the primary purpose of the page/component

### 3. Generate Naming Table

Present the complete naming table:

```markdown
## Page Naming Convention — {{project_name}}

### Global Navigation

| Level | Display Name | Route Slug | Description |
|-------|--------------|------------|-------------|
| L1 | [Global Nav Item 1] | `route-slug` | [One-sentence description] |
| L1 | [Global Nav Item 2] | `route-slug` | [One-sentence description] |
| L2 | [Sub-section 1a] | `parent/route-slug` | [One-sentence description] |
...

### Utility Navigation

| Level | Display Name | Route Slug | Description |
|-------|--------------|------------|-------------|
| L1 | [Utility Item 1] | `route-slug` | [One-sentence description] |
...

### Special Pages (system-generated, not in nav)

| Type | Display Name | Route Slug | Description |
|------|--------------|------------|-------------|
| Error | Not Found | `404` | Shown when a URL cannot be resolved |
| Error | Access Denied | `403` | Shown when user lacks permission |
| System | Maintenance | `maintenance` | Shown during planned downtime |
```

### 4. PRD Terminology Consistency Check

After generating the table, run a consistency check:
"**Terminology consistency check against PRD:**
- [Name in table] matches PRD term '[PRD term]': CONSISTENT
- [Name in table] diverges from PRD term '[PRD term]': DIVERGENCE — recommend using '[PRD term]'
- [Name in table]: no PRD reference found — new term, added to product glossary"

Flag any divergences for user resolution before saving.

### 5. Present Content and Menu

"Here is the complete page naming convention for {{project_name}}.

**[n] pages named, [n] route slugs defined**
**Terminology check:** [n] consistent, [n] divergences flagged

**What would you like to do?**
[A] Advanced Elicitation — review names for user comprehension and clarity
[P] Party Mode — validate names from different user perspectives
[C] Continue — save naming convention, finalize IA, update status files"

### 6. On C Selected — Execute Closing Actions

When user selects C, execute all four actions in order:

#### Action 1: Append to UX Design Specification

Append the complete IA output (all steps) to `{planning_artifacts}/ux-design-specification.md` as **Part 2: Information Architecture** with this structure:

```markdown
## Part 2: Information Architecture

### 2.1 Content Inventory
[Content from step 1]

### 2.2 Content Grouping
[Content from step 2]

### 2.3 Navigation Structure
[Mermaid sitemap + navigation type classifications from step 3]

### 2.4 Page Naming Convention
[Naming table from step 4]
```

#### Action 2: Update Spec Index

Update `{planning_artifacts}/ux-spec-index.md`:
- Find the Part 2 row (or create it if it doesn't exist)
- Add the starting and ending line numbers for the Part 2 block just appended
- Format: `| Part 2 | Information Architecture | line [start]–[end] | {date} |`

#### Action 3: Update Status File

Update `{planning_artifacts}/ux-status.md`:
- Mark IA as completed: `IA: COMPLETED {date}`
- Add pointer to the spec file: `ux-design-specification.md Part 2`
- Add step completion record: `Steps completed: inventory, grouping, navigation, naming`

#### Action 4: Return to CU (if applicable)

If this workflow was invoked from Sally's CU sub-flow:
"**IA workflow complete.** Returning context to CU for continuation..."
Resume at the CU step that invoked this skill.

If standalone:
"**IA workflow complete.** Information Architecture for {{project_name}} has been saved to `{planning_artifacts}/ux-design-specification.md` Part 2."

## SUCCESS METRICS:

- Every node from the navigation structure has a row in the naming table (no orphans)
- Display names use business language consistent with PRD terminology
- Route slugs are URL-safe lowercase hyphenated strings
- PRD terminology consistency check performed and divergences resolved
- All four closing actions executed after C is selected
- ux-spec-index.md updated with Part 2 line numbers
- ux-status.md updated marking IA complete

## FAILURE MODES:

- Pages from the navigation structure missing from the naming table
- Using technical terms as display names (e.g., "UserManagementModule")
- Route slugs with uppercase, spaces, or underscores
- Skipping the PRD terminology consistency check
- Executing closing actions without user selecting C
- Failing to execute all four closing actions (partial closure leaves workflow in broken state)
- Not returning to CU when invoked from sub-flow

## NEXT STEP:

This is the final step of the IA workflow. After executing all four closing actions, the IA skill is complete.

If invoked from Sally CU sub-flow: resume CU.
If standalone: present completion summary to user.
