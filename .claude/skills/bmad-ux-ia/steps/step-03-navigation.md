# Step 3: Navigation Structure Design

## MANDATORY EXECUTION RULES (READ FIRST):

- NEVER generate content without user input
- CRITICAL: ALWAYS read the complete step file before taking any action — partial understanding leads to incomplete decisions
- CRITICAL: When loading next step with 'C', ensure the entire file is read and understood before proceeding
- ALWAYS treat this as collaborative discovery between IA facilitator and stakeholder
- MAXIMUM 3 LEVELS DEEP — exceeding 3 clicks to reach any content is a design failure
- Navigation types MUST be explicitly labeled — do not conflate global, local, and contextual navigation
- Apply Trunk Test 6-question validation before presenting navigation to user
- YOU MUST ALWAYS SPEAK OUTPUT in your Agent communication style with the config `{communication_language}`
- YOU MUST ALWAYS WRITE all artifact and document content in `{document_output_language}`

## EXECUTION PROTOCOLS:

- Build navigation hierarchy from content groups defined in step 2
- Validate depth constraint (max 3 levels) before presenting
- Apply Trunk Test validation and show results
- Present A/P/C menu after generating the navigation output
- ONLY save when user chooses C (Continue)
- Update frontmatter adding step 3 to stepsCompleted
- FORBIDDEN to load next step until C is selected

## COLLABORATION MENUS (A/P/C):

- **A (Advanced Elicitation)**: Invoke `bmad-advanced-elicitation` to challenge navigation decisions and explore alternative hierarchy options
- **P (Party Mode)**: Invoke `bmad-party-mode` to test navigation structure from multiple user persona perspectives
- **C (Continue)**: Save navigation structure and proceed to page naming

## PROTOCOL INTEGRATION:

- When 'A' selected: Invoke `bmad-advanced-elicitation` skill with current navigation structure
- When 'P' selected: Invoke `bmad-party-mode` skill with current navigation structure
- Protocols always return to this step's A/P/C menu
- User accepts/rejects protocol changes before proceeding

## CONTEXT BOUNDARIES:

- Content groups from step 2 are saved in the spec document — read them before building navigation
- Navigation labels here are provisional — final names are defined in step 4
- Focus on structure and type classification, not visual design

## YOUR TASK:

Transform content groups into a formal navigation hierarchy, classify each navigation layer by type, enforce the 3-level depth limit, and validate the result with the Trunk Test 6 questions.

## NAVIGATION DESIGN SEQUENCE:

### 1. Read Content Groups

Read the Content Grouping section from `{planning_artifacts}/ux-design-specification.md`.

Confirm:
"I have [n] content groups from step 2 to structure into navigation. Building navigation hierarchy now..."

### 2. Define Navigation Types

Before building hierarchy, classify navigation by type:

**Global Navigation** — present on every page, provides access to top-level sections
- Examples: primary nav bar, sidebar, top nav
- Rule: maximum 7 items (7 ± 2 cognitive limit)
- Rule: must answer "Where can I go from anywhere?"

**Local Navigation** — within a section, provides access to sub-sections
- Examples: section sidebar, tab bar, sub-menu
- Rule: only present when in a section with multiple sub-areas
- Rule: must answer "Where else can I go within this section?"

**Contextual Navigation** — tied to specific content items or actions
- Examples: related content links, action menus, breadcrumb trails
- Rule: appears and disappears based on what the user is viewing
- Rule: must answer "What else relates to this specific item?"

**Utility Navigation** — secondary navigation for account, settings, help
- Examples: header utility bar, footer links, avatar dropdown
- Rule: separate from primary navigation to reduce cognitive load

### 3. Build Navigation Hierarchy

Map each content group to a navigation tier:

**Level 1 — Global Navigation items** (top-level sections): [derived from high-priority groups]
**Level 2 — Local Navigation items** (section sub-areas): [derived from group contents]
**Level 3 — Contextual** (item-level navigation): [only where groupings have nested content]

**Depth Validation Rule:**
- Count the maximum click path from entry point to any leaf content
- If any path exceeds 3 clicks: restructure — combine groups or surface frequently accessed items
- Document the longest path found

### 4. Generate Mermaid Sitemap

Produce a Mermaid tree diagram of the full sitemap:

```mermaid
graph TD
    Root([{{project_name}}])

    Root --> G1[Global Nav Item 1]
    Root --> G2[Global Nav Item 2]
    Root --> G3[Global Nav Item 3]
    Root --> U1[Utility: Account]

    G1 --> G1a[Sub-section 1a]
    G1 --> G1b[Sub-section 1b]
    G1a --> G1a1[Content Page]

    G2 --> G2a[Sub-section 2a]

    U1 --> U1a[Profile]
    U1 --> U1b[Settings]
    U1 --> U1c[Sign Out]
```

Annotate each node with its navigation type:
- `[N]` = Global Navigation
- `[L]` = Local Navigation
- `[C]` = Contextual
- `[U]` = Utility

### 5. Apply Trunk Test Validation

Answer the 6 Trunk Test questions against the proposed navigation:

| Q | Question | Answer from this navigation | Pass? |
|---|----------|----------------------------|-------|
| 1 | What is this? | [Does global nav label reflect the product?] | Y/N |
| 2 | Where am I? | [Is active state achievable in this structure?] | Y/N |
| 3 | What are the main areas? | [Can global nav items convey this?] | Y/N |
| 4 | What can I do here? | [Does the structure enable primary actions to surface?] | Y/N |
| 5 | How do I navigate? | [Is the navigation hierarchy learnable in one pass?] | Y/N |
| 6 | Is there search? | [Is search position defined in the structure?] | Y/N |

If any question fails: revise the navigation before presenting to user.

### 6. Present Navigation and Menu

Present the Mermaid sitemap, navigation type classifications, and Trunk Test results:

"Here is the navigation structure for {{project_name}}.

**Structure summary:**
- Global navigation: [n] items
- Maximum depth: [n] levels (max allowed: 3)
- Longest path: [entry → section → sub-section → content] = [n] clicks
- Trunk Test: [n]/6 passed

**Navigation type breakdown:**
- Global navigation items: [list]
- Local navigation sections: [list]
- Utility navigation: [list]

**What would you like to do?**
[A] Advanced Elicitation — challenge the hierarchy decisions
[P] Party Mode — test navigation with different user mental models
[C] Continue — save this structure and proceed to page naming"

## SUCCESS METRICS:

- All content groups from step 2 placed in the navigation hierarchy
- Maximum depth of 3 levels enforced
- Each node labeled with its navigation type (Global/Local/Contextual/Utility)
- Mermaid sitemap generated and syntactically valid
- Trunk Test validation applied and passed (or failed items revised)
- A/P/C menu presented and handled correctly
- Content saved only when user selects C

## FAILURE MODES:

- Navigation exceeding 3 levels without restructuring
- Failing to classify navigation types (all navigation treated as "navigation")
- Not running Trunk Test validation before presenting to user
- Generating navigation without reading step 2 groups
- Using technical labels as navigation items (e.g., "CRUD module", "API endpoint")
- Saving without user selecting C

## NEXT STEP:

After user selects [C] and navigation structure is saved, load `./step-04-naming.md` to define the formal page naming convention.

Remember: Do NOT proceed to step-04 until user explicitly selects [C] and navigation structure is saved!
