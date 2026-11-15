# Demo deployment and release

Status: prepared locally; public hosting and final submission remain pending. The user does not yet have a Render account. No public URL or submitted project is claimed here.

## Run alongside the existing checkout

This branch is `codex/integrated-explore` in the separate managed workspace. The original checkout is unchanged. A baseline checkpoint was committed before implementation.

For development:

```bash
nvm use
API_PORT=8200 WEB_PORT=5273 npm run dev:all
```

For the container demo:

```bash
docker build -t martian-map:explore .
docker run --rm -p 127.0.0.1:8373:10000 martian-map:explore
```

Open <http://127.0.0.1:8373>. This uses separate ports from the original checkout. Prepared assets and the Python planner share the same origin. Global tiles and optional Google Fonts still use external services.

## Publish on Render

1. Create a [Render account](https://dashboard.render.com/), preferably using GitHub sign-in. Grant access to this repository.
2. Push the reviewed `codex/integrated-explore` branch to the repository; keep the original branch unchanged.
3. In Render, create a **Blueprint**, choose the repository and branch, and use `render.yaml`. Alternatively create a **Web Service**, select **Docker**, choose the **Free** instance, and set health check `/api/health`.
4. Deploy. The Dockerfile builds with Node 22.23.4, installs the Python runtime dependencies, and starts Uvicorn on `0.0.0.0:$PORT`. It serves `/`, `/assets`, `/cesium`, `/gale` and `/api` together. No separate static site, database, token or dataset download is needed.
5. In a fresh private browser, visit the assigned `https://…onrender.com` URL. Check both markers, MOLA/CTX selection, Gale overlays, route computation, manual walking and Jezero's capability explanation. Check `/api/health` and a Cesium worker response; confirm no localhost asset requests.
6. Wait at least 15 minutes without incoming traffic, then revisit and verify startup and route computation. Record the observed delay. Do not treat the local container check as this public idle-start check.

Render supports [Docker deployment](https://render.com/docs/docker). Its [Free web services](https://render.com/docs/free) sleep after 15 minutes without traffic and can take about one minute to resume. Choose Free; no paid service is assumed. A failed or slow public service must not be the sole demonstration artifact.

## Reproduce the video

With the production server running and Playwright Chromium installed:

```bash
TMPDIR="$PWD/tmp" PLAYWRIGHT_BROWSERS_PATH="$PWD/tmp/browser" DEMO_URL=http://127.0.0.1:8373 npm run record:demo
```

`ffmpeg` must be installed. The script records the actual application and concatenates seven four-second chapters into `docs/evidence/demo-walkthrough.mp4`. Slow network/loading intervals are omitted; the walking segment labels its 20× simulation pace. Raw video and timing evidence remain under ignored `tmp/demo-video/`. The output is a technical walkthrough with English captions, not a claim about real astronaut localization or operational safety.

Upload the final recording to publicly accessible hosting and verify it in a private window. A local file path is not a public demo link. Confirm team/title details before submission and regenerate against the final deployed release if it differs from the local image.

## Submission requirements checked on 13 November 2026

Sources: [official project submission guide](https://www.spaceappschallenge.org/resources/project-submission-guide/), [team formation guide](https://www.spaceappschallenge.org/resources/team-formation-guide/), and [2026 event page](https://www.spaceappschallenge.org/2026/). Public pages were retrieved directly because the web extractor could not read them; the local certificate-chain issue required bypassing certificate verification for those public page reads.

- Submission opens November 14 at 09:00 and closes November 15 at 23:59 in the event's local time. For the Universal Event, use the **Team Owner's area of residence**. The owner/timezone has not been established; do not silently substitute Europe/Stockholm. If the owner is in Stockholm, the closing instant is November 15 at 22:59 UTC.
- The demo must be a video of **30 seconds or less**, or a presentation of no more than seven slides including title/introduction slides. The 28-second technical recording fits the duration limit.
- Complete the required project fields in English and explain the NASA/partner data, tools and references. Public project and demo links must work without login, permission or registration. The draft is in [submission.md](submission.md).
- Saving progress is not submission. The team must select **Submit for Judging** before the applicable deadline and verify the confirmation banner. Nothing has been submitted by this implementation.
- The team formation guide says project work should not begin before November 14 at 09:00. This prototype and implementation predate that window. Keep the true history, clarify eligibility with the organizers, and do not assert that all work was created during the weekend. No original-work or eligibility checkbox has been accepted here.

## Remaining external steps

Render account setup, public deployment and idle-start verification, public video hosting, confirmation of the Team Owner/timezone and eligibility, and final project submission. The release branch must be available in the connected GitHub repository before Render can build it. No credentials or private correspondence belong in this repository.

## Observed upstream CTX failure

During local browser verification, CTX tile `/1/1/3` (level/row/column) returned HTTP 500 without a CORS header; nearby detailed Gale tiles returned actual images. This is a source-service error, not evidence of complete CTX availability. The app retries each tile twice, then reports the failure. MOLA selection and local Gale overlays remain available. Browser checks verify successful CTX responses, visible failure reporting where applicable, and recovery to MOLA; they do not certify every upstream tile. Probe evidence is retained locally under ignored `tmp/ctx-gale-probe.json`.
