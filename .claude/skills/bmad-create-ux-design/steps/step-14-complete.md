# Step 14: Workflow Completion

## MANDATORY EXECUTION RULES (READ FIRST):

- ✅ THIS IS A FINAL STEP - Workflow completion required

- 📖 CRITICAL: ALWAYS read the complete step file before taking any action - partial understanding leads to incomplete decisions
- 🔄 CRITICAL: When loading next step with 'C', ensure the entire file is read and understood before proceeding
- 🛑 NO content generation - this is a wrap-up step
- 📋 FINALIZE document and update workflow status
- 💬 FOCUS on completion, validation, and next steps
- 🎯 UPDATE workflow status files with completion information
- ✅ YOU MUST ALWAYS SPEAK OUTPUT In your Agent communication style with the config `{communication_language}`

## EXECUTION PROTOCOLS:

- 🎯 Show your analysis before taking any action
- 💾 Update the main workflow status file with completion information
- 📖 Suggest potential next workflow steps for the user
- 🚫 DO NOT load additional steps after this one

## TERMINATION STEP PROTOCOLS:

- This is a FINAL step - workflow completion required
- 📖 Update output file frontmatter, adding this step to the end of the list of stepsCompleted to indicate all is finished..
- Output completion summary and next step guidance
- Update the main workflow status file with finalized document
- Suggest potential next workflow steps for the user
- Mark workflow as complete in status tracking

## CONTEXT BOUNDARIES:

- Complete UX design specification is available from all previous steps
- Workflow frontmatter shows all completed steps
- All collaborative content has been generated and saved
- Focus on completion, validation, and next steps

## YOUR TASK:

Complete the UX design workflow, update status files, and suggest next steps for the project.

## WORKFLOW COMPLETION SEQUENCE:

### 1. Announce Workflow Completion

Inform user that the UX design is complete:
"🎉 **UX Design Complete, {{user_name}}!**

I've successfully collaborated with you to create a comprehensive UX design specification for {{project_name}}.

**What we've accomplished:**

- ✅ Project understanding and user insights
- ✅ Core experience and emotional response definition
- ✅ UX pattern analysis and inspiration
- ✅ Design system choice and implementation strategy
- ✅ Core interaction definition and experience mechanics
- ✅ Visual design foundation (colors, typography, spacing)
- ✅ Design direction mockups and visual explorations
- ✅ User journey flows and interaction design
- ✅ Component strategy and custom component specifications
- ✅ UX consistency patterns for common interactions
- ✅ Responsive design and accessibility strategy

**The complete UX design specification is now available at:** `{planning_artifacts}/ux-design-specification.md`

**Supporting Visual Assets:**

- Color themes visualizer: `{planning_artifacts}/ux-color-themes.html`
- Design directions mockups: `{planning_artifacts}/ux-design-directions.html`

This specification is now ready to guide visual design, implementation, and development."

### 2. Workflow Status Update

Update the main workflow status file:

- Load the project's workflow status file (if one exists)
- Update workflow_status["create-ux-design"] = `{planning_artifacts}/ux-design-specification.md`
- Save file, preserving all comments and structure
- Mark current timestamp as completion time

### 3. Suggest Next Steps

UX Design complete. Invoke the `bmad-help` skill.

### 5. Final Completion Confirmation

Congratulate the user on the completion you both completed together of the UX.



## SUCCESS METRICS:

✅ UX design specification contains all required sections
✅ All collaborative content properly saved to document
✅ Workflow status file updated with completion information
✅ Clear next step guidance provided to user
✅ Document quality validation completed
✅ User acknowledges completion and understands next options

## FAILURE MODES:

❌ Not updating workflow status file with completion information
❌ Missing clear next step guidance for user
❌ Not confirming document completeness with user
❌ Workflow not properly marked as complete in status tracking
❌ User unclear about what happens next

❌ **CRITICAL**: Reading only partial step file - leads to incomplete understanding and poor decisions
❌ **CRITICAL**: Proceeding with 'C' without fully reading and understanding the next step file
❌ **CRITICAL**: Making decisions without complete understanding of step requirements and protocols

## WORKFLOW COMPLETION CHECKLIST:

### Design Specification Complete:

