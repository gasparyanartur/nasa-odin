# Mars globe with a replaceable dataset

Date: 2026-11-13. Status: Complete. This records the plan approved in conversation before implementation.

Subsequent scope: the approved [integrated Gale prototype](2026-11-13-gale-prototype.md) extends this completed foundation with independent local terrain layers, routing and the astronaut HUD. The review below records the original globe milestone.

## Goal and scope

An interactive Mars sphere with one active imagery dataset. Ship MOLA colour shaded relief; import a local JSON manifest to replace the layer live while retaining the camera, opacity, and visibility. Imports last for the session. Terrain displacement, raw scientific-file ingestion, numeric elevation inspection, routing, and HUD work are outside this milestone.

## Approach

React/TypeScript/Vite application; Cesium isolated in a globe controller; plain JSON dataset definitions; a WMTS adapter; and a layer lifecycle independent of the renderer. All product-specific source, tiling, reference, and attribution values belong to the manifest. A future data format adds an adapter without replacing the interface. Use a project-specific Node 22 runtime, static hosting, direct provider requests, and a committed lockfile.

See [existing technical research](../research/tech-stack.md) for the wider project. It does not expand this MVP's scope.

## Milestones

- [x] Application: buildable application, configured Cesium assets/workers, navigable Mars sphere.
- [x] Dataset: bundled MOLA manifest, WMTS rendering, visibility/opacity, source information and errors.
- [x] Replacement: local manifest import, latest request wins, previous layer cleanup, camera/control preservation, invalid-import recovery.
- [x] Handoff: copyable manifest and instructions, focused validation/lifecycle tests, production preview, real second-dataset swap verification, browser inspection, completion review.

## Acceptance and verification

TypeScript/build and focused tests pass. In the production preview, MOLA tiles render and controls work. Temporarily import a second real WMTS source to prove replacement without code changes or camera reset; only MOLA ships as an application dataset. Malformed JSON, unsupported coordinate references and unavailable tiles produce useful errors. Invalid imports preserve the active layer. Repeated replacements retain exactly one layer and remove stale listeners.

## Review

Completed on 2026-11-13 using the repository's review-feature workflow. The globe, manifest boundary, adapter, replacement lifecycle and documentation were checked against this plan.

- `npm test`: 16 passing tests cover malformed/unsupported manifests, failed replacement, repeated replacement, preserved controls, stale request disposal and unmount cleanup.
- `npm run build`: strict TypeScript and the production build pass. Cesium contributes a large bundle (approximately 1.19 MB compressed); Vite emits a size advisory, not a build failure.
- Production browser acceptance: passed against live MOLA and CTX tile services. Verified zoom, visibility/opacity, JSON import, pixel-identical camera view across a hidden-layer swap, malformed JSON and unsupported-reference preservation, failed tiles, retry and working-source recovery. No uncaught page exceptions were observed. CTX is a test-only fixture, not a shipped application layer.
- Desktop, swapped-source and phone-width screenshots were visually inspected. Local evidence is regenerated under `test-results/globe-production-globe-con-2409e-real-data-swap-and-recovery/`; see [the browser acceptance test](../../tests/globe.spec.ts).
- A separate development-server browser check loaded MOLA and Cesium workers successfully under React StrictMode. Local diagnostics/screenshots are under `tmp/`.
- Fixed the production asset-copy path discovered during browser testing, corrected a mobile heading spacing issue, and aligned CTX zoom limits with current capabilities. Removed stale repository setup guidance and checked local documentation links and `git diff --check`.

Handoff: [dataset integration](../datasets.md), [bundled copyable manifest](../../public/datasets/mola.json), and [run commands](../../README.md). Replacing a supported source requires only a manifest import; a different data format requires a new adapter. Node 22.23.4 is pinned, satisfying the installed Cesium dependencies' Node 22.17 minimum.

No required MVP work remains. The wider route-planner/HUD project remains future work. Rendering uses a sphere and pre-coloured imagery; numeric terrain and alternate projections are not implemented. Tile availability remains dependent on the external providers. Browser automation uses software WebGL and accepts HTTPS interception certificates in this test environment.
