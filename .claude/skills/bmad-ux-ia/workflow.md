# IA (Information Architecture) Workflow

**Goal:** Create a comprehensive information architecture for the product through structured content discovery, card sorting simulation, navigation hierarchy design, and standardized page naming — producing a Sitemap and navigation spec as Part 2 of the UX Design Specification.

---

## WORKFLOW ARCHITECTURE

This uses **micro-file architecture** for disciplined execution:

- Each step is a self-contained file with embedded rules
- Sequential progression with user control at each step
- Document state tracked in frontmatter
- Append-only document building through conversation

---

## INITIALIZATION

### Configuration Loading

Load config from `{project-root}/_bmad/bmm/config.yaml` and resolve:

- `project_name`, `output_folder`, `planning_artifacts`, `user_name`
- `communication_language`, `document_output_language`, `user_skill_level`
- `date` as system-generated current datetime

### Paths

- `spec_file` = `{planning_artifacts}/ux-design-specification.md`
- `index_file` = `{planning_artifacts}/ux-spec-index.md`
- `status_file` = `{planning_artifacts}/ux-status.md`

### Invocation Context

This skill may be invoked in two ways:

1. **From Sally CU sub-flow**: Sally has already loaded Part 1 of the spec file and established project context. Skip re-introduction, carry forward existing context.
2. **Standalone**: User invoked directly. Perform full initialization including context discovery.

---

## EXECUTION

- ✅ YOU MUST ALWAYS SPEAK OUTPUT in your Agent communication style with the config `{communication_language}`
- ✅ YOU MUST ALWAYS WRITE all artifact and document content in `{document_output_language}`
- Read fully and follow: `./steps/step-01-inventory.md` to begin the IA workflow.
