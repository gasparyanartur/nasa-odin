# Repository Guidelines

## Project Structure & Module Organization

This workspace contains the integrated Gale prototype: globe, local route planner and walkable astronaut HUD, plus supporting research.

- `docs/research/background-research.md`: challenge context, Mars datasets, precedents, and scientific limitations.
- `docs/research/tech-stack.md`: earlier feasibility research; distinguish proposals there from current implementation.
- `docs/plans/`: overarching project and feature plans, created as needed.
- `.agents/skills/`: repository-local agent skills.
- `tmp/`: downloaded metadata, service responses, and dated access checks, including `tmp/feasibility-2026-11-03/access_checks.json`. This directory is ignored by `.gitignore`.

- `src/`: React UI, WMTS definitions/lifecycle, Cesium globe, shared terrain/mission geometry and Three.js walking/HUD.
- `public/datasets/mola.json`: global WMTS example; keep source-specific values here.
- `public/gale/`: prepared real terrain, imagery, environment and metadata; shared by browser and backend.
- `server/`: FastAPI/A* planner and Python tests.
- `scripts/`: reproducible data preparation and paired frontend/API startup.
- `tests/`: production globe/mission acceptance checks and QA-only CTX manifest.
- `docs/datasets.md`: integration contract and supported coordinate/tiling limits.
- `docs/gale-data.md`: scientific references, processing and model assumptions.

## Documentation Audience

`README.md` is for human readers. Lead with the project's purpose, capabilities, and intended user experience. Include technical details when they help people understand or use the project. Keep agent instructions and contributor workflow rules in `AGENTS.md`.

## Planning

For overarching project or feature planning, use the [make-plan skill](skills/make-plan/SKILL.md), which can also be requested as `$make-plan`. Read its instructions before drafting. Save plans under `docs/plans/` using `YYYY-MM-DD-short-topic.md`; revise an existing plan when requested. Focus on scope, architecture, dependencies, major milestones, and success criteria rather than detailed task checklists. A request to create a plan does not authorize starting implementation.

## Feature Completion Review

After implementing a feature or planned milestone, use the [review-feature skill](skills/review-feature/SKILL.md) before reporting completion; do not wait for a separate review request. It can also be invoked as `$review-feature`. Compare the work with the relevant plan in `docs/plans/`, resolve remaining work and cleanup within scope, verify the result, and update that plan's status and review evidence. Keep incomplete or unverified items visible, and distinguish a completed milestone from completion of the whole plan.

## Build, Test, and Development Commands

Use Node 22.23.4 from `.nvmrc` and npm. The host default may still be Node 18. Commands from the repository root:

- `npm ci`: install locked dependencies.
- `npm run dev`: Vite development server.
- `npm run dev:all`: Vite and local Python planner (requires `.venv` and `requirements.txt`).
- `npm run demo`: production preview and planner; build first.
- `npm run build`: TypeScript check and production bundle, including Cesium assets/workers.
- `npm run preview`: serve `dist/`.
- `npm test`: manifest/lifecycle and shared mission geometry tests.
- `npm run test:api`: Python planner/API tests, including real prepared terrain.
- `npm run prepare:data`: regenerate real Gale assets using public range-readable rasters/PDS records.
- `TMPDIR="$PWD/tmp" PLAYWRIGHT_BROWSERS_PATH="$PWD/tmp/browser" npm run test:browser`: production browser acceptance check; install Chromium as documented in README first.

Useful inspection commands:

- `rg --files`: list documents and local evidence files.
- `python3 -m json.tool tmp/feasibility-2026-11-03/access_checks.json`: validate and inspect the saved service-check JSON; this does not recheck endpoints.
- `mkdir -p tmp/<task-name>`: create a local scratch directory.

Keep installation, run, build, and test commands current in README.

## Coding Style & Naming Conventions

Use concise Markdown, descriptive headings, fenced command examples, and relative links between local documents. Keep established report names uppercase; use descriptive lowercase filenames for downloaded evidence and `YYYY-MM-DD` in dated check directories. Use two-space indentation for new JSON. TypeScript uses strict checking. Keep dataset definitions and lifecycle free of renderer imports; confine Cesium to `src/globe/`. No formatter or linter is configured.

## Validation Guidelines

Vitest covers manifest/lifecycle and mission geometry; Python unittest covers routing/API; Playwright verifies production globe and complete excursion flows. No coverage threshold is configured. Inspect visual changes. For documentation, check local links and retain source URLs, dates, assumptions and observed results. Endpoint access alone does not establish usable raster coverage or rendering performance.

When implementing routing, verify nodata and barrier handling, disconnected endpoints, directed slope costs, and A* agreement with Dijkstra on small grids. Verify alignment between map, terrain, and HUD coordinates.

## Commit & Pull Request Guidelines

The Git history currently contains only an initial commit, so no message convention is established. Use concise imperative subjects, such as `docs: clarify terrain coverage limits`. Pull requests should explain the change, link relevant issues or sources, and report validation and remaining uncertainty. Include screenshots for visual changes.

## Scientific Data & Agent Instructions

Preserve product identifiers, resolution, footprints, acquisition dates, coordinate conventions, and vertical datums. Distinguish measurements, derived values, and scenarios; calculate slopes from numeric terrain rasters. Keep EVA resource assumptions explicit.

Use repository-local `tmp/` for temporary files; avoid `/tmp`.
