// AI-written (Claude, Anthropic) for the team's NASA Space Apps 2026 project.
// The story chrome over the full-bleed scene (story.js has the steps): top left the name, top centre the stepper,
// top right Details and the "Show sources" switch; at the bottom one caption plate (headline, one or two sentences,
// at most four key numbers, Back and a large Next), or in the walk steps a slim bar outside the visor frame (play,
// speed, Back, Next). The plan step adds three quick layer chips and the small station card next to a picked tag;
// the last step ends with "Explore freely" and "Print the route card". Only the controls of the step on screen are
// in the page. After Next or Back the focus stays on Next; the controller announces each step in the status region.
import { num } from "../provenance.js";
import { STEPS, stepConfig, planFacts, stationCounts, stepLabel, clampStep } from "../story.js";
import { roverPanelModel } from "./rover-panel.js";
import { segmented } from "./display.js";
import { onNextFrame } from "../frame.js";
import { STEP_COUNT, SPEEDS } from "../state.js";

const SVG = "http://www.w3.org/2000/svg";
const CHIPS = [["slope", "Slope"], ["rover_path", "Rover path"], ["height", "Height"]];
const KEY_WORDS = { ridge: "ridge", hollow: "hollow", route: "route", nogo: "no-go zone", rover: "Curiosity path" };

function el(doc, tag, cls, ...kids) {
  const e = doc.createElement(tag);
  if (cls) e.setAttribute("class", cls);
  for (const k of kids) if (k !== null && k !== undefined && k !== false) e.append(typeof k === "string" ? doc.createTextNode(k) : k);
  return e;
}

function button(doc, cls, ...kids) {
  const b = el(doc, "button", cls, ...kids);
  b.setAttribute("type", "button");
  return b;
}

function icon(doc, paths, cls = "icon") {
  const s = doc.createElementNS(SVG, "svg");
  s.setAttribute("class", cls);
  s.setAttribute("viewBox", "0 0 24 24");
  s.setAttribute("aria-hidden", "true");
  for (const [c, d] of paths) {
    const p = doc.createElementNS(SVG, "path");
    if (c) p.setAttribute("class", c);
    p.setAttribute("d", d);
    s.appendChild(p);
  }
  return s;
}
const ARROW = [["", "M3 12h16M13 6l6 6-6 6"]];
const BACK = [["", "M21 12H5M11 6l-6 6 6 6"]];
const PLAY = [["icon__fill", "M7 4v16l13-8z"]];
const PAUSE = [["icon__fill", "M6 4h4v16H6zM14 4h4v16h-4z"]];

// One part of a caption line: words, a number spec (built with num()), or words that hold a date ({words}).
function part(doc, p) {
  if (typeof p === "string") return doc.createTextNode(p);
  if (p && typeof p.words === "string") {
    const s = el(doc, "span", "", p.words);
    s.setAttribute("data-nonmetric", "");
    return s;
  }
  if (p && "value" in p) return num(p.value, p.unit, p.prov, p.detail || {}, doc);
  if (p && p.nodata) {
    const s = el(doc, "span", "caption__nodata", el(doc, "span", "caption__nodata-dash", "---"), " ", el(doc, "span", "nodata", "NO DATA"));
    s.setAttribute("data-nonmetric", "");
    return s;
  }
  return doc.createTextNode("");
}

function keyItem(doc, id) {
  const sw = el(doc, "span", `caption-key__mark caption-key__mark--${id}`);
  sw.setAttribute("aria-hidden", "true");
  return el(doc, "span", "caption-key__item", sw, KEY_WORDS[id] || id);
}

