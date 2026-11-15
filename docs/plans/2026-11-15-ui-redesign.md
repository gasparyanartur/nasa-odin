# Martian Map UI redesign

Date: 2026-11-15. Status: In progress — implementation and local verification complete; unfamiliar-user validation pending. Implements the user-approved plan for FR-023/024/025/027.

## Goal and confirmed decisions

Make core actions discoverable without page scrolling, simplify all three functional contexts, and preserve existing scientific capabilities and shared mission state.

The application runs on a **laptop with mouse and keyboard**. Station, Tablet and HUD represent interfaces within the astronaut simulation. **Tablet is the astronaut’s simulated device, not a physical tablet device target.** It opens as a flat overlay over the paused surface. Entering prepared terrain does not require a route. Rework typography, spacing, controls, panels and visor presentation together.

## Intended experience and implementation

- Station prioritizes globe and region selection, with visible Enter surface and Open tablet actions. Dataset controls open on demand; historical analysis has a separate workspace.
- Tablet uses Map, Routes, Field data and Display tools. A persistent map accompanies a single task panel. Navigation and primary actions stay fixed while detailed forms scroll inside their panel. Layers and provenance open on demand. Help works on hover, focus and click.
- HUD uses a subtle helmet-shaped visor, compass, sparse projected cues, compact translucent status and contextual warnings. Tablet, logging and pause controls remain accessible.
- Keep one mission state across contexts. Opening Tablet releases pointer lock and pauses movement/time; closing it retains pose, heading, pitch and time, with an explicit terrain click to resume. Preserve drafts, records, restrictions, selections and settings.
- Make surface route guidance optional. Free exploration omits route geometry, progress cues and off-route warnings while retaining terrain/restriction checks, habitat, clocks, logging and independent return estimates. Reuse the return API with shortest mode when no route is selected; failure must not block walking.
- Route comparisons remain habitat-to-destination, labeled accordingly. Target selection, route adoption and ordinary assumption/display changes preserve pose and elapsed time; explicit habitat/departure changes restart the excursion. Current-position replanning remains FR-013.
- Preserve current APIs, scientific data and saved field-record formats. Retain direct example links. No journal, voice notes, mineral layers, larger terrain or deployment is introduced.

## Milestones and acceptance

| Milestone | Evidence required | Status |
| --- | --- | --- |
| Unified visual design | Inspect representative Station, Tablet and HUD layouts together | Complete locally |
| Shared shell and free exploration | Both prepared Gale sites, no-route entry, retained pose/time/drafts, return failure recovery | Complete |
| Capability reorganization | Planning, map layers/evidence, field editing and display settings accessible through labeled controls | Complete |
| Technical and visual review | Frontend/API tests, build, browser workflows, inspected 1280×720 / 1366×768 / 1440×900 and narrow-window captures | Complete locally |
| First-use usability | Unfamiliar users find entry, planning, logging and return to HUD | Unverified; requires participants |

## Verification and boundaries

Core actions must work without document scrolling. Test free exploration, planning/adoption, pause/resume and mode switches, restriction changes (including hidden annotations), failed APIs/assets/WebGL, unsupported regions, retained drafts, keyboard focus and layer/profile alignment. Save evidence under `docs/evidence/ui-redesign/`. Automated checks and developer visual inspection do not establish unfamiliar-user intuitiveness. Existing target-laptop rendering-performance gates and public deployment remain separate open work.

## Next milestone

Conduct the unfamiliar-user walkthrough below, record observed difficulties, and resolve them before marking the overall redesign complete.


## Review — 2026-11-15

Implemented the shared Station/Surface shell, retained-scene Tablet overlay, optional route guidance and independent return estimates. Reorganized existing planning, evidence, layers, field editing and display controls. The new visual system replaces the accumulated context overrides. No backend API or saved-record format changed.

The completion review checked both Gale sites, retained pose/heading/pitch/time and unfinished observations, route comparison/adoption, restriction enforcement, provenance, historical data, import/export, keyboard help/focus, unsupported regions, failed local assets, return-API recovery and renderer recovery. It resolved a legacy sidebar width that overlapped the Station globe/card, stale scene state during renderer retries, and the final mouse movement being saved without updating the paused camera.

Production build, 57 frontend tests and 33 API tests passed. All 27 browser scenarios passed across the final full run (26 passed, one stale heading assertion) and the focused globe rerun after updating that assertion. The strict hidden-imagery equality and real basemap recovery checks passed. See [verification details](../evidence/ui-redesign/verification.json). The production bundle still reports its existing large Cesium/Three chunk warning. Browser checks use software-rendered Chromium; they do not establish target-laptop frame rates.

Inspected all four contexts at 1280×720, 1366×768, 1440×900 and 800×700, including no document scrolling, complete map coverage and visible primary actions. Representative captures: [Station](../evidence/ui-redesign/station-1366.png), [Tablet map](../evidence/ui-redesign/tablet-map-1280.png), [Routes](../evidence/ui-redesign/tablet-routes-1280.png), [HUD](../evidence/ui-redesign/hud-1366.png), [field editing](../evidence/ui-redesign/v05-field-tablet.png), [Boxwork surface](../evidence/ui-redesign/boxwork-real-surface.png). The full size matrix is in the same evidence directory. Laptop usability is the target; the narrow capture checks a resized laptop browser, not physical tablet or phone support.

### Remaining acceptance: unfamiliar-user walkthrough

This has **not been conducted**. Automated workflow checks and developer screenshot inspection do not prove intuitiveness. Give unfamiliar participants the following tasks without directing them to controls, and record completion, assistance, wrong turns and their own descriptions of confusing elements:

1. Choose a prepared Gale site and enter its surface without planning a route.
2. Open the astronaut Tablet, compare habitat-to-destination routes and start guidance.
3. Log an observation, switch tools before saving, return and finish the record.
4. Find active restrictions and a record's provenance, then adjust a display setting.
5. Close Tablet, resume from the retained location, and find the return estimate.

The overall plan and FR-023/024/025/027 remain open until this required validation is recorded and any resulting usability defects are resolved. Current-position replanning, journal/voice notes, larger terrain, physical 3D Tablet rendering and deployment remain outside this redesign.


## Follow-up review — Boxwork request validation, 2026-11-15

A user-reported default-planning failure reproduced against both previously running local planners. They were older processes: one rejected Boxwork and historical settings, the other rejected Boxwork. The browser's generic validation message concealed these specific API rejections. The fresh planner used by the original browser suite did not reproduce this runtime version mismatch.

Restarted both local preview/planner pairs with current source; each now returns HTTP 200 and two Boxwork routes with the complete UI defaults. Request validation now shows the field and reason, plus an older-planner restart hint for rejected datasets/unknown fields. It appears above the Tablet workspace. README explains that browser refresh alone does not restart Python.

Verification: production build and 58 frontend tests passed; four focused browser scenarios passed, including Station-to-Boxwork defaults, a simulated stale-planner rejection followed by successful retry, slope diagnostics/reset and hidden restriction diagnostics. See [follow-up evidence](../evidence/ui-redesign/boxwork-followup.json) and [validation screenshot](../evidence/ui-redesign/boxwork-validation.png). The first-use participant walkthrough remains pending.
