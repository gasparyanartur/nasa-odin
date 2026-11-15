# ODIN

**Offworld Discovery Intelligence Network** - a map for an astronaut's first walk on Mars.

NASA Space Apps 2026, challenge "Interplanetary Survival Guide: Martian Map". Team Clanker Lovers.

[![ODIN: a map for an astronaut's first walk on Mars. Three screens: Station, Tablet, Helmet.](docs/readme-hero.png)](https://gasparyanartur.github.io/nasa-odin/)

**Try it in the browser: https://gasparyanartur.github.io/nasa-odin/**

## What it does

ODIN turns NASA orbit images, terrain and rover measurements into one tool with three places.

- **Station**: a globe of Mars. You choose a region and a task, and look at planet-wide data such as geology, temperature, thorium and potassium.
- **Tablet**: a local map on a 25 cm orbit image. You set a destination and the app plans a route that keeps to a slope limit, the suit time and the no-go areas. If no safe route exists, the app says why and offers a fix.
- **Helmet**: a first-person view of the terrain with a compass, a round minimap, marked hazard areas and the next stop. A dust or solar particle scenario draws the way back to the habitat.

A guided tour on the real controls starts on the first visit.

## Run it locally

You need Node.js 22.17 or newer.

```bash
git clone https://github.com/gasparyanartur/nasa-odin.git
cd nasa-odin/odin
npm install
npm run dev
```

Then open http://localhost:5174. The app runs in the browser. It needs no account and no backend; only the planet-wide imagery loads from public map services.

How it works, the data sources and the known limits: [odin/README.md](odin/README.md).

## Repository layout

- `odin/`: the app (TypeScript, React, Vite, CesiumJS, three.js) with its data, tests and documents.
- `docs/`: the image for this page.
- `archive/`: earlier versions and working documents of the team, kept for reference and attribution. Nothing in it is needed to run ODIN. See [archive/README.md](archive/README.md).
- `.github/workflows/pages.yml`: builds `odin/` and publishes the live site on every push to `master`.

## Data and credits

All Mars imagery, terrain and measurements are real data from NASA, USGS, ESA and other agencies and keep their own terms. See [odin/public/boxwork/DATA-LICENSE.md](odin/public/boxwork/DATA-LICENSE.md) and the source list in [odin/README.md](odin/README.md). No endorsement by NASA or any agency is implied.

## AI use

Large parts of the code and documents were written with AI coding assistants (Claude by Anthropic, OpenAI Codex) under the team's direction. The app contains no AI-generated images.

## Licence

The code is licensed under the Apache License 2.0, see [LICENSE](LICENSE).