// The facts the captions need beyond the plan: the rover check (once the terrain is in; it needs no route), the
// station counts and the event date.
export function factsFor(s, ctx, cache) {
  const data = ctx.data || {};
  const host = ctx.host;
  const plan = planFacts(s.plan);
  // Computed once, the first time the 1 m slope grid is in (undefined: not tried yet; null: no rover numbers).
  if (cache.rover === undefined && data.waypoints && ctx.terrain && ctx.terrain.slope) {
    try {
      const m = roverPanelModel(data.waypoints.waypoints, ctx.terrain);
      cache.rover = m && m.n > 0 ? { n: m.n, under_pct: m.slope_under_pct, median_deg: m.median_diff_deg } : null;
    } catch {
      cache.rover = null;
    }
  }
  return {
    renderer: s.renderer || (host ? host.kind : null),
    plan,
    stations: stationCounts(s.inputs),
    rover: cache.rover || null,
    sep_date: data.sep ? data.sep.eventTime || data.sep.sepID || null : null,
    core_m: data.scene && data.scene.core ? data.scene.core.size_m : null,
  };
}

export function mount(ctx) {
  const head = ctx.regions.head;
  const foot = ctx.regions.story;
  if (!head || !foot) return () => {};
  const doc = head.ownerDocument || globalThis.document;
  const { store, actions, host } = ctx;
  const app = head.parentNode;
  const labelsRoot = ctx.regions.labels;
  const cache = { rover: undefined };

  // ---- head: name, stepper, Details, Show sources
  const title = el(doc, "div", "story-title",
    el(doc, "p", "story-title__name", "Marswalk"),
    el(doc, "p", "story-title__place", "Gale crater - boxwork ridges"));
  const now = el(doc, "p", "story-steps__now", "");
  now.setAttribute("data-nonmetric", "");
  const list = el(doc, "ol", "story-steps__list");
  const stepButtons = STEPS.map((st) => {
    const b = button(doc, "story-step", el(doc, "span", "story-step__n", String(st.n)), el(doc, "span", "story-step__name", st.name));
    b.setAttribute("data-nonmetric", "");
    b.setAttribute("data-step", String(st.n));
    b.setAttribute("aria-label", `Step ${st.n} of ${STEP_COUNT}: ${st.name}`);
    b.addEventListener("click", () => {
      actions.gotoStep(st.n);
      b.focus();
    });
    list.append(el(doc, "li", "", b));
    return b;
  });
  const steps = el(doc, "nav", "story-steps", now, list);
  steps.setAttribute("aria-label", "Story steps");
  const details = button(doc, "btn story-details", "Details");
  details.setAttribute("id", "story-details");
  details.setAttribute("aria-controls", "drawer");
  details.addEventListener("click", () => {
    const open = !store.getState().drawer;
    actions.setDrawer(open);
    if (open) {
      const tab = doc.querySelector('.drawer [role="tab"][aria-selected="true"]');
      if (tab) tab.focus();
    }
  });
  const sources = button(doc, "story-switch", el(doc, "span", "story-switch__track"),
    el(doc, "span", "story-switch__word", el(doc, "span", "story-switch__show", "Show "), "sources"));
  sources.setAttribute("role", "switch");
  sources.setAttribute("aria-label", "Show sources");
  sources.addEventListener("click", () => actions.setSources(!store.getState().showSources));
  const tools = el(doc, "div", "story-tools", details, sources);
  for (const n of [title, steps, tools]) {
    n.setAttribute("data-fit-avoid", "");
    n.setAttribute("data-label-avoid", "");
  }
  head.replaceChildren(title, steps, tools);

  // ---- the two story buttons that keep the focus across steps
  const next = button(doc, "btn btn--primary story-next");
  next.setAttribute("id", "story-next");
  const back = button(doc, "btn story-back", icon(doc, BACK), el(doc, "span", "", "Back"));
  back.setAttribute("aria-label", "Back");
  const goNext = () => {
    if (next.getAttribute("aria-disabled") === "true") return;
    actions.nextStep();
    refocus();
  };
  next.addEventListener("click", goNext);
  // Enter on the focused Next button is Next once, even when the key event comes from a script.
  // A held key steps once: the repeats are dropped.
  next.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" || e.ctrlKey || e.metaKey || e.altKey) return;
    e.preventDefault();
    if (e.repeat) return;
    goNext();
  });
  back.addEventListener("click", () => {
    actions.prevStep();
    refocus();
  });
  back.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && e.repeat) e.preventDefault();
  });
  // The key cap shows the Right arrow key, which is Next too.
  const keyCap = () => {
    const k = el(doc, "span", "btn__key story-next__key", icon(doc, ARROW, "icon"));
    k.setAttribute("aria-hidden", "true");
    return k;
  };
  next.setAttribute("aria-keyshortcuts", "ArrowRight");
  const refocus = () => {
    const target = doc.getElementById("story-next");
    if (target && typeof target.focus === "function") target.focus({ preventScroll: true });
  };
  const inPage = (n) => (typeof n.isConnected === "boolean" ? n.isConnected : !!(doc.body && typeof doc.body.contains === "function" && doc.body.contains(n)));

  // ---- walk bar controls (built once, re-used in the walk and hazard steps)
  const play = button(doc, "btn walkbar__play");
  play.addEventListener("click", () => (store.getState().walk.playing ? actions.pause() : actions.play()));
  const speed = segmented(doc, {
    label: "Speed",
    aria: "Replay speed",
    options: SPEEDS.map((v) => ({ value: v, text: `${v}x`, nonmetric: true, aria: `Replay ${v} times faster` })),
    onPick: (v) => actions.setSpeed(v),
  });
  speed.el.classList.add("walkbar__speed");
  let playKey = null;
  const paintPlay = (w, enabled) => {
    const key = `${!!w.playing}|${enabled}`;
    if (key === playKey) return;
    playKey = key;
    play.replaceChildren(icon(doc, w.playing ? PAUSE : PLAY), el(doc, "span", "walkbar__word", w.playing ? "Pause" : "Play"));
    play.setAttribute("aria-pressed", w.playing ? "true" : "false");
    if (enabled) play.removeAttribute("aria-disabled");
    else play.setAttribute("aria-disabled", "true");
  };

  // ---- the end of the story
  const explore = button(doc, "btn btn--primary story-end__explore", "Explore freely");
  explore.addEventListener("click", () => actions.setExplore(true));
  const print = button(doc, "btn story-end__print", "Print the route card");
  print.addEventListener("click", () => {
    if (store.getState().plan.status === "ok") actions.showSheet("route-card");
  });
  const resume = button(doc, "btn btn--primary story-resume", "Back to the story");
  resume.addEventListener("click", () => {
    actions.setExplore(false);
    refocus();
  });

  // ---- caption and bars
  const chipButtons = new Map();
  const chipsLabel = el(doc, "span", "story-chips__label", "Show");
  chipsLabel.setAttribute("aria-hidden", "true");
  const chips = el(doc, "div", "story-chips", chipsLabel);
  chips.setAttribute("role", "group");
  chips.setAttribute("aria-label", "Show layers");
  for (const [id, label] of CHIPS) {
    const b = button(doc, "story-chip", el(doc, "span", "story-chip__box"), label);
    b.addEventListener("click", () => {
      const on = !(store.getState().layers || []).includes(id);
      // Height and Slope share the map: one raster layer shows at a time.
      if (on && id === "slope") actions.setLayer("height", false);
      if (on && id === "height") actions.setLayer("slope", false);
      actions.setLayer(id, on);
    });
    chips.append(b);
    chipButtons.set(id, b);
  }

  const linkFor = (l) => {
    const b = button(doc, "btn story-link", l.label);
    b.addEventListener("click", () => actions.setPanel(l.id));
    return b;
  };

  function buildCaption(cfg, withChips) {
    const c = cfg.caption;
    const box = el(doc, "section", "caption");
    box.setAttribute("aria-labelledby", "caption-h");
    const h = el(doc, "h2", "caption__headline", c.headline);
    h.setAttribute("id", "caption-h");
    const text = el(doc, "p", c.short ? "caption__text caption__text--long" : "caption__text", ...c.text.map((p) => part(doc, p)));
    box.append(h, text);
    // Narrow screens show the one short sentence instead (app.css).
    if (c.short) box.append(el(doc, "p", "caption__text caption__text--short", ...c.short.map((p) => part(doc, p))));
    if (c.numbers.length) {
      const dl = el(doc, "dl", "keynums");
      dl.style.setProperty("--n", String(c.numbers.length));
      for (const n of c.numbers) {
        const v = num(n.value, n.unit, n.prov, n.detail || {}, doc);
        v.classList.add("num--key");
        const item = el(doc, "div", "keynum", el(doc, "dt", "keynum__label", n.label), el(doc, "dd", "keynum__value", v));
        if (n.sub) item.append(el(doc, "dd", "keynum__sub", ...n.sub.map((p) => part(doc, p))));
        dl.append(item);
      }
      box.append(dl);
    }
    if (c.key.length) {
      const k = el(doc, "p", "caption-key", ...c.key.map((id) => keyItem(doc, id)));
      k.setAttribute("aria-label", `Map key: ${c.key.map((id) => KEY_WORDS[id]).join(", ")}`);
      box.append(k);
    }
    if (withChips) box.append(chips);
    const row = el(doc, "div", "caption__actions");
    if (c.back) row.append(back);
    for (const l of c.links) row.append(linkFor(l));
    row.append(el(doc, "span", "caption__gap"));
    resume.removeAttribute("id");
    if (c.end) {
      explore.setAttribute("id", "story-next");
      next.removeAttribute("id");
      row.append(print, explore);
    } else {
      explore.removeAttribute("id");
      next.setAttribute("id", "story-next");
      next.replaceChildren(el(doc, "span", "story-next__word", c.next_label), keyCap());
      row.append(next);
    }
    box.append(row);
    return box;
  }

  function buildBar(cfg) {
    const c = cfg.caption;
    const bar = el(doc, "section", "walkbar");
    bar.setAttribute("aria-label", "Walk controls");
    const label = el(doc, "span", "walkbar__step", stepLabel(cfg.step));
    label.setAttribute("data-nonmetric", "");
    const text = el(doc, "p", "walkbar__text", ...c.text.map((p) => part(doc, p)));
    explore.removeAttribute("id");
    resume.removeAttribute("id");
    next.setAttribute("id", "story-next");
    next.replaceChildren(el(doc, "span", "story-next__word", c.next_label), keyCap());
    bar.append(
      el(doc, "div", "walkbar__lead", label, text),
      el(doc, "div", "walkbar__controls", play, speed.el),
      el(doc, "div", "walkbar__nav", back, next),
    );
    return bar;
  }

  function buildExplore() {
    explore.removeAttribute("id");
    next.removeAttribute("id");
    resume.setAttribute("id", "story-next");
    const bar = el(doc, "section", "walkbar walkbar--explore");
    bar.setAttribute("aria-label", "Free view");
    bar.append(
      el(doc, "div", "walkbar__lead", el(doc, "span", "walkbar__step", "Free view"),
        el(doc, "p", "walkbar__text", "Move the map and open any tab in Details. The story waits.")),
      el(doc, "div", "walkbar__nav", resume),
    );
    return bar;
  }

  // ---- the small station card next to a picked tag (plan view)
  let pop = null;
  function closePop({ focusTag = false } = {}) {
    if (!pop) return;
    const id = pop.id;
    pop.node.remove();
    pop = null;
    if (focusTag && labelsRoot) {
      const tag = labelsRoot.querySelector(`[data-station="${id}"]`);
      if (tag && typeof tag.focus === "function") tag.focus({ preventScroll: true });
    }
  }
  function openPop(id, s) {
    const inputs = s.inputs;
    const st = inputs && Array.isArray(inputs.stations) ? inputs.stations.find((x) => x.id === id) : null;
    if (!st || !labelsRoot) return closePop();
    if (pop && pop.id === id) return;
    closePop();
    const kind = st.kind === "hollow" ? "Hollow" : "Ridge";
    const shape = el(doc, "span", `map-tag__shape map-tag__shape--${st.kind === "hollow" ? "hollow" : "ridge"}`);
    shape.setAttribute("aria-hidden", "true");
    const close = button(doc, "btn station-pop__close", "Close");
    close.setAttribute("aria-label", "Close the station card");
    close.addEventListener("click", () => {
      actions.pickStation(null);
      closePop({ focusTag: true });
    });
    const idText = el(doc, "span", "station-pop__id", `S${st.id}`);
    idText.setAttribute("data-nonmetric", "");
    const task = typeof st.task === "string" && st.task.trim() ? st.task.trim() : "No task is written for this station yet.";
    const taskP = el(doc, "p", "station-pop__task", task);
    taskP.setAttribute("data-nonmetric", "task text");
    const node = el(doc, "div", "station-pop",
      el(doc, "div", "station-pop__head", shape, idText, el(doc, "span", "station-pop__kind", kind), close),
      el(doc, "p", "station-pop__label", "Task"),
      taskP);
    node.setAttribute("role", "dialog");
    node.setAttribute("aria-label", `Station ${st.id}, ${kind}`);
    node.setAttribute("data-nonmetric", "station id");
    node.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopPropagation();
      actions.pickStation(null);
      closePop({ focusTag: true });
    });
    labelsRoot.appendChild(node);
    pop = { id, node, x: st.x, y: st.y };
    placePop();
    close.focus({ preventScroll: true });
  }
  function placePop() {
    if (!pop || !host || !labelsRoot) return;
    const p = host.project(pop.x, pop.y);
    const W = labelsRoot.clientWidth || 0;
    const H = labelsRoot.clientHeight || 0;
    const w = pop.node.offsetWidth || 260;
    const h = pop.node.offsetHeight || 140;
    const lr = typeof labelsRoot.getBoundingClientRect === "function" ? labelsRoot.getBoundingClientRect() : { top: 0, left: 0 };
    const headR = typeof head.getBoundingClientRect === "function" ? head.getBoundingClientRect() : { bottom: 0 };
    const footR = typeof foot.getBoundingClientRect === "function" ? foot.getBoundingClientRect() : { top: H };
    const top0 = Math.max(8, (headR.bottom || 0) - (lr.top || 0) + 8);
    const top1 = Math.min(H - 8, (footR.top || H) - (lr.top || 0) - 8);
    let x = p.sx + 22;
    if (x + w > W - 8) x = p.sx - 22 - w;
    x = Math.max(8, Math.min(W - w - 8, x));
    let y = p.sy - h / 2;
    // The caption plate only limits the card when the card would sit over it (wide screens dock it bottom left).
    const overFoot = footR.right === undefined || (x < footR.right - (lr.left || 0) && x + w > footR.left - (lr.left || 0));
    y = Math.max(top0, Math.min((overFoot ? top1 : H - 8) - h, y));
    pop.node.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
  }
  let popFrame = false;
  const schedulePop = () => {
    if (!pop || popFrame) return;
    popFrame = true;
    onNextFrame(() => {
      popFrame = false;
      placePop();
    });
  };

  // ---- render
  let built = null;
  const keyOf = (s, cfg) => JSON.stringify([s.step, s.explore, s.plan.status, s.plan.route ? s.plan.route.total_m : null, cfg.caption.numbers.map((n) => n.value), !!cache.rover, cfg.caption.headline]);
  function render(s) {
    const cfg = stepConfig(s.step, factsFor(s, ctx, cache));
    // head
    now.textContent = s.explore ? "Free view" : stepLabel(s.step);
    stepButtons.forEach((b, i) => {
      const on = i + 1 === clampStep(s.step) && !s.explore;
      if (on) b.setAttribute("aria-current", "step");
      else b.removeAttribute("aria-current");
      b.classList.toggle("story-step--done", i + 1 < s.step && !s.explore);
    });
    details.setAttribute("aria-expanded", s.drawer ? "true" : "false");
    sources.setAttribute("aria-checked", s.showSources ? "true" : "false");
    // foot
    const key = keyOf(s, cfg);
    if (key !== built) {
      const active = doc.activeElement;
      const hadFocus = !!active && (foot.contains(active) || active === doc.body || active === null);
      built = key;
      const bar = s.explore ? buildExplore() : cfg.caption.bar ? buildBar(cfg) : buildCaption(cfg, cfg.chips);
      // The plate itself (not the full-width foot) is what the route fit and the labels keep clear of.
      bar.setAttribute("data-fit-avoid", "");
      bar.setAttribute("data-label-avoid", "");
      foot.replaceChildren(bar);
      foot.setAttribute("data-kind", s.explore ? "explore" : cfg.caption.bar ? "bar" : "caption");
      // A control that is still in the page keeps the focus; Next takes it only when the focused one is gone.
      if (hadFocus && active !== doc.body && active !== null) {
        if (!inPage(active)) refocus();
        else if (doc.activeElement !== active && typeof active.focus === "function") active.focus({ preventScroll: true });
      }
    }
    // Next waits for the route from the plan step on.
    const waiting = s.step >= 2 && s.plan.status !== "ok";
    if (waiting) next.setAttribute("aria-disabled", "true");
    else next.removeAttribute("aria-disabled");
    if (s.plan.status !== "ok") print.setAttribute("aria-disabled", "true");
    else print.removeAttribute("aria-disabled");
    for (const [id, b] of chipButtons) b.setAttribute("aria-pressed", (s.layers || []).includes(id) ? "true" : "false");
    if (cfg.caption.bar) {
      paintPlay(s.walk, s.plan.status === "ok" && !s.walk.pending);
      speed.set(s.walk.speed);
    }
    // station card
    if (s.picked !== null && s.view === "plan") openPop(s.picked, s);
    else if (pop) closePop();
    // sizes of the chrome for the CSS (drawer, helmet layer, map controls)
    measure();
  }

  let measured = "";
  function measure() {
    if (!app || !app.style || typeof foot.getBoundingClientRect !== "function") return;
    const hr = head.getBoundingClientRect();
    const fr = foot.getBoundingClientRect();
    const winH = globalThis.innerHeight || 0;
    const footTop = winH && fr.height ? Math.max(0, winH - fr.top) : 0;
    const v = `${Math.round(hr.bottom || 0)}|${Math.round(fr.height || 0)}|${Math.round(footTop)}`;
    if (v === measured) return;
    measured = v;
    app.style.setProperty("--head-h", `${Math.round(hr.bottom || 0)}px`);
    app.style.setProperty("--foot-top", `${Math.round(footTop)}px`);
  }

  render(store.getState());
  const off = store.subscribe(render);
  const offHost = host && typeof host.onChange === "function" ? host.onChange(schedulePop) : null;
  const onResize = () => {
    measured = "";
    measure();
    schedulePop();
  };
  globalThis.addEventListener?.("resize", onResize);
  let ro = null;
  if (typeof globalThis.ResizeObserver === "function") {
    ro = new globalThis.ResizeObserver(() => {
      measured = "";
      measure();
    });
    ro.observe(foot);
    ro.observe(head);
  }
  return () => {
    off();
    if (typeof offHost === "function") offHost();
    globalThis.removeEventListener?.("resize", onResize);
    if (ro) ro.disconnect();
    closePop();
    head.replaceChildren();
    foot.replaceChildren();
  };
}
