# Repository Guidelines

## Project Structure & Module Organization

This workspace currently contains research for the NASA Space Apps Martian Map project; no application has been implemented.

- `docs/research/background-research.md`: challenge context, Mars datasets, precedents, and scientific limitations.
- `docs/research/tech-stack.md`: proposed globe, route planner, astronaut HUD, and implementation checkpoints. React/TypeScript and CesiumJS are recommendations, not installed dependencies.
- `docs/plans/`: overarching project and feature plans, created as needed.
- `.agents/skills/`: repository-local agent skills.
- `tmp/`: downloaded metadata, service responses, and dated access checks, including `tmp/feasibility-2026-11-03/access_checks.json`. This directory is ignored by `.gitignore`.

There are no source, test, or packaged asset directories yet. Update this guide when introducing them.

## Documentation Audience

`README.md` is for human readers. Lead with the project's purpose, capabilities, and intended user experience. Include technical details when they help people understand or use the project. Keep agent instructions and contributor workflow rules in `AGENTS.md`.

## Planning

For overarching project or feature planning, use the [make-plan skill](skills/make-plan/SKILL.md), which can also be requested as `$make-plan`. Read its instructions before drafting. Save plans under `docs/plans/` using `YYYY-MM-DD-short-topic.md`; revise an existing plan when requested. Focus on scope, architecture, dependencies, major milestones, and success criteria rather than detailed task checklists. A request to create a plan does not authorize starting implementation.

## Feature Completion Review

After implementing a feature or planned milestone, use the [review-feature skill](skills/review-feature/SKILL.md) before reporting completion; do not wait for a separate review request. It can also be invoked as `$review-feature`. Compare the work with the relevant plan in `docs/plans/`, resolve remaining work and cleanup within scope, verify the result, and update that plan's status and review evidence. Keep incomplete or unverified items visible, and distinguish a completed milestone from completion of the whole plan.

## Build, Test, and Development Commands

No build system, dependency manifest, development server, or automated test runner is configured. Useful inspection commands from the repository root:

- `rg --files`: list documents and local evidence files.
- `python3 -m json.tool tmp/feasibility-2026-11-03/access_checks.json`: validate and inspect the saved service-check JSON; this does not recheck endpoints.
- `mkdir -p tmp/<task-name>`: create a local scratch directory.

Document installation, run, build, and test commands alongside the first implementation.

## Coding Style & Naming Conventions

Use concise Markdown, descriptive headings, fenced command examples, and relative links between local documents. Keep established report names uppercase; use descriptive lowercase filenames for downloaded evidence and `YYYY-MM-DD` in dated check directories. Use two-space indentation for new JSON. No code formatter, linter, or language-specific style is configured.

## Validation Guidelines

There is no test framework or coverage threshold. For documentation changes, check local links and keep source URLs, check dates, assumptions, and observed results explicit. Endpoint access alone does not establish usable raster coverage or rendering performance.

When implementing routing, verify nodata and barrier handling, disconnected endpoints, directed slope costs, and A* agreement with Dijkstra on small grids. Verify alignment between map, terrain, and HUD coordinates.

## Commit & Pull Request Guidelines

The Git history currently contains only an initial commit, so no message convention is established. Use concise imperative subjects, such as `docs: clarify terrain coverage limits`. Pull requests should explain the change, link relevant issues or sources, and report validation and remaining uncertainty. Include screenshots for visual changes.

## Scientific Data & Agent Instructions

Preserve product identifiers, resolution, footprints, acquisition dates, coordinate conventions, and vertical datums. Distinguish measurements, derived values, and scenarios; calculate slopes from numeric terrain rasters. Keep EVA resource assumptions explicit.

Use repository-local `tmp/` for temporary files; avoid `/tmp`.
