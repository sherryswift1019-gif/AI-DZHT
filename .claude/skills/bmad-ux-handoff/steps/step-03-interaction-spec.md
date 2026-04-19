# Step 3: Interaction Behaviour Annotations

## MANDATORY EXECUTION RULES (READ FIRST):

- NEVER leave timing values as "TBD" — provide a concrete value or range derived from the spec or platform norms
- CRITICAL: ALWAYS read the complete step file before taking any action
- CRITICAL: When loading next step with 'C', ensure the entire file is read and understood before proceeding
- YOU ARE specifying behaviour precisely enough that a developer can implement it without design clarification
- FOCUS on measurable, testable interaction parameters — not vague descriptions
- AI-specific interaction patterns (streaming, HITL) are activated in this step
- YOU MUST ALWAYS SPEAK OUTPUT in your Agent communication style with the config `{communication_language}`

## EXECUTION PROTOCOLS:

- Identify all interaction nodes from the UX spec before writing any annotations
- For AI features: always include streaming output behaviour and Human-in-the-loop handling
- Present A/P/C menu after generating the interaction section
- FORBIDDEN to load step-04 until user selects [C]

## COLLABORATION MENUS (A/P/C):

- **A (Advanced Elicitation)**: Invoke `bmad-advanced-elicitation` to probe edge cases and timing assumptions
- **P (Party Mode)**: Invoke `bmad-party-mode` to get developer + QA perspectives on interaction specs
- **C (Continue)**: Append the interaction section to the Handoff document and proceed

## PROTOCOL INTEGRATION:

- When 'A' or 'P' selected: run skill, return to this step's A/P/C menu with updated content
- User accepts/rejects changes before finalising

## CONTEXT BOUNDARIES:

- Component list from step-02 defines which interactions to annotate
- Precision tier from step-01 informs level of edge case coverage
- AI features presence is detected from the UX spec (look for: chat, stream, agent, approval, review)

## INTERACTION TIMING REFERENCE:

| Response Window | Classification | Required UI Feedback |
|---|---|---|
| < 100ms | Instant | State change only (no loader) |
| 100–300ms | Fast | Micro-animation or state change |
| 300ms–1s | Noticeable | Loading indicator (spinner or skeleton) |
| 1s–3s | Slow | Loading indicator + progress hint |
| > 3s | Very slow | Progress bar + estimated time or cancel option |

## YOUR TASK:

Generate a precise interaction behaviour annotation for every key interaction node in the feature scope.

## INTERACTION SPEC SEQUENCE:

### 1. Identify Interaction Nodes

From the component list and UX spec, enumerate all user-initiated interaction events:
- Form submissions and validation
- Navigation transitions
- Data loading and refresh
- Inline editing
- Drag and drop / reorder
- Modal open/close
- Notification / toast triggers
- AI-specific: send message, streaming response, approve/reject HITL

Group them by interaction category for clarity.

### 2. Detect AI Features

Scan the UX spec for AI-related interaction patterns:
- Keywords: "stream", "streaming", "AI response", "agent", "thinking", "Human-in-the-loop", "HITL", "approve", "review and confirm", "interrupt"

IF AI features are detected: activate the AI Interaction Patterns section (see below).

### 3. Generate Standard Interaction Annotations

For each interaction node, write a section using this format:

```markdown
### {Action Name}
**Component:** `{component-name}`
**Trigger:** {Click / Keyboard (Enter/Space/Escape) / Swipe / Drag / Hover}

- **Response time:** {< 100ms instant / 100–300ms fast / > 300ms — show loading}
- **Animation spec:** `duration: {N}ms, easing: {ease-out|ease-in-out|spring}, property: {transform|opacity|background}`
- **Success feedback:** {Toast "{copy}" / Inline confirmation / State change to {state-name}}
- **Failure feedback:** {Location: inline below field / Toast / Modal — Copy: "{error message text}"}
- **Edge cases:**
  - Input too long: {truncate at Nchars / show character count / block submission}
  - Network timeout: {show error after Nms — retry button appears}
  - Concurrent action: {debounce Nms / disable trigger until previous completes}
  - Offline: {queue action / show offline indicator / restore on reconnect}
```

### 4. Generate AI Interaction Patterns (if AI features detected)

Add an "AI Interaction Patterns" subsection:

```markdown
### AI: Streaming Output
**Component:** `{stream-output-area}`
**Trigger:** User sends a message or triggers an agent action

- **Response time:** Instant acknowledgement (< 100ms) — show "thinking" indicator
- **Thinking indicator:** Animated ellipsis or pulse on the agent avatar, duration: indefinite until first token
- **Stream onset:** First token appears — replace thinking indicator with streaming text
- **Stream rendering:** Characters appended at rate of incoming tokens; smooth auto-scroll if user is at bottom
- **Auto-scroll rule:** Only auto-scroll if scroll position is within 80px of bottom; respect user scroll-up gesture
- **Stream complete:** Fade out cursor/caret indicator (200ms ease-out); enable action buttons
- **Interrupt / stop:** Stop button visible during streaming; click cancels the request, partial output remains visible
- **Error during stream:** Show inline error banner below partial output — "Response interrupted. {Retry} | {Dismiss}"
- **Edge cases:**
  - Empty response: show "No response returned. Try rephrasing." — not blank
  - Very long response: virtual scrolling or "Show more" at N lines
  - Code blocks in stream: syntax-highlight incrementally as tokens arrive

### AI: Human-in-the-Loop (HITL) Approval
**Component:** `{hitl-approval-widget}`
**Trigger:** Agent pauses and requests explicit user decision

- **Response time:** Instant render of approval widget when agent pauses
- **Widget appearance:** Distinct visual treatment (e.g. bordered card with amber/warning accent) to signal required action
- **Required elements:** Summary of what the agent is about to do + "Approve" (primary) + "Reject" (secondary) + optional "Edit before approving" (tertiary)
- **Focus management:** Automatically focus the "Approve" button on widget render for keyboard accessibility
- **Keyboard:** Enter = Approve, Escape = Reject, Tab cycles through all three options
- **Timeout:** IF a timeout is specified: show countdown indicator; on expiry auto-reject and notify user
- **After Approve:** Widget collapses (300ms ease-in-out), agent continues streaming
- **After Reject:** Widget collapses, agent stops, show "Action cancelled" inline
- **Edge cases:**
  - Multiple HITL widgets queued: display in sequence; do not stack
  - Network error during approval POST: retain widget, show retry option
  - Page refresh during pending HITL: restore widget state from server or show "Session expired, action cancelled"
```

### 5. Keyboard and Focus Flow

List the complete Tab key traversal order for the feature:

```markdown
### Keyboard Navigation Order
1. {Element name} — role: {button|link|input|...}
2. {Element name}
...

**Focus ring spec:** `outline: 2px solid var(--color-primary); outline-offset: 2px;`
**Skip link:** Present — "Skip to main content" (visible on focus)
**Escape key:** Closes modal / drawer / dropdown — focus returns to trigger element
```

### 6. Present Content and A/P/C Menu

> "I've annotated **{N} interaction nodes** for **{feature-name}**, including {AI streaming / HITL / standard interactions}.
>
> [Show the complete interaction section]
>
> **What would you like to do?**
> [A] Advanced Elicitation — probe edge cases and timing assumptions
> [P] Party Mode — developer + QA perspectives on interaction completeness
> [C] Continue — save to Handoff document and generate acceptance criteria"

### 7. On [C]: Append to Document

Append the complete interaction section under `## 3. Interaction Behaviour Annotations` in `{planning_artifacts}/ux-handoff-{feature}.md`.

Update frontmatter: add `3` to `stepsCompleted` array.

## SUCCESS METRICS:

- Every interaction node from the component list has an annotation
- All timing values are concrete numbers (no "TBD")
- Animation specs include duration + easing + property
- AI streaming and HITL annotations present when AI features detected
- Keyboard navigation order documented
- Edge cases include: input length, network timeout, concurrent action, offline
- A/P/C menu presented before saving

## FAILURE MODES:

- Timing specified as "fast" or "slow" without millisecond values
- Missing AI interaction patterns when AI components are in scope
- Missing keyboard navigation order
- Not specifying focus return after modal/drawer close
- "TBD" or "to be determined" anywhere in the interaction spec
- Appending to document before user selects [C]

## NEXT STEP:

After user selects [C] and content is saved, load `./step-04-acceptance.md` to generate UX acceptance criteria and finalise the Handoff document.

Remember: Do NOT proceed to step-04 until user explicitly selects [C]!
