# Step 2: Aesthetic Direction Proposal

## MANDATORY EXECUTION RULES (READ FIRST):

- CRITICAL: ALWAYS read the complete step file before taking any action
- Base ALL proposals on the product context from step-01 — no generic defaults
- EVERY decision must be decomposed into SAFE/RISK classification
- Font blacklist is absolute — never propose blacklisted fonts
- Present A/P/C menu after proposals
- YOU MUST ALWAYS SPEAK OUTPUT in your Agent communication style with the config `{communication_language}`

## EXECUTION PROTOCOLS:

- Analyze step-01 context answers to determine which aesthetic directions fit
- Propose 2-3 directions maximum (not all 10)
- For each proposal, decompose every significant decision as SAFE or RISK
- Present A/P/C menu and wait for user selection
- FORBIDDEN to write any files until step-03

## COLLABORATION MENUS (A/P/C):

- **A (Advanced Elicitation)**: Push deeper on aesthetic reasoning or explore rejected options
- **P (Party Mode)**: Bring multiple design perspectives to evaluate directions
- **C (Continue)**: Accept a chosen direction and proceed to DESIGN.md generation

## CONTEXT BOUNDARIES:

- Use product context stored in memory from step-01
- Do not re-ask context questions already answered
- Reference competitor/reference designs from step-01 when explaining SAFE/RISK

---

## YOUR TASK:

Propose 2-3 aesthetic directions tailored to the product context. Decompose each direction's decisions as SAFE (industry convention, low differentiation risk) or RISK (differentiating, higher execution risk). Help the user make an informed, intentional choice.

---

## THE 10 AESTHETIC DIRECTIONS REFERENCE LIBRARY:

Use this to select appropriate directions based on the product context from step-01.

| # | Direction | Core Principle | Best Fit | Risk if Misapplied |
|---|---|---|---|---|
| 1 | **Minimalism** | Whitespace-first, almost no decoration | Productivity tools, professional software | Can feel cold or empty for consumer products |
| 2 | **Maximalism** | Rich color, information density, expressive | Games, creative platforms, entertainment | Overwhelming for task-focused users |
| 3 | **Retro-Futurism** | 80s sci-fi aesthetic, neon on dark, scanlines | Developer tools, hacker aesthetic, gaming | Niche; alienates non-technical users |
| 4 | **Luxury** | Restrained high-contrast, precision craft | Premium/enterprise products, high-end SaaS | Feels pretentious for mass-market products |
| 5 | **Playful** | Rounded, bright, friendly, bouncy | Consumer apps, education, social products | Undermines trust for financial/security products |
| 6 | **Editorial** | Typography-led, content-first, whitespace | Media, documentation, knowledge products | Visually boring for interactive products |
| 7 | **Brutalism** | Deliberately raw, anti-convention | Art platforms, differentiation plays | High risk; polarizing by design |
| 8 | **Art Deco** | Geometric ornament, refined lines | High-end brands, luxury digital products | Feels dated if executed poorly |
| 9 | **Organic** | Flowing lines, natural material textures | Health, lifestyle, wellness products | Feels soft for productivity contexts |
| 10 | **Industrial** | Metal textures, function-forward | Manufacturing, infrastructure, B2B tools | Feels cold and transactional for consumer use |

---

## FONT BLACKLIST (ABSOLUTE — NEVER PROPOSE):

- Comic Sans
- Papyrus
- ANY handwritten/script font for body text
- More than 2 font families total (heading + body is sufficient)
- Novelty display fonts used below 32px

---

## SAFE / RISK DECOMPOSITION FRAMEWORK:

For every significant design decision in each direction, classify it as:

- **SAFE (Industry Convention)**: This choice follows established patterns for this product category. Users will find it familiar. Low differentiation value, lower execution risk.
- **RISK (Differentiating)**: This choice departs from conventions. If executed well, it creates a distinctive identity. If executed poorly, it creates confusion or distrust.

Format for each decision:
```
- [Decision]: [Value chosen]
  → [SAFE: reason] OR [RISK: reason — mitigation: ...]
```

---

## EXECUTION SEQUENCE:

### 1. Select 2-3 Directions Based on Context

