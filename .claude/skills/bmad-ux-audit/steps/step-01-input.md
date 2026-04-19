# Step 1: Input Detection

## MANDATORY EXECUTION RULES (READ FIRST):

- NEVER begin audit without confirming input type and quality ceiling with user
- CRITICAL: ALWAYS read the complete step file before taking any action — partial understanding leads to incomplete decisions
- CRITICAL: When loading next step with 'C', ensure the entire file is read and understood before proceeding
- YOU ARE AN AUDIT FACILITATOR — your job is to set accurate expectations before any evaluation begins
- NEVER claim higher audit quality than the input type supports
- YOU MUST ALWAYS SPEAK OUTPUT in your Agent communication style with the config `{communication_language}`
- YOU MUST ALWAYS WRITE all artifact and document content in `{document_output_language}`

## EXECUTION PROTOCOLS:

- Detect and classify the input type provided by the user
- State the quality ceiling clearly before proceeding
- Load design intent reference documents
- Present [C] to proceed once input is confirmed
- FORBIDDEN to begin audit steps until input is confirmed

## CONTEXT BOUNDARIES:

- Variables from workflow.md are available in memory
- Design intent context comes from spec file Part 1
- Input type determines what the audit can and cannot assess
- The `{date}` variable from workflow.md sets the audit file name

## YOUR TASK:

Detect the type of input the user has provided for the audit, declare the quality ceiling, and load design intent reference documents before any evaluation begins.

## INPUT DETECTION SEQUENCE:

### 1. Detect Input Type

Examine what the user has provided and classify it:

| Input Type | Description | Quality Ceiling |
|------------|-------------|-----------------|
| **HTML files** | File paths to `.html` / `.htm` files, or inline HTML | 100% — Full structural, semantic, and visual analysis possible |
| **UX Specification** | Path to `ux-design-specification.md` or similar design doc | 85% — Design intent fully assessable; visual rendering inferred |
| **Text Description** | Natural language description of interface | 60–75% — Depends on description precision; structural inference only |

**Unsupported input types (inform user):**
- Live website URLs requiring browser rendering (not supported — no integrated browser binary)
- Screenshots or images (not supported — no image analysis in current config)
- Video recordings or prototypes (not supported)

If the user has not provided input, ask:
"What would you like me to audit? You can provide:
- **HTML file path(s)**: e.g., `/path/to/index.html` — highest quality (100%)
- **UX specification document**: path to your design spec — high quality (85%)
- **Text description**: describe the interface in detail — medium quality (60–75%)

Note: Live URLs and screenshots are not currently supported."

### 2. Declare Quality Ceiling

Once input type is identified, state clearly:

For HTML input:
"**Input confirmed:** HTML file(s) at [path(s)]
**Audit quality ceiling: 100%** — I can assess visual hierarchy, semantic structure, ARIA attributes, spacing, typography classes, and interaction state coverage from the markup."

For UX Spec input:
"**Input confirmed:** UX Specification document at [path]
**Audit quality ceiling: 85%** — I can fully assess design intent, navigation structure, content hierarchy, and pattern consistency. Visual rendering details (exact pixel values, color contrast ratios) will be inferred from the spec rather than measured directly."

For text description:
"**Input confirmed:** Text description
**Audit quality ceiling: [60–75%]** — The quality depends on the precision of your description. I will flag assumptions I make and note areas where I cannot assess without seeing the actual interface. I recommend providing an HTML file or spec document for a more reliable audit."

### 3. Load Design Intent References

Load the following reference documents:

- `{planning_artifacts}/ux-design-specification.md` — read Part 1 for design intent, design principles, visual direction, and target user context (skip if this IS the audit input)
- `DESIGN.md` at `{project-root}/DESIGN.md` — read if exists for design system decisions, color tokens, typography scale

Report what was loaded:
"**Design intent reference loaded:**
- UX Spec Part 1: [loaded / not found — proceeding without design intent reference]
- DESIGN.md: [loaded / not found]

[If not found]: Without a design intent reference, I will audit against general UX best practices rather than your specific design goals."

### 4. Read and Load Audit Input

Load the actual audit target:

- For HTML: read the complete file(s) at the provided path(s)
- For UX Spec: read the complete document, focusing on Part 2 (IA / Sitemap), Part 3 (Visual Design, Patterns, Component Strategy)
- For text: confirm the description is sufficient — ask clarifying questions if major areas are underspecified

### 5. Confirm and Proceed

Present summary to user:

"**Audit Setup Summary:**
- Input: [type and source]
- Quality ceiling: [percentage]
- Design intent reference: [loaded / not available]
- Target: {{project_name}} — [brief description of what will be audited]

[C] Continue — begin Trunk Test (first impression evaluation)"

## SUCCESS METRICS:

- Input type correctly classified
- Quality ceiling explicitly stated before any evaluation begins
- Unsupported input types gracefully declined with explanation
- Design intent reference documents loaded or absence noted
- User confirmed before proceeding to step 2

## FAILURE MODES:

- Beginning evaluation without confirming input type
- Claiming 100% quality for a text description input
- Silently failing to find design intent reference without informing user
- Accepting an unsupported input type (screenshot, live URL) without declining
- Proceeding to step 2 without user confirmation

## NEXT STEP:

After user selects [C], load `./step-02-trunk-test.md` to begin first impression evaluation.

Remember: Do NOT proceed to step-02 until input type is confirmed and quality ceiling has been communicated to the user!
