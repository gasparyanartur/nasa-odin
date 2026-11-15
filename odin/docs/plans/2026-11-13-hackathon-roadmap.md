# Martian Map hackathon roadmap

Date: 2026-11-13. Status: In progress. Approved by the user in conversation. Implementation must remain in a separate workspace so the existing checkout stays runnable.

## Goal and success criteria

A public demo where users discover regions on Mars, select a region, inspect real datasets and layers, plan an excursion, and follow it using the HUD. Regional coverage and capabilities must be obvious. Plan for solo delivery over November 14–15, preserving the final quarter of available time for verification, recording and submission.

## Current state

The existing [Gale prototype](2026-11-13-gale-prototype.md) and [modular globe](2026-11-13-modular-globe-mvp.md) are the baseline. They already provide real prepared terrain, routing and a walkable HUD. Baseline checkpoint in the isolated workspace: `5a53da3`. The original checkout was copied without modifying its files; a local SHA-256 inventory is retained under `tmp/` for final verification.

## Scope and approach

- Catalog Gale–Bradbury and Jezero separately from their datasets. Ship MOLA/CTX basemaps; enable local planning/walking only for verified numeric terrain in Gale.
- Show map markers and prepared coverage. Marker/sidebar selection share state, fly to the region and expose appropriate actions.
- Use one global basemap, then independently controlled regional imagery, elevation and slope with shared opacity/visibility and source legends. REMS/RAD are dated site context, not invented spatial forecasts.
- Preserve region and layers across Explore, planner and HUD. Region changes cancel requests and clear incompatible mission state. Retain the Gale API/algorithms and advanced JSON import.
- Serve production frontend, prepared assets and FastAPI from one Docker service. Default hosting is Render Free, with a recording as fallback. No account system or database.

## Milestones

| Milestone | Status | Deliverable and evidence required |
| --- | --- | --- |
| 1. Data catalog | Complete | Source-backed locations, validated basemap references, exact prepared bounds, display/planning distinction, baseline checkpoint. |
| 2. Region discovery | Complete | Both regions discoverable on the initial globe, marker/sidebar agreement, camera focus and obvious region identity. |
| 3. Integrated layers | Complete | Selectable MOLA/CTX; independent prepared overlays and context, legends, coverage, errors and recovery; camera/selection preserved. |
| 4. Excursion integration | Complete | Globe → Gale → layers → planner → HUD → Explore; shared settings and state isolation when switching to Jezero. |
| 5. Publish and present | In progress | Verified public URL, fresh-browser journey, startup-after-idle check, demo recording and submission materials with checked links/credits. |

## Verification

Unit-test catalog references, capabilities, independence of settings and geographic/numeric alignment. Browser-test map and sidebar selection, dataset replacement, layer preservation, stale-request cancellation, repeated region switching and missing-data recovery. Preserve routing, coordinate and manual walking regressions. Build a clean Docker image and check same-origin API, assets, Cesium workers and 404s. Inspect desktop/mobile screenshots and record the real workflow.

## Risks and boundaries

Only Gale has prepared numeric terrain. Other terrain packages, science stops, spectral/thermal pipelines and resource optimization follow this release. The existing large Cesium bundle and external tile availability remain release considerations. Render publication requires a user account and repository access; deployment configuration alone is not a public deployment. Event requirements and the registered event’s deadline must be checked before submission; do not infer the Universal Event team owner’s timezone from the implementer’s timezone.

## Review

Reviewed 13 November 2026 using the repository’s review-feature skill. Milestones 1–4 are complete locally; milestone 5 remains in progress.

- Strict TypeScript/production build, 24 frontend unit tests, 10 Python tests, and all four production browser scenarios pass. A focused globe browser rerun also passes after fixing delayed imports overriding newer catalog selections.
- Verified catalog references, real prepared coverage/coordinate alignment, marker/sidebar discovery, independent overlays, shared planner state, route-request cancellation, repeated region switching, local-data failure/recovery, JSON import/recovery and manual walking/HUD. Existing A*/Dijkstra and terrain invariants remain passing.
- Clean Docker build succeeds. The running non-root container serves frontend, terrain, Cesium workers and route API together; health and route computation pass. The original checkout’s 59 inventoried source/asset files remain byte-identical, and its branch remains `master`.
- Source-service investigation identified an actual CTX HTTP 500 for coarse tile 1/1/3, while detailed tiles return real images. Per-tile retry limits prevent unrelated successes from creating endless retries. The UI reports unavailable tiles; browser checks validate successful real CTX responses and recovery to MOLA rather than claiming full upstream coverage.
- Desktop and mobile views were visually inspected. A real application walkthrough is recorded in seven four-second chapters; slow load intervals are omitted and 20× walking pace is labeled. The recording checks that simulated position actually changes. See [verification](../evidence/integration-verification.json), [region discovery](../evidence/explore-regions.png), [planner](../evidence/integrated-planner.png), [HUD](../evidence/integrated-hud.png), [mobile](../evidence/integrated-mobile.png), and [video](../evidence/demo-walkthrough.mp4).
- Public deployment is not complete: a Render account is needed. Public fresh-browser/idle-start checks, public video hosting, Team Owner timezone, eligibility clarification for pre-event work and final submission remain open. See [release instructions](../release.md) and [submission draft](../submission.md).

## Next milestone

Connect the reviewed branch to Render after account setup, deploy it, verify the actual public URL after inactivity, publish the recording and resolve the submission details. Do not mark the roadmap complete until that evidence exists.
