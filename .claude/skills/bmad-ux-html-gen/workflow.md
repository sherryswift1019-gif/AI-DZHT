# bmad-ux-html-gen — Workflow

## Config Variables

Load from bmad-init before executing any steps:

- `planning_artifacts` = `{project-root}/_bmad-output/planning-artifacts`
- `communication_language` = `English`

## Pretext Dependency

- Package: `@chenglou/pretext@0.0.5`
- Local vendor (preferred): `.claude/skills/bmad-ux-html-gen/vendor/pretext.js`
- CDN fallback: `https://esm.sh/@chenglou/pretext@0.0.5`

## Output

- Primary output file: `{planning_artifacts}/ux-{screen-name}-preview.html`
- Self-contained single HTML file — no external assets required at runtime.

## Step Sequence

| Step | File | Purpose |
|------|------|---------|
| 01 | `./steps/step-01-detect.md` | Input detection & mode routing |
| 02 | `./steps/step-02-tokens.md` | Design token extraction |
| 03 | `./steps/step-03-pretext-route.md` | Pretext API mode selection |
| 04 | `./steps/step-04-generate.md` | Generate self-contained HTML |
| 05 | `./steps/step-05-refine.md` | Refinement loop (max 10 rounds) |

## Entry Point

Load `./steps/step-01-detect.md` to begin.
