// AI-written (Claude, Anthropic) for the team's NASA Space Apps 2026 project.
// The Timeline tab of the Details drawer (#panel-timeline): the height profile with station ticks, and the timeline
// score (blocks as wide as their duration, playhead, hazard start) that also works as a slider for the walk time.
import { num, fmtDuration } from "../provenance.js";
import { profilePath } from "../profile.js";

const SVG = "http://www.w3.org/2000/svg";
const PW = 1000;
const PH = 100;
const TIME_NOTE = "computed from the walking speed and the work time per station, both assumptions with no source";

// Pure: SVG geometry of the profile in a PW x PH box. null heights split the line and the ground.
export function profileShapes(profile, w = PW, h = PH) {
  if (!profile || !profile.points || profile.points.length < 2 || profile.max_m === null) return null;
  const p = profilePath(profile, { width: w, height: h, pad: 0 });
  const f = (v) => Math.round(v * 100) / 100;
  let ground = "";
  let run = [];
  const flush = () => {
    if (run.length > 1) ground += `M${run[0][0]} ${h}${run.map(([x, y]) => `L${x} ${y}`).join("")}L${run[run.length - 1][0]} ${h}Z`;
    run = [];
  };
  for (const pt of profile.points) {
    if (pt.h_m === null) flush();
    else run.push([f(p.x_of(pt.d_m)), f(p.y_of(pt.h_m))]);
  }
  flush();
  const drops = profile.stations.filter((s) => s.id !== "base").map((s) => f(p.x_of(s.d_m)));
  return { line: p.d, ground, drops };
}

// Pure: station ticks above the profile; ticks closer than minGap (share of the width) share one label.
export function profileTicks(profile, minGap = 0.05) {
  if (!profile || !(profile.total_m > 0)) return [];
  const ticks = [];
  for (const s of profile.stations) {
    if (s.id === "base") continue;
    const at = s.d_m / profile.total_m;
    const last = ticks[ticks.length - 1];
    if (last && at - last.first < minGap) last.ids.push(s.id);
    else ticks.push({ first: at, ids: [s.id] });
  }
  return ticks.map((t) => ({ at: Math.round(t.first * 10000) / 10000, label: t.ids.map((id) => `S${id}`).join(" ") }));
}

// Pure: "T+ 1:05" from seconds.
export function tPlus(t_s) {
  if (!Number.isFinite(t_s)) return null;
  const m = Math.floor(Math.max(0, t_s) / 60);
  return `T+ ${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}`;
}

export function sliderStep(key, shift) {
  if (key === "ArrowRight" || key === "ArrowUp") return shift ? 600 : 60;
  if (key === "ArrowLeft" || key === "ArrowDown") return shift ? -600 : -60;
  if (key === "PageUp") return 600;
  if (key === "PageDown") return -600;
  return 0;
}

function el(doc, tag, cls, ...kids) {
  const e = doc.createElement(tag);
  if (cls) e.setAttribute("class", cls);
  for (const k of kids) if (k !== null && k !== undefined) e.append(typeof k === "string" ? doc.createTextNode(k) : k);
  return e;
}

function svg(doc, tag, attrs = {}) {
  const e = doc.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  return e;
}

const OCTAGON = [["icon__shape", "M8 2h8l6 6v8l-6 6H8l-6-6V8z"], ["icon__bar", "M7 12h10"]];
function octagon(doc) {
  const s = svg(doc, "svg", { class: "icon icon--octagon", viewBox: "0 0 24 24", "aria-hidden": "true" });
  for (const [c, d] of OCTAGON) s.appendChild(svg(doc, "path", { class: c, d }));
  return s;
}

