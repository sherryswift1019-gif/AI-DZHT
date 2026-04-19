# UX Design System Workflow

**Goal:** Establish a complete, intentional design language for the product through collaborative discovery, then generate a production-ready `DESIGN.md` that serves as the single source of truth for all visual and interaction decisions.

---

## WORKFLOW ARCHITECTURE

This uses **micro-file architecture** for disciplined execution:

- Each step is a self-contained file with embedded rules
- Sequential progression with STOP checkpoints for user control
- Output is a single authoritative `DESIGN.md` file
- Optional design preview HTML generated at end

---

## INITIALIZATION

### Configuration Loading

Load config from `{project-root}/_bmad/bmm/config.yaml` and resolve:

- `project_name`, `planning_artifacts`, `user_name`
- `communication_language`, `document_output_language`
- `date` as system-generated current datetime

### Paths

- `planning_artifacts` = `{project-root}/_bmad-output/planning-artifacts`
- `design_output_file` = `{project-root}/DESIGN.md`
- `ux_status_file` = `{planning_artifacts}/ux-status.md`

---

## OUTPUT

This skill produces two artifacts:

1. **`{project-root}/DESIGN.md`** (required) — Complete design system document including aesthetic direction, typography, color, spacing, animation, and decision log
2. **Design Preview HTML** (optional) — A rendered visual preview of the design system, generated via `bmad-ux-html-gen` if user chooses

---

## EXECUTION

- ✅ YOU MUST ALWAYS SPEAK OUTPUT in your Agent communication style with the config `{communication_language}`
- ✅ YOU MUST ALWAYS WRITE all artifact and document content in `{document_output_language}`
- Read fully and follow: `./steps/step-01-context.md` to begin the design system workflow.
