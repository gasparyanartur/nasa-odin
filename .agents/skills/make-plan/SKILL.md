---
name: make-plan
description: Create or revise an overarching project or feature plan in docs/plans. Use for project roadmaps, major component plans, and phased implementation strategies, rather than small fixes or detailed task checklists.
---

# Make a Plan

Write a durable plan for humans to review and use when directing later work. Focus on the overall approach, major decisions, and milestones. Creating a plan does not start its implementation.

## Ground the plan

Read the repository's `AGENTS.md`, `README.md`, relevant research under `docs/research/`, any related plans under `docs/plans/`, and the implementation where it exists. Distinguish the user's confirmed scope, implemented behavior, recommendations, and unresolved choices. Research recommendations are not automatically project decisions.

Use the user's stated objective as the scope. For a whole-project plan, account for the globe, route planner, astronaut HUD, and their shared data and state. For a component plan, include only the cross-component dependencies that matter. Do not expand every plan to the whole project.

Resolve routine choices with explicit assumptions. Ask about missing information only when it materially changes the plan; otherwise capture it as an open question. Verify external technical claims when they are necessary to choose an approach, rather than repeating dated research as current fact.

## Write the plan

Create `docs/plans/` if needed. Save a new plan as `docs/plans/YYYY-MM-DD-short-topic.md`, using the current date and a descriptive lowercase, hyphenated topic. When asked to revise an existing plan, update that file instead of creating a competing version. Do not overwrite an unrelated plan.

Use a descriptive title, date, and status such as `Draft`. Do not imply that a proposed plan has been approved. Adapt these sections to the work:

- **Goal and success criteria:** the intended outcome and how to recognize it.
- **Scope:** included capabilities and meaningful boundaries.
- **Current state:** relevant existing work and gaps, with links to supporting documents or code.
- **Proposed approach:** major components, responsibilities, interfaces, and important tradeoffs. Keep recommendations distinct from confirmed decisions.
- **Phases and milestones:** a manageable sequence of substantial outcomes. For each phase, state its deliverable, dependencies, and the evidence needed to consider it complete.
- **Risks and open decisions:** uncertainties that could change the approach and how to resolve them.
- **Next milestone:** the first useful outcome to pursue after planning.

Keep the plan overarching: describe outcomes and sequencing rather than exhaustive file edits, shell commands, function signatures, or daily task lists. Include implementation details only when they explain a consequential decision or dependency. Avoid unsupported dates and effort estimates.

For data-dependent milestones, identify the required coverage, alignment, and quality checks. Keep environmental scenarios and EVA resource assumptions explicit when relevant to the scope.

## Finish

Check that phases lead to the stated outcome, dependencies are consistent, and local links resolve relative to the plan file. Link to existing research instead of duplicating it. Return the saved plan's path and a brief description of its scope and key unresolved decisions. Stop after planning unless implementation was also requested.
