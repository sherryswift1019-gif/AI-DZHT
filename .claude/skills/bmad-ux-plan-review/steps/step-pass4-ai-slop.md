# Step Pass 4: AI Slop Risk

## MANDATORY EXECUTION RULES (READ FIRST):

- CRITICAL: ALWAYS read the complete step file before taking any action
- Source is the Review Working Summary from step-00, NOT the original documents
- YOU ARE A UX REVIEWER — identify AI slop signals, do not redesign
- The 10 blacklist items are NON-NEGOTIABLE: any presence is a finding
- Present findings, then STOP for user confirmation before Pass 5
- YOU MUST ALWAYS SPEAK OUTPUT in your Agent communication style with the config `{communication_language}`

## EXECUTION PROTOCOLS:

- Scan the Review Working Summary for any language or descriptions matching the 10 blacklist items
- Also evaluate overall "design intentionality" signals
- Generate Pass 4 findings using the standard output template
- Present A/P/C menu and STOP

## COLLABORATION MENUS (A/P/C):

- **A (Advanced Elicitation)**: Deeper critique of AI slop patterns detected
- **P (Party Mode)**: Multiple perspectives on design intentionality
- **C (Continue)**: Accept findings and proceed to Pass 5

## CONTEXT BOUNDARIES:

- Use ONLY the Review Working Summary from step-00
- Check Section C (Design Tokens) and Section E (UX Decisions) for slop signals
- Also check any visual descriptions in the summary
- A clean summary does not mean the design is slop-free; absence of detail is itself a finding

---

## YOUR TASK:

Evaluate whether the design proposals show any of the 10 AI Slop blacklist patterns, and whether the overall design has intentionality (deliberate choices vs. defaults).

---

## THE 10 AI SLOP BLACKLIST:

Check every item. Any match is at minimum a 🟠 Medium finding; multiple matches or prominent use escalates to 🔴 High.

| # | Pattern | Description | Risk level |
|---|---|---|---|
| 1 | **Purple/indigo gradient** | Purple-to-indigo, blue-to-purple, or any diagonal gradient as primary visual element | 🔴 if primary, 🟠 if decorative |
| 2 | **3-column card grid** | Default 3-column grid of equal-size cards as primary content layout | 🟠 |
| 3 | **Colorful icon circles** | Features/benefits displayed as colorful circular icon badges on white cards | 🟠 |
| 4 | **Center everything** | All content centered with no left-aligned reading hierarchy | 🟠 |
| 5 | **Uniform bubble borders** | Every element uses the same rounded-rectangle card border style | 🟠 |
| 6 | **Decorative blobs/spots** | Abstract colored blob shapes used as decorative background elements | 🟠 |
| 7 | **Emoji as design** | Emoji used as substitute for intentional iconography or visual hierarchy | 🟠 |
| 8 | **Colorful border cards** | Cards with colored left-border or colored-border as the only visual differentiator | 🟡 |
| 9 | **Generic hero copy** | Hero section text with "Unlock the power of X" / "Transform your Y" style copy | 🟠 |
| 10 | **Cookie-cutter rhythm** | Every page section alternates image-left / text-right in identical rhythm without variation | 🟠 |

### Design Intentionality Assessment

Beyond the blacklist, evaluate:
- Are visual choices traceable to product goals in the summary?
- Are there any described decisions that appear to be defaults ("we'll use cards for everything")?
- Is there evidence that the layout choices were chosen for user needs vs. aesthetic convenience?
- Are typographic choices deliberate or placeholder?

Intentionality score signals:
- **High intentionality**: Design choices linked to brand, audience, or functional need
- **Medium intentionality**: Choices present but rationale absent
- **Low intentionality**: No choices made yet, or choices match generic templates verbatim

---

## OUTPUT TEMPLATE:

```markdown
## Pass 4 — AI Slop Risk

**Score**: X / 10
**10-point standard**: Zero blacklist items present, all visual choices are traceable to intentional product/brand decisions
**Current state**: [1-2 sentences on design intentionality level found in the summary]

**Blacklist Scan Results**:
| # | Pattern | Status | Evidence |
|---|---|---|---|
| 1 | Purple/indigo gradient | ✅ Clear / ⚠️ Risk / 🔴 Present | [quote from summary or 'not mentioned'] |
| 2 | 3-column card grid | ✅ / ⚠️ / 🔴 | |
| 3 | Colorful icon circles | ✅ / ⚠️ / 🔴 | |
| 4 | Center everything | ✅ / ⚠️ / 🔴 | |
| 5 | Uniform bubble borders | ✅ / ⚠️ / 🔴 | |
| 6 | Decorative blobs/spots | ✅ / ⚠️ / 🔴 | |
| 7 | Emoji as design | ✅ / ⚠️ / 🔴 | |
| 8 | Colorful border cards | ✅ / ⚠️ / 🔴 | |
| 9 | Generic hero copy | ✅ / ⚠️ / 🔴 | |
| 10 | Cookie-cutter rhythm | ✅ / ⚠️ / 🔴 | |

**Design Intentionality**: High / Medium / Low
[1-2 sentences explaining the intentionality assessment]

**Issues Found**:
- 🔴 [PR-4-H1] [Pattern name] detected: [specific evidence] → Recommendation: [action]
- 🟠 [PR-4-M1] [Pattern name] risk: [description] → Recommendation: [action]
- 🟡 [PR-4-L1] Low intentionality in [area]: [description] → Recommendation: [action]

**Open Decisions** (if any):
| Decision Point | Impact | Recommendation |
|---|---|---|
```

---

## EXECUTION SEQUENCE:

### 1. Scan Summary for Blacklist Signals

Go through all 10 blacklist items systematically. Mark ✅ Clear when there is no evidence; ⚠️ Risk when the design is unspecified (may default to this); 🔴 Present when explicitly described.

### 2. Assess Design Intentionality

Based on the quality of Section C and E in the summary, determine intentionality level.

### 3. Generate Pass 4 Findings

Produce the Pass 4 findings block. The Blacklist Scan Results table is required.

### 4. Present Findings and A/P/C Menu

"**Pass 4 — AI Slop Risk** is complete.

{Pass 4 findings block}

**What would you like to do?**
[A] Advanced Elicitation — Deeper critique of AI slop patterns
[P] Party Mode — Multiple perspectives on design intentionality
[C] Continue — Accept findings and move to Pass 5 (Design System Alignment)"

### 5. Handle Menu Selection

#### If 'A':
- Invoke `bmad-advanced-elicitation` with Pass 4 findings
- Accept/reject loop, return to A/P/C menu

#### If 'P':
- Invoke `bmad-party-mode` with Pass 4 findings
- Accept/reject loop, return to A/P/C menu

#### If 'C':
- Store Pass 4 findings in memory
- Load `./step-pass5-design-sys.md`

---

## SUCCESS METRICS:

✅ All 10 blacklist items checked and marked
✅ Blacklist Scan Results table generated (not optional)
✅ Design intentionality assessed with clear basis
✅ ⚠️ Risk used correctly for unspecified areas (not just explicit slop)
✅ A/P/C menu presented and handled correctly
✅ Findings stored in memory, NOT written to file yet

## FAILURE MODES:

❌ Skipping any of the 10 blacklist items
❌ Only flagging explicit slop, not flagging unspecified areas as risk
❌ Omitting the Blacklist Scan Results table
❌ Auto-proceeding without user [C]
❌ **CRITICAL**: Reading only partial step file