export function mount(ctx) {
  const drawer = ctx.regions.drawer || ctx.regions.dock;
  const panel = drawer.querySelector("#panel-timeline");
  if (!panel) return () => {};
  const doc = panel.ownerDocument || globalThis.document;
  const { store, actions } = ctx;
  const method = (m) => ({ method: m, sources: ["dem_1m"] });

  // ---- profile
  const reliefSlot = el(doc, "span", "plate__aside", "");
  const plot = el(doc, "div", "profile__plot");
  const range = el(doc, "span", "profile__range", "");
  const scaleNote = el(doc, "span", "profile__scale", "vertical exaggerated, not to scale - USGS 1 m terrain");
  scaleNote.setAttribute("data-nonmetric", "");
  const profilePlate = el(doc, "section", "plate timeline-plate",
    el(doc, "h2", "plate__label", "Height profile"), reliefSlot,
    el(doc, "div", "profile timeline-profile", plot),
    el(doc, "p", "timeline-axis", range, scaleNote));

  // ---- score
  const durSlot = el(doc, "span", "plate__aside", "");
  const score = el(doc, "div", "score timeline-score");
  const track = el(doc, "div", "score__track");
  const playhead = el(doc, "span", "score__playhead");
  playhead.setAttribute("aria-hidden", "true");
  const scorePlate = el(doc, "section", "plate timeline-plate",
    el(doc, "h2", "plate__label", "Timeline"), durSlot, score,
    el(doc, "p", "plate__note", "Magenta: walking. Paper: work at a station. Red: the way back. Click the timeline or use the arrow keys to move the walk time."));
  panel.append(profilePlate, scorePlate);

  const swap = (slot, node) => slot.replaceChildren(node);

  let seenProfile;
  const paintProfile = (plan) => {
    const shapes = profileShapes(plan.profile);
    if (!shapes) {
      plot.replaceChildren(el(doc, "div", "profile__empty", plan.status === "planning" ? "Planning the route" : "No route to draw"));
      swap(reliefSlot, el(doc, "span", "", "relief ", num(null, "m", "derived", method("highest minus lowest height along the route"), doc)));
      range.replaceChildren();
      return;
    }
    const s = svg(doc, "svg", { class: "profile__svg", viewBox: `0 0 ${PW} ${PH}`, preserveAspectRatio: "none", role: "img", "aria-label": "Height along the route, from the USGS terrain model" });
    s.appendChild(svg(doc, "path", { class: "profile__ground", d: shapes.ground }));
    for (const x of shapes.drops) s.appendChild(svg(doc, "line", { class: "profile__drop", x1: x, y1: PH, x2: x, y2: 0 }));
    s.appendChild(svg(doc, "path", { class: "profile__line-casing", d: shapes.line }));
    s.appendChild(svg(doc, "path", { class: "profile__line", d: shapes.line }));
    s.appendChild(svg(doc, "line", { class: "profile__base", x1: 0, y1: PH, x2: PW, y2: PH }));
    // The drawer column is narrow: stations closer than an eighth of the walk share one tick.
    const ticks = profileTicks(plan.profile, 0.12).map((t) => {
      const tk = el(doc, "span", "profile__tick", t.label);
      tk.setAttribute("data-nonmetric", "");
      tk.style.setProperty("--at", String(t.at));
      return tk;
    });
    plot.replaceChildren(s, ...ticks);
    const relief = plan.profile.max_m - plan.profile.min_m;
    swap(reliefSlot, el(doc, "span", "", "relief ", num(relief, "m", "derived", { ...method("highest minus lowest height along the route"), digits: 1 }, doc)));
    range.replaceChildren(
      "low ", num(plan.profile.min_m, "m", "derived", { ...method("lowest terrain height along the route"), digits: 1 }, doc),
      " - high ", num(plan.profile.max_m, "m", "derived", { ...method("highest terrain height along the route"), digits: 1 }, doc),
    );
  };

  let seenSchedule;
  const paintScore = (schedule, status) => {
    if (!schedule || !(schedule.duration_s > 0)) {
      score.replaceChildren(el(doc, "div", "score__empty", status === "planning" ? "Planning the route" : "No timeline without a route"));
      swap(durSlot, num(null, null, "assumption", { note: TIME_NOTE }, doc));
      return;
    }
    score.style.setProperty("--total", String(schedule.duration_s));
    const blocks = schedule.blocks.map((b) => {
      const blk = el(doc, "span", `score__block score__block--${b.kind}`, b.kind === "work" ? `S${b.station_id}` : "");
      blk.style.setProperty("--d", String(Math.max(0, b.t1 - b.t0)));
      if (b.kind === "work") blk.setAttribute("data-nonmetric", "");
      return blk;
    });
    const parts = [...blocks, playhead];
    const hs = schedule.hazard_start_s;
    if (Number.isFinite(hs)) {
      // The tag sits on one line above the track; past half of the walk it opens to the left of its flag.
      const late = hs >= schedule.duration_s;
      const flip = !late && hs / schedule.duration_s > 0.5;
      const hz = el(doc, "span", `score__hazard${late ? " score__hazard--late" : ""}${flip ? " score__hazard--flip" : ""}`);
      hz.style.setProperty("--t", String(Math.min(hs, schedule.duration_s)));
      hz.appendChild(el(doc, "span", "score__hazard-label", octagon(doc), "Return now ",
        num(hs / 60, "min", "assumption", { note: "hazard start time, an assumption", digits: 0 }, doc)));
      parts.push(hz);
    }
    track.replaceChildren(...parts);
    track.setAttribute("role", "slider");
    track.setAttribute("tabindex", "0");
    track.setAttribute("data-nonmetric", ""); // its value text is read aloud only; the sighted readout is a num()
    track.setAttribute("aria-label", "Walk timeline. Arrow keys move the time by one minute, with Shift by ten minutes.");
    track.setAttribute("aria-valuemin", "0");
    track.setAttribute("aria-valuemax", String(Math.round(schedule.duration_s)));
    score.replaceChildren(track);
    swap(durSlot, el(doc, "span", "", "walk ", num(fmtDuration(schedule.duration_s), null, "assumption", { note: TIME_NOTE }, doc)));
  };

  track.addEventListener("click", (e) => {
    const s = store.getState();
    const sch = s.walk.schedule || s.plan.schedule;
    if (!sch) return;
    const r = track.getBoundingClientRect();
    if (!(r.width > 0)) return;
    actions.seek(Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)) * sch.duration_s);
  });
  track.addEventListener("keydown", (e) => {
    const s = store.getState();
    const sch = s.walk.schedule || s.plan.schedule;
    if (!sch) return;
    let to = null;
    const step = sliderStep(e.key, e.shiftKey);
    if (step) to = s.walk.t_s + step;
    else if (e.key === "Home") to = 0;
    else if (e.key === "End") to = sch.duration_s;
    if (to === null) return;
    e.preventDefault();
    actions.seek(Math.min(sch.duration_s, Math.max(0, to)));
  });

  const render = (s) => {
    const plan = s.plan;
    const w = s.walk;
    if (plan.profile !== seenProfile || plan.status === "planning") {
      seenProfile = plan.profile;
      paintProfile(plan);
    }
    const schedule = w.schedule || plan.schedule;
    if (schedule !== seenSchedule || !schedule) {
      seenSchedule = schedule;
      paintScore(schedule, plan.status);
    }
    if (schedule) {
      playhead.style.setProperty("--t", String(Math.min(w.t_s, schedule.duration_s)));
      track.setAttribute("aria-valuenow", String(Math.round(w.t_s)));
      const parts = fmtDuration(w.t_s) || [];
      track.setAttribute("aria-valuetext", `T plus ${parts.map((p) => `${p.value} ${p.unit}`).join(" ")}`);
    }
  };
  render(store.getState());
  const off = store.subscribe(render);
  return () => {
    off();
    profilePlate.remove();
    scorePlate.remove();
  };
}
