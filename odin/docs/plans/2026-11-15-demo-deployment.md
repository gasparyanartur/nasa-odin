# Client-side Martian Map demo

Note (2026-11-15): this is a dated record. Paths under `odin/app/src` and the old static Marswalk app it names were removed from the tree on 2026-11-15; they remain in git history at commit 66ee212.

Date: 2026-11-15. Status: In progress. The user authorized FR-028 on 2026-11-15. FR-028 is complete locally after the review below; hosting/publication remains FR-029 and has not started. This revises the earlier Docker/Render proposal.

## Goal and success criteria

Host the integrated Station → Tablet → HUD application as static files on Cloudflare. Both prepared Gale sites must retain interactive route planning, walking, conditions evaluation and browser-local field records. Visitors need only a supported desktop browser and internet access; no application server, VPS or database is required by the proposed architecture.

Success means the production build works on a static file server with no Python process or `/api` requests, preserves the existing planner's constraints and outputs within documented numerical tolerances, stays responsive while calculating, and passes a fresh-browser walkthrough at the public HTTPS URL.

## Current state

The [React/Vite frontend](../../package.json) already renders the globe and surface in the browser. Approximately 25 MB of prepared data is under `public/`; the largest prepared file is about 2.1 MB. Both height/slope/validity grids and historical conditions are already loaded by the browser. Bradbury uses a 401 × 401 grid; Boxwork uses 201 × 201. Field records already persist locally with import/export.

The application now calls [BrowserPlanner](../../src/mission/planner/client.ts) through [usePlanner](../../src/mission/planner/usePlanner.ts). Route comparison, return estimates, conditions and diagnostics execute in [the TypeScript planner](../../src/mission/planner/core.ts) inside module Web Workers. The former HTTP API helper and Vite API proxies are removed. [server/planner.py](../../server/planner.py), [server/conditions.py](../../server/conditions.py) and [server/app.py](../../server/app.py) remain offline reference/test tools only.

The Docker image now serves files without Python. Development/demo startup and production browser tests no longer launch a backend; browser acceptance uses a files-only server. [Release instructions](../release.md) describe the static build and separate FR-029 handoff. Concurrent expedition-feedback/UI work has been preserved; verification uses an isolated build directory, port and test outputs.

## Proposed approach

```text
Cloudflare static hosting
  └─ production dist/: HTML, JS, Cesium workers, prepared datasets
       ↓
Visitor's browser
  ├─ React + Cesium + Three.js
  ├─ browser Web Worker: route search and conditions evaluation
  └─ browser storage: personal field records
```

