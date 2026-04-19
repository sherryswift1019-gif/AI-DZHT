# Step 2: Trunk Test (First Impression Evaluation)

## MANDATORY EXECUTION RULES (READ FIRST):

- NEVER generate content without loading the audit input first
- CRITICAL: ALWAYS read the complete step file before taking any action — partial understanding leads to incomplete decisions
- CRITICAL: When loading next step with 'C', ensure the entire file is read and understood before proceeding
- YOU ARE AN AUDITOR simulating a first-time user — apply zero product knowledge when answering the 6 questions
- Each question must be answered based strictly on what is visible/readable in the input, not on what the product is supposed to do
- YOU MUST ALWAYS SPEAK OUTPUT in your Agent communication style with the config `{communication_language}`
- YOU MUST ALWAYS WRITE all artifact and document content in `{document_output_language}`

## EXECUTION PROTOCOLS:

- Apply the Trunk Test blindly — answer each question as a first-time visitor would
- Score each answer objectively: 0 (cannot answer), 0.5 (partially), 1 (clearly answered)
- Identify the single most impactful finding before continuing
- Present [C] to proceed after showing results
- FORBIDDEN to proceed to step-03 until Trunk Test is complete

## CONTEXT BOUNDARIES:

- Audit input from step 1 is loaded in context
- Design intent reference from step 1 (UX Spec Part 1) is available
- The Trunk Test evaluates the current state, not the intended state
- Do not use knowledge of what the product should do to answer Trunk Test questions

## YOUR TASK:

Perform the Trunk Test — 6 rapid-fire questions that evaluate whether users can orient themselves without any context. This is a heuristic assessment of navigational clarity and information architecture legibility.

## TRUNK TEST SEQUENCE:

### 1. Context Reset

Before beginning, explicitly reset perspective:
"Performing Trunk Test — simulating a first-time visitor who has arrived on this page without reading any documentation, onboarding, or marketing material..."

If there are multiple pages/screens in the input, apply the Trunk Test to the **primary or entry-point page** first, then optionally run it on secondary pages.

### 2. Apply the 6 Questions

For each question, provide:
- The answer as a first-time user would perceive it (not the designer's intent)
- A score: 0 / 0.5 / 1
- Evidence from the input that drove the score

---

**Q1: What is this website or product?**

What does the page communicate about what this product is and who it is for?

Scoring:
- 1: Product name, tagline, and value proposition are immediately clear from above-the-fold content
- 0.5: Product name is present but purpose requires reading further
- 0: Cannot determine what the product does from the primary view

---

**Q2: What page or section am I currently on?**

Is the current page location clearly indicated?

Scoring:
- 1: Page title and breadcrumb or active navigation state clearly confirms location
- 0.5: Page title exists but no visual breadcrumb or active state in nav
- 0: No clear page title or location indicator

---

**Q3: What are the main functional areas of this page?**

Can a user identify the primary content zones without scrolling or reading all text?

Scoring:
- 1: Visual hierarchy, layout, and headings make 3+ functional areas immediately scannable
- 0.5: Areas exist but visual separation is weak or requires reading
- 0: Page appears as undifferentiated content block

---

**Q4: What can I do on this page?**

Are the primary actions available to the user clear and findable?

Scoring:
- 1: Primary CTA(s) are visually prominent and clearly labeled with action verbs
- 0.5: Actions exist but are not visually differentiated or use vague labels
- 0: No clear primary action visible, or actions are buried

---

**Q5: How do I navigate to other major areas?**

Is global navigation clearly visible and understandable?

Scoring:
- 1: Navigation is consistently placed, labeled in plain language, and shows current location
- 0.5: Navigation exists but labels are ambiguous or current location not indicated
- 0: No visible global navigation, or navigation is hidden behind a hamburger with no context

---

**Q6: Is there a search function, and is it findable?**

If the product has searchable content, is search easily discoverable?

Scoring:
- 1: Search input is visibly placed in a standard location (header or hero area) with a placeholder
- 0.5: Search exists but is iconized or placed non-standardly without text label
- 0: No search present (note: acceptable for products without search requirements)

---

### 3. Compile Results

Present the score table:

```
## Trunk Test Results — {{project_name}}

| # | Question | Score | Key Finding |
|---|----------|-------|-------------|
| Q1 | What is this? | 0 / 0.5 / 1 | [finding] |
| Q2 | Where am I? | 0 / 0.5 / 1 | [finding] |
| Q3 | What are the main areas? | 0 / 0.5 / 1 | [finding] |
| Q4 | What can I do here? | 0 / 0.5 / 1 | [finding] |
| Q5 | How do I navigate? | 0 / 0.5 / 1 | [finding] |
| Q6 | Is there search? | 0 / 0.5 / 1 | [finding] |

**Total: [score] / 6**

**Primary Finding:** [Single most critical issue identified — the thing that would most confuse a first-time user]
```

### 4. Score Interpretation

Provide context for the score:

- 5.5–6: Excellent first impression — proceed to deep audit with high confidence
- 4–5: Adequate orientation — users can find their way, but with friction
- 2.5–3.5: Significant orientation problems — users may struggle to understand the product
- 0–2: Critical orientation failure — users likely to abandon before engaging

### 5. Confirm and Proceed

"**Trunk Test complete.** Score: [n]/6

The most critical first-impression issue is: [primary finding]

This will be registered as a finding in the full audit (step 3).

[C] Continue — begin the 10-category systematic audit"

## SUCCESS METRICS:

- All 6 questions answered from a zero-knowledge first-time user perspective
- Each answer includes a score and specific evidence from the audit input
- Primary finding clearly identified
- Score interpretation provided
- User confirmed before proceeding to step 3

## FAILURE MODES:

- Using product knowledge to answer Trunk Test questions charitably
- Skipping a question because "the product doesn't need it"
- Failing to identify a primary finding
- Proceeding to step 3 without showing the score table
- Scoring 1 for Q6 when no search exists without noting the N/A status

## NEXT STEP:

After user selects [C], load `./step-03-audit.md` to begin the 10-category systematic audit.

Remember: Do NOT proceed to step-03 until the Trunk Test score table is shown and user selects [C]!
