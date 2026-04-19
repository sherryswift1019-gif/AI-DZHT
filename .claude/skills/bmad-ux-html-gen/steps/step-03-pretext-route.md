# Step 3: Pretext API Mode Routing

## MANDATORY EXECUTION RULES (READ FIRST):

- NEVER assign a Pretext mode without justifying it against the screen type
- CRITICAL: ALWAYS read the complete step file before taking any action
- CRITICAL: When loading next step with 'C', ensure the entire file is read and understood before proceeding
- YOU ARE choosing the rendering strategy — this decision affects the entire generated HTML structure
- FOCUS only on mode selection; do not begin writing HTML yet
- YOU MUST ALWAYS SPEAK OUTPUT in your Agent communication style with the config `{communication_language}`

## EXECUTION PROTOCOLS:

- Show the routing decision table and explain which mode was selected and why
- Confirm the API calls that will be used in step-04
- FORBIDDEN to load step-04 until user confirms the routing choice

## CONTEXT BOUNDARIES:

- Screen name and type from step-01 are in memory
- Token set from step-02 is available
- Routing decision here determines the HTML scaffold structure in step-04

## YOUR TASK:

Select the correct Pretext API mode for the target screen type and explain the choice to the user before proceeding.

## PRETEXT API MODE REFERENCE:

### Mode A — `prepare()` + `layout()`

**Use for:**
- Dashboard / overview pages (data cards, metric tiles, sidebar nav)
- Landing / marketing pages (hero, feature sections, CTA)
- Card / grid layouts (image grids, product listings, kanban boards)
- Settings pages (form rows, toggle lists)

**Characteristics:**
- Single-pass layout computation
- Optimal for mostly static structural content
- `prepare(containerEl, content)` → `layout()` on each resize

### Mode B — `prepareWithSegments()` + `walkLineRanges()`

**Use for:**
- Chat / conversation interfaces (message bubbles, Commander dialogue area)
- Streaming output displays (AI response areas)
- Thread / timeline views

**Characteristics:**
- Segment-aware: content is divided into labelled regions
- `prepareWithSegments(containerEl, segments)` maps each segment to a line range
- `walkLineRanges(callback)` iterates line-by-line for fine-grained rendering
- Required when different content zones need independent line-flow control

### Mode C — `prepareWithSegments()` + `layoutNextLine()`

**Use for:**
- Content-dense document viewers (long-form articles, dense specification renderers)
- Progressive / paginated text flows
- Typewriter / streaming paragraph effects

**Characteristics:**
- Same segment prep as Mode B
- `layoutNextLine()` called in a loop to lay out one line at a time
- Enables scroll-locked or paginated rendering

## ROUTING DECISION TABLE:

| Screen Type | Recommended Mode | Primary API Calls |
|---|---|---|
| Dashboard / overview | A | `prepare()` + `layout()` |
| Landing / marketing | A | `prepare()` + `layout()` |
| Card / grid / kanban | A | `prepare()` + `layout()` |
| Settings / forms | A | `prepare()` + `layout()` |
| Chat / dialogue / AI stream | B | `prepareWithSegments()` + `walkLineRanges()` |
| Thread / timeline | B | `prepareWithSegments()` + `walkLineRanges()` |
| Document viewer / article | C | `prepareWithSegments()` + `layoutNextLine()` |
| Paginated / typewriter | C | `prepareWithSegments()` + `layoutNextLine()` |

## ROUTING SEQUENCE:

### 1. Classify the Screen

Using the screen name from step-01, determine which row in the table best matches. If the screen type is ambiguous, ask one clarifying question:

> "The screen '{screen-name}' could fit more than one mode. Does it primarily involve:
> (a) A structured layout of panels/cards
> (b) A flowing conversation or chat area
> (c) Dense long-form text with pagination
>
> Enter a, b, or c:"

### 2. Announce Routing Decision

Present the decision clearly:

```
Pretext Mode Routing
--------------------
Screen:          {screen-name}
Classified as:   {screen type description}
Selected mode:   {A / B / C}

API calls to be used in step-04:
  {list the two specific function calls, e.g. prepare() + layout()}

Reason:
  {1-2 sentences explaining why this mode matches the screen type}

[C] Confirm and continue to HTML generation
```

### 3. Handle Override

If the user disagrees with the routing, accept their choice and note it:

> "Noted — I will use Mode {user-choice} instead. This is recorded as an override."

Then proceed with the user-chosen mode.

## SUCCESS METRICS:

- Screen type clearly classified against the routing table
- Mode selection justified with 1-2 sentence rationale
- Exact API function calls named (not just "Mode A/B/C")
- User confirmed before proceeding to step-04

## FAILURE MODES:

- Defaulting to Mode A for every screen without evaluating screen type
- Proceeding to step-04 without announcing the routing decision
- Using vague justification ("it seems like a good fit")
- Not offering clarification for ambiguous screen types

## NEXT STEP:

After user selects [C], load `./step-04-generate.md` to generate the self-contained HTML file.

Remember: Do NOT proceed to step-04 until the routing decision is confirmed!