Recommend Cloudflare Workers Static Assets for a new Cloudflare deployment. Despite the platform name, this can serve files without a server-side Worker script. Cloudflare currently recommends Workers for new projects; Pages also supports static hosting. Static asset requests are documented as free and unlimited. Verify the final build against current asset limits before publishing. [Cloudflare guidance](https://developers.cloudflare.com/pages/framework-guides/), [static asset serving](https://developers.cloudflare.com/workers/static-assets/), [billing](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/).

### Browser planner

Port the existing search and conditions calculations to TypeScript and run them in a dedicated browser Web Worker. This browser worker is unrelated to Cloudflare's server-side Workers product. Initialize its terrain once per active dataset using copies or worker-owned buffers so the rendering thread retains its arrays.

Preserve shortest/gentler objectives, directed uphill/downhill costs, bilinear walking footprints, slope/exclusion barriers, diagonal corner rules, profiles, warnings, departure-hour comparison, geographic coordinates and failure diagnostics. Handle Python's rounding and deterministic heap tie-breaking explicitly. Equal-cost paths may require distinguishing cost/constraint parity from identical vertex sequences.

Replace the two API calls with a typed local planner interface. Preserve cancellation and stale-result protection across site/settings changes. Request IDs alone suppress stale results but do not interrupt a synchronous search; terminate/recreate the browser worker or implement cooperative cancellation where required. Prevent repeated return estimates from building an unbounded queue.

Use the existing Python implementation as a development/test reference during migration. Python is not part of the hosted runtime. Do not introduce Pyodide/WASM merely to retain Python unless a measured reason makes it preferable to the direct TypeScript port.

### Static deployment

Keep the existing Vite build and Cesium asset copying. Add only the small Cloudflare deployment configuration needed to publish `dist/` and support direct example URLs. Build with `npm run build`; verify locally with a static preview and no API proxy/backend. Start with the provider hostname and choose a custom domain later if needed.

Serve HTML and stable dataset paths with appropriate revalidation; reserve immutable caching for content-addressed URLs. Missing binary assets must fail clearly rather than returning HTML through a generic SPA fallback. Check content types, Cesium worker paths and deployment asset limits.

Global imagery still comes from Mars Trek/ArcGIS, and fonts currently use Google Fonts. The client-side migration does not make these external services offline. Verify prepared-site entry and local terrain behavior when imagery services fail. Shared records, server accounts, object storage, a custom backend and full offline support are outside this scope.

## Milestones

| Milestone | Status | Deliverable and completion evidence |
| --- | --- | --- |
| 1. Browser planner | Complete locally | Port search, diagnostics and conditions; compare representative successful/blocked/disconnected and return cases against Python on both real sites. Preserve assumptions and data registration. |
| 2. Static application | Complete locally | Replace API use with the browser worker; verify cancellation, stale-result handling, field restrictions, route comparison, return updates and UI responsiveness. Test a production build with no Python process. |
| 3. Cloudflare scaffolding | Proposed | Add minimal static deployment configuration and update run/release instructions. Validate the built files, workers, binary responses, cache behavior and direct example links. Reuse existing tests rather than introducing a broad release platform. |
| 4. Public acceptance | Proposed | Publish the reviewed snapshot; verify both Gale sites, planning, walking, field export/reload, Jezero capability limits and external-layer failure recovery at the actual HTTPS URL. Record release identity and observed performance. |

FR-028 covers milestones 1–2. FR-029 covers hosting scaffolding and public acceptance in milestones 3–4. The latter remain unstarted.

## Risks and open decisions

- **Browser performance:** the grids are bounded, but search, repeated return requests and disconnected-route diagnostics still need timing and memory checks on the target laptop. Use a browser worker and measure responsiveness before claiming readiness.
- **Behavior parity:** retain the current science/terrain semantics and existing failure explanations. Isolate floating-point and tie-breaking differences rather than silently changing route policy.
- **Persistence:** records stay on the same browser/origin; a new domain does not inherit the old origin's local storage. Existing export/import is the transfer mechanism.
- **Deployment ownership:** the Cloudflare account, repository connection and final hostname remain to be established. This plan creates no external resources.
- **Demo scope:** the root integrated app is the deployment target. The standalone Marswalk prototype is separate.

## Next milestone

FR-029: configure the chosen Cloudflare static hosting and publish the reviewed build, then verify the actual public HTTPS URL. No hosting action is part of this completed FR-028 migration.

## FR-028 completion review - 2026-11-15

Complete locally. The app now uses a typed TypeScript planner in browser module workers for outbound/return search, historical conditions, departure comparison and diagnostics. Independent route/return lanes cache their own terrain copies, terminate superseded CPU work and reject late results. The main rendering/collision arrays remain attached. No prepared scientific data, route objectives, walking policy or field-record format changed.

Development/demo startup, Vite configuration, recording readiness checks, Docker and production browser acceptance no longer require Python or `/api`. The optional container and acceptance server serve files only. Python remains available solely for offline preparation/reference tests. Documentation and the backlog now distinguish FR-028 from publishing under FR-029. Concurrent expedition-feedback implementation was retained; its walk-test helper received explicit pointer-lock readiness assertions, without changing its implementation.

Verification: **76 frontend tests**, **26 planner-reference checks** (20 real-data Python parity cases plus six synthetic cases), **33 offline Python tests**, a production build and **32 hardware-accelerated production browser scenarios** passed. Parity compares full route sequences, metrics, profiles, conditions, recommendation and diagnostics with relative numeric tolerance `1e-7`. The files-only checks cover both sites, walking, restrictions, saved records, return updates, worker load/crash recovery and absence of runtime API requests. Container binary responses and missing-API behavior were checked. The known large-bundle warning remains. See [verification and logs](../evidence/fr028/verification.json).

Earlier forced-SwiftShader verification passed 30/32 scenarios, with pause/retry input and screenshot timing failures; a clock-only retry exceeded its original 120-second budget. Hardware checks also exposed test helpers sending keys before pointer-lock handlers settled. Explicit lock/unlock readiness checks fixed the affected traverse/event/retry scenarios; the final complete hardware run passed all 32. The updated full software suite has not been rerun, and no acceptable software-rendering POV performance is claimed.

A bounded [desktop worker probe](../evidence/fr028/worker-performance.json) completed route comparisons during active POV. Warm-up and concurrent QA prevent causal frame-rate comparisons. Intended-laptop startup/FPS gates remain open in the surface integration work; FR-028 does not establish a 30 FPS guarantee. The overall deployment plan remains in progress until FR-029 completes hosting and public-URL acceptance.