From the product context in memory, select the 2-3 most appropriate directions. Do not propose all 10.

Selection logic:
- Match product type to "Best Fit" column
- Consider brand perception adjectives from step-01
- Consider competitor references (avoid mimicking, unless user explicitly wants familiarity)
- For enterprise/B2B → lean toward Minimalism, Luxury, Industrial
- For consumer/social → lean toward Playful, Organic, Maximalism
- For developer tools → Retro-Futurism, Minimalism, Industrial
- For media/docs → Editorial, Minimalism

### 2. Generate Direction Proposals

For each selected direction, produce this proposal block:

```markdown
### Direction [N]: [Name]

**Concept**: [1 sentence describing the overall feel]

**Why it fits {project_name}**: [2-3 sentences linking to the product context answers]

**Core Decisions**:

**Typography**
- Heading font: [specific font name and why]
  → [SAFE/RISK classification]
- Body font: [specific font name and why]
  → [SAFE/RISK classification]
- Size scale: [e.g., 1.25 modular scale / 1.333 perfect fourth]
  → [SAFE/RISK classification]

**Color**
- Primary: [hex + description]
  → [SAFE/RISK classification]
- Surface/background: [hex + approach]
  → [SAFE/RISK classification]
- Semantic palette: [brief description]
  → [SAFE/RISK classification]
- Dark mode approach: [if applicable]
  → [SAFE/RISK classification]

**Shape & Texture**
- Border radius philosophy: [e.g., sharp = 2px, rounded = 8px, pill = 999px]
  → [SAFE/RISK classification]
- Shadow approach: [e.g., flat/no shadow, subtle elevation, dramatic depth]
  → [SAFE/RISK classification]
- Texture/decoration: [e.g., none, subtle grain, geometric pattern]
  → [SAFE/RISK classification]

**Motion**
- Animation philosophy: [e.g., instant feedback, gentle transitions, expressive spring]
  → [SAFE/RISK classification]

**Overall SAFE/RISK Balance**: {n} SAFE decisions, {n} RISK decisions
**Verdict**: Safe choice for {use case} / Differentiating bet / High-risk experiment
```

### 3. Present Proposals and A/P/C Menu

Present all direction proposals and the menu:

"**Aesthetic Direction Proposals for {project_name}**

Based on your context (product type: {type}, brand perception: {adj1}/{adj2}/{adj3}), here are my recommendations:

{Direction 1 proposal block}

---

{Direction 2 proposal block}

---

{Direction 3 proposal block (if applicable)}

---

**Which direction resonates with you?**
Reply with the direction number (1, 2, or 3), or describe modifications.

**What would you like to do?**
[A] Advanced Elicitation — Push deeper on these directions or explore a different one
[P] Party Mode — Multiple design perspectives on these proposals
[C] Continue — Confirm a direction and generate the full DESIGN.md"

### 4. Handle Menu Selection

#### If 'A':
- Invoke `bmad-advanced-elicitation` with the current proposals
- Ask: "Accept these refined proposals? (y/n)"
- Update or keep, return to A/P/C menu

#### If 'P':
- Invoke `bmad-party-mode` with the current proposals
- Ask: "Accept these changes to the direction proposals? (y/n)"
- Update or keep, return to A/P/C menu

#### If 'C':
- Ask if not already clear: "Which direction are you choosing? Any modifications to the selected direction?"
- Store chosen direction and all its decisions in memory
- Load `./step-03-design-md.md`

---

## SUCCESS METRICS:

✅ Exactly 2-3 directions proposed (not all 10)
✅ Directions selected based on product context from step-01
✅ Every significant decision has SAFE/RISK classification
✅ No blacklisted fonts proposed
✅ A/P/C menu presented
✅ Chosen direction stored in memory before proceeding

## FAILURE MODES:

❌ Proposing all 10 directions (overwhelming)
❌ Proposing generic directions not tied to product context
❌ Missing SAFE/RISK classification for any decision
❌ Proposing a blacklisted font
❌ Auto-proceeding without user [C] and direction confirmation
❌ Writing any files in this step
❌ **CRITICAL**: Reading only partial step file
