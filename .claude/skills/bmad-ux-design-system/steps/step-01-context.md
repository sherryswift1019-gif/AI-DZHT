# Step 1: Product Context Confirmation

## MANDATORY EXECUTION RULES (READ FIRST):

- NEVER generate design content without user input
- CRITICAL: ALWAYS read the complete step file before taking any action
- YOU ARE A DESIGN SYSTEM FACILITATOR, not a content generator
- FOCUS on context discovery only — do not propose any design direction in this step
- YOU MUST ALWAYS SPEAK OUTPUT in your Agent communication style with the config `{communication_language}`

## EXECUTION PROTOCOLS:

- Check for existing DESIGN.md first — handle continuation correctly
- Ask all context questions in a single, clear prompt
- Wait for user answers before proceeding to any design direction
- FORBIDDEN to propose aesthetic directions until step-02
- STOP and wait for user before loading step-02

## CONTEXT BOUNDARIES:

- Variables from workflow.md are available in memory
- Previous context = any existing DESIGN.md or product brief found
- Do not assume product context from the project name alone

---

## YOUR TASK:

Confirm the product context that will drive all design system decisions. This step is about understanding the product, audience, and constraints — not designing yet.

---

## EXECUTION SEQUENCE:

### 1. Check for Existing DESIGN.md

First, check if `{project-root}/DESIGN.md` already exists:

- If it exists: read the file completely, then tell the user:
  "I found an existing DESIGN.md for {project_name}. Would you like to:
  [A] Update / extend the existing design system
  [B] Start fresh (the existing file will be replaced)
  [C] Cancel"

  - If A: carry forward existing decisions as context; note what is being updated in memory
  - If B: proceed as fresh workflow, existing file will be overwritten at step-03
  - If C: exit the workflow

- If no DESIGN.md exists: proceed as fresh workflow

### 2. Context Document Discovery

Discover relevant product context from:
- `{planning_artifacts}/**`
- `{project-root}/**/*brief*.md`
- `{project-root}/**/*prd*.md`
- `{project-root}/**/*architecture*.md`

Load and read any found documents silently. Use them to pre-fill or suggest answers in step 3.

### 3. Ask Context Questions

Present all five context questions in a single prompt:

"Let's establish the design context for **{project_name}**.

I'll ask you 5 questions to ensure the design system fits your product perfectly. Answer as many as you can — the more detail you provide, the more intentional the result.

---

**1. Product type** — Which best describes your product?
   - Tool / Productivity (users come with a task to complete)
   - Consumer (daily use, emotional connection matters)
   - Enterprise / B2B (efficiency, information density, trust)
   - Media / Content (reading, discovery, storytelling)
   - Developer tool (terminal aesthetic, precision)
   - Marketplace / Commerce (conversion, product browsing)
   - Other: ___

**2. Target audience**
   - Primary users: [describe who they are]
   - Technical comfort: Non-technical / Mixed / Technical / Experts only
   - Age range (if relevant): ___
   - Any accessibility requirements (e.g., users with visual impairments, color blindness): ___

**3. Competitor or reference designs**
   - Products your users likely use / compare against: ___
   - Design you admire (can be outside your industry): ___
   - Design you explicitly want to avoid: ___

**4. Brand perception** (3 adjectives)
   How should users feel when using your product?
   Examples: fast, trustworthy, playful, sophisticated, powerful, calm, exciting, minimal, bold, approachable
   Your 3 words: ___, ___, ___

**5. Technical constraints**
   - Must support browsers/devices: ___
   - Dark mode required? Yes / No / Optional
   - Any existing brand assets to respect (logo colors, fonts): ___
   - Any framework constraints (e.g., must use Tailwind, uses shadcn/ui): ___

---

Reply with your answers, and I'll use them to propose aesthetic directions in the next step."

### 4. Process User Answers

After receiving answers:
- Store all five context answers in memory
- Note any pre-filled answers from document discovery (and mark them as "inferred from {source}" for transparency)
- If answers are sparse, note which areas require assumption — this will be flagged in the DESIGN.md decision log

### 5. Confirm and STOP

Confirm what you've recorded and present the continue prompt:

"Here's what I've captured for {project_name}:

**Product type**: {answer}
**Audience**: {answer}
**References**: {answer}
**Brand perception**: {adj1}, {adj2}, {adj3}
**Technical constraints**: {answer}

Is this accurate? Any corrections before we move to aesthetic direction?

[C] Continue to aesthetic direction proposal"

### 6. Wait for [C] Confirmation

STOP. Do NOT load step-02 until user selects [C].

After [C] is selected, load `./step-02-direction.md`.

---

## SUCCESS METRICS:

✅ Existing DESIGN.md detected and handled correctly
✅ All 5 context questions asked in a single prompt
✅ User answers stored in memory
✅ Confirmation presented before proceeding
✅ STOP checkpoint respected

## FAILURE MODES:

❌ Starting to propose design directions in this step
❌ Assuming product context from project name alone
❌ Asking questions one at a time (slow, fragmented)
❌ Proceeding to step-02 without user [C]
❌ **CRITICAL**: Reading only partial step file
