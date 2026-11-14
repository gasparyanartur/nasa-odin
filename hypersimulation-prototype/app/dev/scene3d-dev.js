// AI-written (Claude, Anthropic) for the team's NASA Space Apps 2026 project.
// Private scratch page for the orchestrator's browser check of src/scene3d.js. Not part of the app.
import { loadFirstView, loadTiles } from "../src/loader.js";
import { toUint16, toUint8 } from "../src/terrain.js";
import { createScene3d } from "../src/scene3d.js";
import { measureFps, FpsMeter } from "../src/perf.js";

const q = new URLSearchParams(location.search);
const base = q.get("data") === "real" ? "../public/data/" : "../public/data-mock/";
const lowDetail = q.get("low") === "1";
const statusEl = document.getElementById("status");
const bar = document.getElementById("bar");
const labelsEl = document.getElementById("labels");
const dev = { errors: [], ready: false, coreTiles: 0, lost: 0, fps: null, base, lowDetail };
window.__dev = dev;
addEventListener("error", (e) => dev.errors.push(String(e.message)));
addEventListener("unhandledrejection", (e) => dev.errors.push(JSON.stringify(e.reason)));

const status = (s) => {
  statusEl.textContent = s;
};

function button(label, fn) {
  const b = document.createElement("button");
  b.textContent = label;
  b.addEventListener("click", fn);
  bar.appendChild(b);
}

function slopeRaster(scene, slope) {
  const n = scene.core.slope_cells;
  const rgba = new Uint8Array(n * n * 4);
  const hatch = new Uint8Array(n * n);
  for (let k = 0; k < n * n; k++) {
    const v = slope[k];
    const deg = v === scene.slope.nodata ? null : v * scene.slope.scale_deg;
    const grey = deg === null ? 0 : deg < 10 ? 220 : deg <= 15 ? 169 : 107;
    rgba.set([grey, grey, grey, deg === null ? 0 : 255], k * 4);
    hatch[k] = deg === null ? 0 : deg > 15 ? 200 : deg >= 10 ? 1 : 0;
  }
  return { rgba, hatch, width: n, height: n, opacity: 0.55, hatch_color: "#14161a" };
}

