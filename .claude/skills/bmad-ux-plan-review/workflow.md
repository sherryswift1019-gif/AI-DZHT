# UX Plan Review Workflow (7-Pass)

**Goal:** Perform a structured 7-Pass UX feasibility review after PRD and/or architecture documents are complete, surfacing design gaps, ambiguities, and blockers before sprint planning begins.

---

## WORKFLOW ARCHITECTURE

This uses **micro-file architecture** for disciplined execution:

- Each step is a self-contained file with embedded rules
- Sequential Pass execution with STOP checkpoints for user control
- Results aggregated into a final review report
- Append-only output into the existing PRD and UX specification

---

## INITIALIZATION

### Configuration Loading

Load config from `{project-root}/_bmad/bmm/config.yaml` and resolve:

- `project_name`, `planning_artifacts`, `user_name`
- `communication_language`, `document_output_language`
- `date` as system-generated current datetime

### Paths

- `planning_artifacts` = `{project-root}/_bmad-output/planning-artifacts`
- `ux_spec_file` = `{planning_artifacts}/ux-design-specification.md`
- `ux_status_file` = `{planning_artifacts}/ux-status.md`

---

## TRIGGER SCENARIOS

This skill is appropriate when:

1. **PRD is complete** — Product requirements are finalized and ready for UX validation
2. **Architecture document is complete** — Technical constraints are known and need UX alignment check
3. **Before Sprint Planning** — Last gate to confirm UX is implementation-ready

---

## OUTPUT DESTINATIONS

Review results are written to two locations:

1. **PRD document** — Appended as a new `## UX Design Review` section at the end of the PRD file
2. **UX Specification** — Appended to Part 5 (Review Findings) of `{planning_artifacts}/ux-design-specification.md`; unresolved decisions appended to Part 6

---

## EXECUTION

- ✅ YOU MUST ALWAYS SPEAK OUTPUT in your Agent communication style with the config `{communication_language}`
- ✅ YOU MUST ALWAYS WRITE all artifact and document content in `{document_output_language}`
- Read fully and follow: `./steps/step-00-scope.md` to begin the review workflow.
