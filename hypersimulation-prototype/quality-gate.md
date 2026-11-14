# Marswalk - quality gate record

AI-written (Claude, Anthropic) for the team's NASA Space Apps 2026 project.

Record for `spec.md` section 8, one entry per line. State on 2026-11-14 at commit 3a4fee6a of branch `hackathon/nasa-marswalk-app`.

How the evidence was made:
- Tests: `cd app && node --test tests/` gives 335 tests, 335 pass, 0 fail.
- Check scripts: `python3 -I tools/check_readme.py --final`, `python3 -I tools/check_offline.py`, `python3 -I tools/check_copy.py` all pass.
- Browser: the app served from this commit by `tools/dev_server.py` on localhost, Chromium (the Claude desktop Browser pane), at 1366 x 768, 1920 x 1080 and 390 x 844. `audit()` is the app's own check `window.__marswalk.audit()`; an empty result means every number on screen has its unit and its origin label data, and the label shows where it must.
- Review: one independent premortem review of the story shell (1 high, 3 medium, 15 low findings). All are fixed in commit 3a4fee6a, except the one named under Polish 7.
- Not re-run on this date: the unit tests of the data scripts (66 pass at commit 53e045eb; the data scripts did not change since).

Status words: PASS (evidence here), TEAM STEP (only the team can do it), NOT AS WRITTEN (the line cannot be run as written; a replacement check is named).

## Product

| # | Line | Status | Evidence |
|---|---|---|---|
| P1 | A public link opens the app with no login; tested in a private window in Chrome and Firefox | TEAM STEP | No public link exists (team decision: the work stays local until the team publishes). The app is static, has no login and asks no other host for data (Polish 2). It starts with site storage blocked (test "chooseInputs: with site storage blocked (reading localStorage throws) the app starts on the committed inputs", `tests/inputs.test.js`). |
| P2 | All built demo story steps work in one run without a reload | PASS | Browser at 1920 x 1080: load with no option gives step 1; Enter pressed four times gives steps 2, 3, 4, 5 with no other input; step 3 is the eye-height view and plays; step 5 holds no return path and no held alert; no console message. Tests in `tests/story.test.js` and `tests/plan-ui.test.js` cover the same run, Back from each step, and a late return plan. |
| P3 | The planner returns a route through all stations, out of every no-go zone, inside 2 km of the rover, or says "no route" and names the blocking limit | PASS | `tests/planner.test.js` ("no path cell lies in a no-go polygon", "a station 2,100 m from base: rover_range", "a closed wall: no route, limit slope_cap, station named"); `tests/controller.test.js` no-route tests. Real inputs: route found, 1,677 m, 8 stations. |
| P4 | Every number has a unit and an origin (source with sol, "assumption", or "scenario"); the label shows with "Show sources" on and always in Details; one automated check proves it | PASS | `audit()` empty in the browser in steps 1 to 5, with sources off and on, at 1366 x 768 and 390 x 844, and in steps 1, 3 and 5 at 1920 x 1080. `tests/provenance.test.js` "audit (a)" to "audit (e)". Stated exemption: the task text of a station is the team's own wording and carries no origin label (`app/DESIGN.md`, number pattern). |
| P5 | The README lists every source with licence and credit, the assumptions table, the project licence and the AI use; its layer count equals the working layer count | PASS, one TEAM STEP | `check_readme.py --final` passes. The fuller AI-use statement is a team step (checklist section 4): the ready sentences are in the final report to the team lead. |
| P6 | `submission-checklist.md` passes, apart from the steps only the team can do | TEAM STEP | Sections 5, 6 and 7 (demo, links, form, declaration boxes) and the AI-use line of section 4 are team steps. Sections 2 and 3 are covered in the README by `check_readme.py --final`. |

## Polish

