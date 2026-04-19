# bmad-ux-handoff — Workflow

## Config Variables

Load from bmad-init before executing any steps:

- `planning_artifacts` = `{project-root}/_bmad-output/planning-artifacts`
- `communication_language` = `English`

## Pre-flight Check

Before starting, read `{planning_artifacts}/ux-status.md` and verify:

- HG (HTML Generator) status is marked as **completed**
- At least one `ux-{screen-name}-preview.html` path is recorded

If HG is not yet completed, warn the user:

> "HD should be run after HG. The ux-status.md file does not yet show a
> completed HTML prototype. It is strongly recommended to finish the HG
> workflow first so the Handoff can reference a confirmed visual baseline.
> Do you want to continue anyway? [Y/N]"

## Output

- Primary output file: `{planning_artifacts}/ux-handoff-{feature}.md`

## Step Sequence

| Step | File | Purpose |
|------|------|---------|
| 01 | `./steps/step-01-scope.md` | Scope confirmation & precision tier selection |
| 02 | `./steps/step-02-component-states.md` | Component state specification tables |
| 03 | `./steps/step-03-interaction-spec.md` | Interaction behaviour annotations |
| 04 | `./steps/step-04-acceptance.md` | UX acceptance criteria & final document save |

## Entry Point

Load `./steps/step-01-scope.md` to begin.