- [ ] Executive summary and project understanding
- [ ] Core experience and emotional response definition
- [ ] UX pattern analysis and inspiration
- [ ] Design system choice and strategy
- [ ] Core interaction mechanics definition
- [ ] Visual design foundation (colors, typography, spacing)
- [ ] Design direction decisions and mockups
- [ ] User journey flows and interaction design
- [ ] Component strategy and specifications
- [ ] UX consistency patterns documentation
- [ ] Responsive design and accessibility strategy

### Process Complete:

- [ ] All steps completed with user confirmation
- [ ] All content saved to specification document
- [ ] Frontmatter properly updated with all steps
- [ ] Workflow status file updated with completion
- [ ] Next steps clearly communicated

## STEP 14 SELF-CHECK (Before Declaring Complete):

Run these 4 consistency checks before announcing completion. If any fail, note the issues in the spec and inform the user.

**Check 1: Color Token Uniqueness**
- Verify no duplicate token values in the design token set
- Semantic tokens (--color-primary, --color-danger, --color-success, etc.) must not accidentally share the same hex value
- If duplicates found: list them explicitly in the spec for the team to resolve before implementation

**Check 2: Typography Discipline**
- Confirm only ONE body font is in use (two body fonts = visual noise without intentional reason)
- Verify heading font + body font have clear optical contrast — similar weight families defeat the purpose
- Cross-check both fonts against the Step 6 Font Blacklist (Poppins, Montserrat+Open Sans, Nunito)
- If fonts are from the blacklist: flag and recommend alternatives

**Check 3: Core Component State Coverage**
- Confirm all core components (forms, buttons, data displays) have: default + error state + loading state defined
- Check that interactive forms have validation error states with microcopy
- Check that action buttons have loading states (not just default + hover)
- Check that data lists/tables have empty states with actionable copy
- If missing: flag the specific components in the spec

**Check 4: AI Pattern Audit**
Check the design directions and component patterns against the AI Slippery Slope Blacklist:
- [ ] Purple/indigo gradients as default palette choice
- [ ] 3-column "feature benefits" grid layout
- [ ] Colored icon circles in feature/info sections
- [ ] Everything center-aligned with uniform spacing
- [ ] Identical bubble/card borders on all containers
- [ ] Decorative background blobs or wave shapes
- [ ] Emoji used as design/UI elements
- [ ] Colored left-border "tip" cards
- [ ] Generic hero copy ("Transform your workflow" / "Everything you need")
- [ ] Cookie-cutter section rhythm: hero → features → testimonials → CTA

If any are present in the spec: flag them explicitly and ask the user to confirm intentionality before finalizing.

**If all 4 checks pass → proceed to HD Trigger below.**
**If issues found → document them in spec Part 6 (Decision Log) and present to user before completing.**

## HD TRIGGER (After Self-Check Passes):

After self-check is complete, offer handoff document creation:

```
"UX Design Specification complete for {{project_name}}! ✅ Self-check passed.

Before we close out, would you like to create structured handoff documents 
for your development team? These translate the UX spec into precise component 
specifications with complete interaction states and acceptance criteria — 
exactly what developers need to implement without guessing.

[Y] Yes, create handoff documents now (recommended before development starts)
[N] Skip, the UX spec is sufficient for our team"
```

- If Y → invoke `bmad-ux-handoff` skill (HD capability, sub-flow — returns here after completion)
- If N → proceed to final completion summary in section 1 above

## WORKFLOW FINALIZATION:

- Set `lastStep = 14` in document frontmatter
- Update workflow status file with completion timestamp
- Provide completion summary to user
- Do NOT load any additional steps

## FINAL REMINDER:

This UX design workflow is now complete. The specification serves as the foundation for all visual and development work. All design decisions, patterns, and requirements are documented to ensure consistent, accessible, and user-centered implementation.

**Congratulations on completing the UX Design Specification for {{project_name}}!** 🎉

**Core Deliverables:**

- ✅ UX Design Specification: `{planning_artifacts}/ux-design-specification.md`
- ✅ Color Themes Visualizer: `{planning_artifacts}/ux-color-themes.html`
- ✅ Design Directions: `{planning_artifacts}/ux-design-directions.html`