| # | Line | Status | Evidence |
|---|---|---|---|
| 1 | First usable view within 3 seconds on a 10 Mbit/s line, with a progress state while the terrain loads | TEAM STEP | Progress state: `ui/progress.js`, `tests/startup.test.js`. Earlier measurement in this project: the first view needs about 0.9 MB, which is under 1 second at 10 Mbit/s by arithmetic. Measured now: all files for full detail are about 10 MB without compression (80 files), loaded in the background after the first view. Not measured on a real 10 Mbit/s line. |
| 2 | With trek.nasa.gov, the PDS sites and DONKI blocked, every screen still works | PASS | The app asks no other host: in a full five-step run the browser's resource list holds one host only, the app's own. `check_offline.py` passes (no outside URL is requested at run time; outside links exist only as plain links in Credits). |
| 3 | 30 frames per second or more on a 2020 laptop with built-in graphics; with no 3D support the 2D view loads | TEAM STEP | No 2020 laptop here. On the build Mac the 3D scene ran at 120 frames per second. The 2D fallback loads when 3D is missing, fails or is slow (`tests/main.test.js` "speed check"). Note: the app switches to 2D under 24 frames per second, not under 30. |
| 4 | The rover waypoints sit on the visible tracks within 2 m | NOT AS WRITTEN | The orbit image is older than the 2025 drive and shows no tracks. Replacement check in `data-checks/alignment.md`: the waypoints match the terrain grid within 3 mm, and the height spread between the path file and the terrain is 0.107 m. The two files may share one source, so this is a weak check. |
| 5 | Every layer has a legend with units and an on-screen credit | PASS | `tests/layers.test.js` ("layers.json has the 11 layer ids of the app, each with a credit line except stations"); the legend is in Details, tab Limits; the image credit line is on the scene's bottom edge in each plan step; the full rows are in Details, tab Credits. |
| 6 | Empty, loading, error and "no route" each have a designed screen; no console errors in a full run | PASS | Screens: `ui/progress.js`, `ui/error.js`, `ui/no-route.js`, the caption states in `story.js`. No console message in the full runs at the three sizes. |
| 7 | The full demo story runs by keyboard only and by touch only, with visible focus | PASS, one limit | Keyboard: the run of P2 used the Enter key only. Touch: every story control is 44 px or more at 390 x 844 (measured: walk bar buttons 44 x 48 or more; the step dots have a 36 px box with a 44 px touch area). Limit: on touch the map moves by drag only; no pan buttons were added, to keep the screen clear. The story itself needs no map movement. |
| 8 | The layout works at 1366 x 768, 1920 x 1080 and 390 x 844 with no overlap and no sideways scroll | PASS | No sideways scroll in steps 1 to 5 at 1366 x 768 and 390 x 844, and in steps 1, 3 and 5 at 1920 x 1080. Next is inside the screen in each case. Helmet blocks do not overlap at 390 x 844 in steps 3 and 4 with sources on (measured after the fix in commit 3a4fee6a) and off (seen). |
| 9 | One type family, one size scale, one colour set on all screens; no default browser controls and no default library markers | PASS | The browser reports one font family for all visible elements (B612) and no native form control. Story text is 14 px or more outside Details. Colours and sizes come from `src/styles/tokens.css`. |
| 10 | Every screenshot in the demo can be made again from the public link | TEAM STEP | Each step has its own address (`?step=1` to `?step=5`, plus `?sources=1`), and the address follows the step. Step 1 turns slowly, so its angle differs between two captures. Needs the public link. |

## Steps only the team can do

- Publish the app and test the public link in a private window in Chrome and in Firefox (P1, Polish 10).
- Test the frame rate on a 2020 laptop with built-in graphics (Polish 3) and the first view on a slow line (Polish 1).
- Add the AI-use statement to the README and to the form field "Use of Super Intelligence (SI)" (P5).
- Record the demo (30 seconds of video or 7 slides), fill the form, tick the two declaration boxes, submit (P6).
- Decide when the repository goes public.
- Sign the science goal line at the top of `spec.md`.
