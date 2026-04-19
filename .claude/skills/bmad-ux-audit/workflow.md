# UX Audit Workflow

**Goal:** Perform a systematic, evidence-based UX audit of existing designs across 10 categories and 80+ check items, detect AI design slop, produce a structured problem ID file and a scored report appended to the UX Design Specification as Part 4.

---

## WORKFLOW ARCHITECTURE

This uses **micro-file architecture** for disciplined execution:

- Each step is a self-contained file with embedded rules
- Sequential progression with user control at each step
- Anomaly-driven output — only problems are reported, passing items are silent
- Structured problem IDs enable downstream tracking and verification

---

## INITIALIZATION

### Configuration Loading

Load config from `{project-root}/_bmad/bmm/config.yaml` and resolve:

- `project_name`, `output_folder`, `planning_artifacts`, `user_name`
- `communication_language`, `document_output_language`
- `date` as system-generated current datetime (format: YYYYMMDD)

### Paths

- `spec_file` = `{planning_artifacts}/ux-design-specification.md`
- `audit_file` = `{planning_artifacts}/ux-audit-{date}.md`
- `status_file` = `{planning_artifacts}/ux-status.md`

### Output Files

- **Primary**: Structured problem ID file at `{planning_artifacts}/ux-audit-{date}.md`
- **Secondary**: Audit report appended to `{planning_artifacts}/ux-design-specification.md` as Part 4

---

## EXECUTION

- ✅ YOU MUST ALWAYS SPEAK OUTPUT in your Agent communication style with the config `{communication_language}`
- ✅ YOU MUST ALWAYS WRITE all artifact and document content in `{document_output_language}`
- Read fully and follow: `./steps/step-01-input.md` to begin the UX audit workflow.
