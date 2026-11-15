---
name: review-feature
description: Review a completed feature or milestone against its plan in docs/plans, resolve remaining work, verify completion, and update the plan's status. Use after implementation and before reporting a planned feature complete, or when explicitly asked for a completion review.
---

# Review a Feature

Close the loop between a plan and its implementation. Check actual behavior, resolve remaining work within the feature's scope, and leave the existing plan with an evidence-backed status. Honor an explicit request for a read-only review.

## Establish the review scope

Read the repository guidelines in `.agents/AGENTS.md` or root `AGENTS.md`, and the relevant plan under `docs/plans/`. Use the plan named by the user or implementation context; otherwise find the plan that matches the feature. Read related code, changes, tests, and documentation. Preserve unrelated work already present in the workspace.

Identify the feature's goals, deliverables, acceptance criteria, dependencies, and any scope changes agreed with the user. Separate this feature's milestone from later phases in an overarching plan. Ask which plan applies only if ambiguity would materially change the review.

If no matching plan exists, review against the user's stated requirements and disclose the missing plan. Do not invent a retrospective plan or claim plan-backed completion. Continue useful verification without requiring a new planning exercise.

## Compare, finish, and clean up

Trace each relevant deliverable and success criterion to implementation and verification evidence. A checked box, a successful build, or the implementer's summary alone does not establish that the intended behavior works. Inspect the user-facing flow and important integration boundaries where applicable.

Look for unfinished behavior, placeholders, broken error paths, stale documentation, and temporary scaffolding left by the feature. Resolve omissions and defects within the agreed scope. Remove feature-specific debug code and obsolete scaffolding when their purpose is understood; preserve research evidence, datasets, and unrelated files. Keep cleanup proportional to the feature rather than starting a broad refactor.

Do not weaken acceptance criteria, silently drop scope, or defer required work merely to declare completion. Record substantial new requirements separately. When a remaining item needs a user decision or unavailable external dependency, state the specific gap and continue independent work that can still be completed.

## Verify the result

Run available checks appropriate to the change: relevant tests, build, lint or type checks, and direct behavior checks as needed. For visual features, inspect the affected screen or scene when runnable. Add or adjust tests when they meaningfully verify behavior or prevent a discovered regression, rather than mirroring implementation details.

Use the plan's milestone evidence requirements. For this project, applicable checks may include terrain and overlay alignment, nodata and barrier handling, route correctness, or agreement between globe, scene, and HUD state. Apply only checks relevant to the feature.

After fixes, rerun affected checks. Distinguish passing, failing, and unrun checks; explain missing verification and its effect on the completion claim. Do not substitute a smoke check for the broader behavior promised by the plan.

## Update the existing plan

Update the relevant milestone or feature status in its original plan, preserving its goals and decision history. Use the plan's existing status convention; if none exists, use `In progress` or `Complete` and state blockers separately.

Add a concise review note with the review date, changes or cleanup performed, verification results and evidence locations, and remaining gaps or decisions. Link evidence relative to the plan file. Keep this summary at the plan's level of detail rather than adding a full command log or task diary.

Mark a feature or milestone `Complete` only when all its agreed deliverables and success criteria have been verified. Required work or verification that remains unresolved keeps it `In progress`. Completing one milestone must not mark the whole project plan complete while other required phases remain. Update the plan's current-state and next-milestone sections when the review changes them.

For a read-only review, propose the status update and review note without modifying files.

## Report

Return the plan link, reviewed scope and resulting status, a brief account of fixes and verification, and unresolved items. Say clearly when the feature remains incomplete. A completion review does not imply authorization to publish, deploy, or start the next feature.
