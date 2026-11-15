# Demo deployment and release

Status: FR-028 migrates the integrated app to a static client-side runtime. FR-029 tracks actual hosting setup and publication; no public URL is claimed here. See the [deployment plan](plans/2026-11-15-demo-deployment.md).

## Run and verify the static build

```bash
nvm use
npm ci
npm run build
node scripts/serve-static.mjs --port 8373
```

Open <http://127.0.0.1:8373>. The server serves files only. Route comparison, return estimates and conditions evaluation run in browser Web Workers; Python is retained only for offline data tools and reference tests. Global tiles and optional Google Fonts still use external services.

For development use `npm run dev`. To run beside another checkout, use `WEB_PORT=5273 npm run dev:all`; for a separate production preview use `WEB_PORT=4273 npm run demo`. `API_PORT` is no longer used.

The optional container serves the same static files without Python or FastAPI:

```bash
docker build -t martian-map:static .
docker run --rm -p 127.0.0.1:8373:10000 martian-map:static
```

Its health check requests `/`. The old `/api/health`, `/api/routes` and `/api/return` endpoints are absent. The retained Python implementation is an offline test oracle, not a deployment dependency.

## Hosting handoff — FR-029

Publish the reviewed `dist/` directory using Cloudflare static hosting or an equivalent provider. No runtime application code, database, secret, API proxy or VPS is required. The existing `render.yaml` is an optional legacy container-host configuration, not the selected hosting direction.

Before publication, verify the final build's asset limits, MIME types and caching. Avoid an HTML fallback for missing worker/binary files. Preserve direct `?demo=yellowknife` and `?demo=boxwork` links and all local datasets/Cesium runtime assets. Verify actual tiles in the deployed browser; an accessible capabilities page alone does not establish usable coverage.

Acceptance at the real public URL must include both Gale sites, route comparison, return estimates, POV walking, field save/reload/export, Jezero capability limits and upstream-layer failure recovery. Test on the intended laptop with hardware acceleration. Software-rendered browser checks establish functionality, not acceptable POV frame rates. Records belong to each browser origin; export/import is needed to move records between hostnames.

For an isolated hardware-accelerated acceptance run, build to a separate directory and use separate test outputs/ports. Omit `TEST_HARDWARE=1` for the slower SwiftShader functional path; this does not establish acceptable POV performance:

```bash
npm run build -- --outDir tmp/fr028/dist
STATIC_DIR="$PWD/tmp/fr028/dist" TEST_PORT=8388 TEST_HARDWARE=1 TMPDIR="$PWD/tmp" PLAYWRIGHT_BROWSERS_PATH="$PWD/tmp/browser" npm run test:browser -- --output tmp/fr028/browser-results
```

## Reproduce the video

With the production server running and Playwright Chromium installed:

```bash
TMPDIR="$PWD/tmp" PLAYWRIGHT_BROWSERS_PATH="$PWD/tmp/browser" DEMO_URL=http://127.0.0.1:8373 npm run record:demo
```

`ffmpeg` must be installed. The script records the actual application and concatenates seven four-second chapters into `docs/evidence/demo-walkthrough.mp4`. Slow network/loading intervals are omitted; the walking segment labels its 20× simulation pace. Raw video and timing evidence remain under ignored `tmp/demo-video/`. The output is a technical walkthrough with English captions, not a claim about real astronaut localization or operational safety.

Upload the final recording to publicly accessible hosting and verify it in a private window. A local file path is not a public demo link. Confirm team/title details before submission and regenerate against the final deployed release if it differs from the local build.

## Submission requirements checked on 13 November 2026

Sources: [official project submission guide](https://www.spaceappschallenge.org/resources/project-submission-guide/), [team formation guide](https://www.spaceappschallenge.org/resources/team-formation-guide/), and [2026 event page](https://www.spaceappschallenge.org/2026/). Public pages were retrieved directly because the web extractor could not read them; the local certificate-chain issue required bypassing certificate verification for those public page reads.

- Submission opens November 14 at 09:00 and closes November 15 at 23:59 in the event's local time. For the Universal Event, use the **Team Owner's area of residence**. The owner/timezone has not been established; do not silently substitute Europe/Stockholm. If the owner is in Stockholm, the closing instant is November 15 at 22:59 UTC.
- The demo must be a video of **30 seconds or less**, or a presentation of no more than seven slides including title/introduction slides. The 28-second technical recording fits the duration limit.
- Complete the required project fields in English and explain the NASA/partner data, tools and references. Public project and demo links must work without login, permission or registration. The draft is in [submission.md](submission.md).
- Saving progress is not submission. The team must select **Submit for Judging** before the applicable deadline and verify the confirmation banner. Nothing has been submitted by this implementation.
- The team formation guide says project work should not begin before November 14 at 09:00. This prototype and implementation predate that window. Keep the true history, clarify eligibility with the organizers, and do not assert that all work was created during the weekend. No original-work or eligibility checkbox has been accepted here.

## Remaining external steps

FR-029: hosting account setup, static-site publication and public-URL verification. Public video hosting, confirmation of the Team Owner/timezone and eligibility, and final project submission also remain external steps. Select the reviewed release snapshot explicitly; do not rely on an old branch name. No credentials or private correspondence belong in this repository.

## Observed upstream CTX failure

During local browser verification, CTX tile `/1/1/3` (level/row/column) returned HTTP 500 without a CORS header; nearby detailed Gale tiles returned actual images. This is a source-service error, not evidence of complete CTX availability. The app retries each tile twice, then reports the failure. MOLA selection and local Gale overlays remain available. Browser checks verify successful CTX responses, visible failure reporting where applicable, and recovery to MOLA; they do not certify every upstream tile. Probe evidence is retained locally under ignored `tmp/ctx-gale-probe.json`.
