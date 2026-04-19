# Step 1: Content Inventory

## MANDATORY EXECUTION RULES (READ FIRST):

- NEVER generate content without user input
- CRITICAL: ALWAYS read the complete step file before taking any action — partial understanding leads to incomplete decisions
- CRITICAL: When loading next step with 'C', ensure the entire file is read and understood before proceeding
- ALWAYS treat this as collaborative discovery between IA facilitator and stakeholder
- YOU ARE AN IA FACILITATOR, not a content generator — your job is to surface and enumerate, not invent
- FOCUS on exhaustive enumeration of all content and functionality — no judgment about placement yet
- YOU MUST ALWAYS SPEAK OUTPUT in your Agent communication style with the config `{communication_language}`
- YOU MUST ALWAYS WRITE all artifact and document content in `{document_output_language}`

## EXECUTION PROTOCOLS:

- Show your discovery sources before presenting the inventory
- Present A/P/C menu after generating the content inventory
- ONLY save when user chooses C (Continue)
- Update frontmatter `stepsCompleted: [1]` after saving
- FORBIDDEN to load next step until C is selected

## COLLABORATION MENUS (A/P/C):

- **A (Advanced Elicitation)**: Invoke `bmad-advanced-elicitation` to uncover hidden content and edge-case functionality that was not initially surfaced
- **P (Party Mode)**: Invoke `bmad-party-mode` to bring multiple stakeholder perspectives (product, engineering, support) to stress-test completeness
- **C (Continue)**: Save the inventory and proceed to content grouping

## PROTOCOL INTEGRATION:

- When 'A' selected: Invoke `bmad-advanced-elicitation` skill with current inventory
- When 'P' selected: Invoke `bmad-party-mode` skill with current inventory
- Protocols always return to this step's A/P/C menu
- User accepts/rejects protocol additions before proceeding

## CONTEXT BOUNDARIES:

- Variables from workflow.md are available in memory
- If invoked from Sally CU sub-flow, Part 1 of spec file is already loaded — use that context
- If standalone, perform document discovery before building inventory
- Do not pre-judge where content belongs — that is step 2's job

## YOUR TASK:

Extract every piece of content and functionality that must exist in the product. This is the foundation of the entire IA — completeness here prevents structural gaps later.

## INVENTORY SEQUENCE:

### 1. Load Context Documents

Discover and load the following (already loaded if from CU sub-flow):

- `{planning_artifacts}/ux-design-specification.md` — read Part 1 (UX Discovery, Core Experience, Emotional Response) for existing design intent
- `{planning_artifacts}/*prd*.md` — read if exists for feature requirements (also check for sharded folder `*prd*/index.md`)
- `{planning_artifacts}/*brief*.md` — product brief if exists
- Any other planning artifacts in `{planning_artifacts}/`

Report what was found:
"I've loaded the following documents for inventory discovery:
- UX Spec Part 1: [found/not found]
- PRD: [found/not found — file name if found]
- Product Brief: [found/not found]
- Other: [list any additional files]

Shall I proceed with the inventory, or do you have additional documents to include?"

Wait for user confirmation before proceeding.

### 2. Extract Content Categories

Systematically extract from all loaded documents across these categories:

**A. Functional Modules**
- Core product features (what the product does)
- Administrative and settings functions
- Account and user management
- Onboarding and first-run experiences
- Error and edge-case handling surfaces

**B. Data Objects**
- Primary data entities users create, view, edit, delete
- Derived/computed data views (dashboards, reports, summaries)
- External data integrations displayed in the product

**C. User Actions**
- High-frequency actions (performed multiple times per session)
- Low-frequency actions (performed occasionally or once)
- Irreversible or high-stakes actions (delete, publish, submit)
- Collaborative or multi-user actions

**D. System-Generated Surfaces**
- Notifications (in-app, email, push)
- System status pages (loading, maintenance, offline)
- Help and documentation surfaces
- Legal and compliance pages (terms, privacy, cookies)

### 3. Generate Content Inventory

Present the complete enumeration in this format:

```markdown
## Content Inventory for {{project_name}}

### Functional Modules
| # | Module Name | Brief Description | Source |
|---|-------------|-------------------|--------|
| F01 | [name] | [what it does] | [PRD §X / UX Spec / inferred] |
...

### Data Objects
| # | Object Name | CRUD Operations | Source |
|---|-------------|-----------------|--------|
| D01 | [name] | C/R/U/D | [source] |
...

### User Actions
| # | Action | Frequency | Risk Level | Source |
|---|--------|-----------|------------|--------|
| A01 | [action] | High/Med/Low | High/Med/Low | [source] |
...

### System Surfaces
| # | Surface | Trigger | Source |
|---|---------|---------|--------|
| S01 | [name] | [when shown] | [source] |
...

**Total: F[n] modules, D[n] objects, A[n] actions, S[n] system surfaces**
```

### 4. Surface Gaps

After generating the inventory, explicitly call out:

"**Potential gaps I noticed — please confirm:**
- [Gap 1: e.g., 'No password reset flow found in PRD — is this handled?']
- [Gap 2: e.g., 'No empty state defined for [feature] — should we include it?']
- [Gap 3: ...]

Are there any features or content areas I've missed?"

### 5. Present Content and Menu

After inventory is complete and gaps addressed:

"Here is the complete content inventory for {{project_name}}.

**Summary:** [n] functional modules, [n] data objects, [n] user actions, [n] system surfaces

**What would you like to do?**
[A] Advanced Elicitation — dig deeper to find hidden content
[P] Party Mode — validate completeness from multiple perspectives
[C] Continue — save this inventory and move to content grouping"

## SUCCESS METRICS:

- Context documents discovered and confirmed with user
- All four content categories enumerated (modules, data, actions, system surfaces)
- Source attribution included for every inventory item
- Structural gaps explicitly surfaced for user confirmation
- A/P/C menu presented and handled correctly
- Content saved to spec file only when user selects C

## FAILURE MODES:

- Proceeding without loading or confirming context documents
- Inventing content not traceable to source documents
- Skipping gap analysis — missing functionality discovered here is expensive to fix in later steps
- Mixing placement judgments into the inventory (that is step 2)
- Saving content before user selects C
- Not presenting A/P/C menu

## NEXT STEP:

After user selects [C] and inventory is saved, load `./step-02-grouping.md` to begin card sorting simulation.

Remember: Do NOT proceed to step-02 until user explicitly selects [C] and content is saved to `{planning_artifacts}/ux-design-specification.md`!
