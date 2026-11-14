# Hypersimulation Prototype (Marswalk)

AI-written (Claude, Anthropic) for the team's NASA Space Apps 2026 project.

This folder holds one complete prototype and nothing else in the repository depends on it. It plans and replays one astronaut walk at the boxwork ridges in Gale crater on one 3D scene, as a guided story in five steps.

## Run it

No install and no build step. From this folder:

```bash
python3 -I tools/dev_server.py --port 8642
```

Then open http://127.0.0.1:8642/ in a browser. Press Enter four times to go through the five steps. `?step=1` to `?step=5` open one step; `?sources=1` shows the origin label of each number.

A plain `python3 -m http.server 8642 --bind 127.0.0.1 --directory app` works too.

## What is where

| Path | Content |
|---|---|
| `app/` | The web app: plain HTML, CSS and ES modules, three.js vendored. `app/README.md` lists every source, licence, credit and assumption. `app/DESIGN.md` and `app/PRODUCT.md` record the design. |
| `app/public/data/` | The data the app loads: image, terrain and slope cut from USGS files; Curiosity waypoints, REMS and RAD values for sol 4600; the DONKI event; the walk inputs. |
| `tools/` | The Python scripts that cut the data, the check scripts, the local server, and `tools/film/` (the recorder of the tour film). |
| `data-checks/` | Records of the data checks (alignment, chosen sol, cuts). |
| `spec.md` | The product spec. `quality-gate.md` holds the evidence for each line of its section 8. |
| `resource-catalogue.md`, `research/`, `challenge-brief.md` | The NASA resource research behind the prototype. |
| `submission-checklist.md` | The hand-in checklist, with the open team steps. |
| `build-plan.md` | The build plan the prototype followed. |

## Checks

```bash
cd app && node --test tests/
cd .. && python3 -I tools/check_readme.py --final && python3 -I tools/check_offline.py && python3 -I tools/check_copy.py
```

## Notes

- The raw NASA and USGS downloads (about 28 GB) are not in this folder. The data scripts read them from a folder on the build computer; their paths in `tools/` and in some records point there.
- The terrain and slope files derive from a product with HRSC data and carry CC BY-SA 3.0 IGO (credit ESA/DLR/FU Berlin). See `app/README.md` before any reuse.
- The tour film is not in the repository (the file is too large for GitHub). Its narration is AI-made audio.
