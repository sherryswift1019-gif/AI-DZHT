# Step 1: Input Detection & Mode Routing

## MANDATORY EXECUTION RULES (READ FIRST):

- NEVER generate HTML content without completing this detection step first
- CRITICAL: ALWAYS read the complete step file before taking any action
- CRITICAL: When loading next step with 'C', ensure the entire file is read and understood before proceeding
- YOU ARE A UX ENGINEER performing pre-flight checks, not a content generator
- FOCUS on detecting inputs and routing to the correct generation mode — do not skip ahead
- YOU MUST ALWAYS SPEAK OUTPUT in your Agent communication style with the config `{communication_language}`

## EXECUTION PROTOCOLS:

- Show your detection results before asking any questions
- Vendor file check MUST happen before input source detection
- Confirm mode routing summary with user before proceeding to step-02
- FORBIDDEN to load step-02 until user confirms the mode summary

## CONTEXT BOUNDARIES:

- Variables from workflow.md are available in memory: `planning_artifacts`, `communication_language`
- Only this step deals with file system discovery — later steps use what is found here
- Framework detection informs token extraction in step-02

## YOUR TASK:

Detect the Pretext vendor file, identify the input source, detect the frontend framework, and ask which screen to generate. Produce a confirmed mode summary before handing off.

## DETECTION SEQUENCE:

### 1. Pretext Vendor Check

Check for the local vendor file at:

```
.claude/skills/bmad-ux-html-gen/vendor/pretext.js
```

**If file EXISTS:**
- Mode: `LOCAL_VENDOR`
- Note the absolute path for use in step-04

**If file DOES NOT EXIST:**
- Mode: `CDN_FALLBACK` — will use `https://esm.sh/@chenglou/pretext@0.0.5`
- Show user the copy instructions:

> "The local Pretext vendor file was not found. For offline/air-gapped use, copy it manually:
>
> **Source (GStack path):**
> `node_modules/@chenglou/pretext/dist/pretext.js`  (run `npm install @chenglou/pretext@0.0.5` first)
>
> **Destination:**
> `.claude/skills/bmad-ux-html-gen/vendor/pretext.js`
>
> For now I will use the CDN fallback (`https://esm.sh/@chenglou/pretext@0.0.5`).
> Shall we continue? [Y to continue / C to abort]"

Only continue after user confirms.

### 2. Input Source Detection (Priority Order)

Check the following in order and stop at the first match:

1. `{planning_artifacts}/ux-design-specification.md` — **Spec-Driven Mode**
2. `DESIGN.md` in project root — **Design-System-Driven Mode**
3. Neither found — **Conversation-Driven Mode**

For each mode, note:
- Which file was found (full path)
- Whether it is sharded (folder with index.md) or a single file

### 3. Frontend Framework Detection

Read `package.json` from the project root. Extract:
- Framework name and major version (React, Vue, Svelte, vanilla, etc.)
- CSS solution (Tailwind, CSS Modules, plain CSS, etc.)
- Build tool (Vite, Webpack, CRA, etc.)

If `package.json` is not found, note "framework: unknown".

### 4. Screen Selection

Ask the user which screen/interface to generate:

> "Which screen would you like to generate an HTML preview for?
>
> Common options:
> - **Dashboard** — main overview / data-heavy layout
> - **Feature page** — specify the feature name
> - **New page** — describe it in a sentence
>
> Enter a screen name or short description:"

Wait for user response. Normalise the input to a slug for the output filename, e.g. `agent-chat` → `ux-agent-chat-preview.html`.

### 5. Output Mode Confirmation Summary

After collecting all information, present a clear summary:

```
Input Detection Complete
------------------------
Vendor:        LOCAL_VENDOR  |  CDN_FALLBACK
               {path or CDN url}

Input source:  SPEC_DRIVEN   |  DESIGN_DRIVEN  |  CONVERSATION_DRIVEN
               {file path or "conversation"}

Framework:     {framework name} {version}  /  {css solution}
Screen:        {screen name slug}
Output file:   {planning_artifacts}/ux-{screen-name-slug}-preview.html

[C] Confirm and continue to token extraction
```

Wait for user to select [C].

## SUCCESS METRICS:

- Vendor resolution status is unambiguous (local or CDN)
- Input source mode is clearly identified and justified
- Frontend framework detected from package.json
- Screen name slug is confirmed
- Output file path is stated before proceeding

## FAILURE MODES:

- Skipping vendor check and silently falling back to CDN without telling user
- Proceeding with generation before screen name is confirmed
- Not reporting which input file will be used
- Assuming framework without reading package.json

## NEXT STEP:

After user selects [C] from the mode summary, load `./step-02-tokens.md` to begin design token extraction.

Remember: Do NOT proceed to step-02 until the mode summary is confirmed!