async function main() {
  const first = await loadFirstView(base, (p) => status(`loading ${p.file} ${p.loaded}/${p.total}`), {
    sourcesPath: "../../sources.json",
  });
  const canvas = document.getElementById("c");
  const sc = createScene3d(canvas, first, { lowDetail, background: "#14161a" });
  window.__scene = sc;
  sc.onContextLost(() => {
    dev.lost++;
    status("WebGL context lost (onContextLost fired)");
  });

  const inputs = first.inputs;
  const stations = inputs.stations.map((s) => [s.x, s.y]);
  const route = [[inputs.base.x, inputs.base.y], ...stations, [inputs.base.x, inputs.base.y]];
  const path = (first.waypoints.waypoints || []).filter((w) => w.in_campaign).map((w) => [w.x, w.y]);
  sc.setOverlay("rover_path", { kind: "line", coords: path, style: { color: "#7fb4ff", casing: "#14161a", width_px: 3, layer: "rover_path" } });
  sc.setOverlay("route", { kind: "line", coords: route, style: { color: "#ff63b8", casing: "#14161a", width_px: 4 } });
  sc.setOverlay("stations", { kind: "points", coords: stations, style: { color: "#f4f1ea", casing: "#14161a", shape: "diamond", size_px: 18 } });
  for (const z of inputs.no_go || []) {
    sc.setOverlay(`no_go_${z.id}`, { kind: "polygon", coords: z.polygon, style: { color: "#f4f1ea", casing: "#14161a", pattern: "hatch-nogo", hatch_color: "#14161a", layer: "no_go" } });
  }
  if (!(inputs.no_go || []).length) {
    sc.setOverlay("no_go_demo", { kind: "polygon", coords: [[-150, 150], [-60, 150], [-60, 60], [-150, 60]], style: { pattern: "hatch-nogo", layer: "no_go" } });
  }

  const labels = inputs.stations.map((s) => {
    const el = document.createElement("div");
    el.className = "lbl";
    el.textContent = `Station ${s.id}`;
    labelsEl.appendChild(el);
    return { el, x: s.x, y: s.y };
  });
  const placeLabels = () => {
    for (const l of labels) {
      const p = sc.project(l.x, l.y);
      l.el.style.display = p.visible ? "block" : "none";
      l.el.style.left = `${p.sx}px`;
      l.el.style.top = `${p.sy}px`;
    }
  };
  sc.onChange(placeLabels);
  placeLabels();

  const meter = new FpsMeter();
  if (q.get("fps") === "1") sc.onRender((t) => meter.tick(t));

  canvas.addEventListener("dblclick", (e) => {
    const p = sc.pick(e.clientX, e.clientY);
    dev.lastPick = p;
    status(p ? `pick x ${p.x.toFixed(1)} m, y ${p.y.toFixed(1)} m` : "pick: none");
    if (p) sc.flyTo(p.x, p.y);
  });
  addEventListener("keydown", (e) => {
    if (sc.handleKey(e)) e.preventDefault();
  });

  let walkTimer = 0;
  const layers = { hillshade: false, slope: false, no_go: true, rover_path: true, image: true };
  const toggle = (id) => {
    layers[id] = !layers[id];
    sc.setLayer(id, layers[id]);
  };
  button("Plan", () => {
    cancelAnimationFrame(walkTimer);
    sc.setView("plan");
  });
  button("Walk route", () => {
    sc.setView("walk");
    const pts = route;
    let leg = 0;
    let t = 0;
    const step = () => {
      const a = pts[leg];
      const b = pts[leg + 1];
      if (!b) return;
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
      t += 1.5 / len;
      if (t >= 1) {
        leg++;
        t = 0;
      }
      const x = a[0] + (b[0] - a[0]) * t;
      const y = a[1] + (b[1] - a[1]) * t;
      const heading = (Math.atan2(b[0] - a[0], b[1] - a[1]) * 180) / Math.PI;
      sc.setEye({ x, y, heading_deg: heading });
      walkTimer = requestAnimationFrame(step);
    };
    step();
  });
  button("2x", () => sc.setExaggeration(sc.getCamera().exaggeration === 2 ? 1 : 2));
  button("Tilt (T)", () => sc.handleKey({ key: "T" }));
  button("Rotate 30", () => sc.rotateBy(30));
  button("North (0)", () => sc.resetNorth());
  button("Fit surround", () => sc.fitView("surround"));
  button("Fit core", () => sc.fitView("core"));
  button("Image", () => toggle("image"));
  button("Hillshade", () => toggle("hillshade"));
  button("Slope", () => toggle("slope"));
  button("No-go", () => toggle("no_go"));
  button("Rover path", () => toggle("rover_path"));
  button("Lose context", () => sc.loseContextForTest());
  button("Measure fps", async () => {
    sc.setContinuous(true);
    let k = 0;
    const spin = () => {
      if (k++ < 150) {
        sc.tiltBy(0.3);
        requestAnimationFrame(spin);
      }
    };
    spin();
    dev.fps = await measureFps(2000);
    sc.setContinuous(false);
    const st = sc.getStats();
    status(`fps ${dev.fps.toFixed(1)}, triangles ${st.triangles}, calls ${st.calls}`);
  });

  status("first paint (overview on surround mesh); loading core");
  await loadTiles(first.scene, base, (name, payload) => {
    sc.onTile(name, payload);
    if (name.startsWith("core_")) dev.coreTiles++;
    status(`core: ${name}`);
  }, { halfRes: lowDetail }).then((tiles) => {
    const s = first.scene;
    first.terrain.setCore(
      toUint16(tiles.dem_core, s.core.dem_samples ** 2, s.core.dem),
      toUint8(tiles.slope_core, s.core.slope_cells ** 2, s.core.slope),
    );
    sc.setRasterLayer("slope", slopeRaster(s, first.terrain.slope));
  });
  dev.ready = true;
  const st = sc.getStats();
  status(`ready. budget ${st.budget.total} triangles${lowDetail ? " (lowDetail)" : ""}. Double-click to pick.`);
  if (q.get("fps") === "1") setInterval(() => status(`fps ${meter.fps() === null ? "-" : meter.fps().toFixed(1)}`), 500);
}

main().catch((err) => {
  dev.errors.push(err && err.file ? `${err.file} ${err.status} ${err.reason}` : String(err && err.stack ? err.stack : err));
  status(`error: ${dev.errors[dev.errors.length - 1]}`);
});
