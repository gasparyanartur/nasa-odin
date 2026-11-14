// AI-written (Claude, Anthropic) for the team's NASA Space Apps 2026 project.
// How the scene is shown: the image credit line on the scene's bottom edge, the MOCK DATA banner, and the "View"
// plate at the top of the Layers tab with the vertical scale (True / 2x). The image mode (Colour / Grey) sits in the
// Image row of the same tab (layer-panel.js).
export const IMAGE_LABELS = {
  colour: "HiRISE colour mosaic (USGS, July 2025) - band mix not stated by USGS; not a true-colour claim",
  grey: "Greyscale mosaic (USGS, 25 cm)",
};

export const CREDIT_SHORT = "USGS / NASA / ESA - see Credits";

export function creditText(mode) {
  return `Image: ${IMAGE_LABELS[mode] || IMAGE_LABELS.grey}. Terrain: USGS 1 m, ESA/DLR/FU Berlin HRSC.`;
}

function el(doc, tag, cls, ...kids) {
  const e = doc.createElement(tag);
  if (cls) e.setAttribute("class", cls);
  for (const k of kids) if (k !== null && k !== undefined) e.append(typeof k === "string" ? doc.createTextNode(k) : k);
  return e;
}

// A radio group drawn as the design's segmented control. Arrow keys move the choice; one tab stop.
export function segmented(doc, { label, aria, options, onPick }) {
  const group = el(doc, "div", "segmented");
  group.setAttribute("role", "radiogroup");
  group.setAttribute("aria-label", aria || label);
  if (label) group.appendChild(el(doc, "span", "segmented__label", label));
  const buttons = options.map((o) => {
    const b = el(doc, "button", "segmented__opt", o.text);
    b.setAttribute("type", "button");
    b.setAttribute("role", "radio");
    if (o.nonmetric) b.setAttribute("data-nonmetric", "");
    if (o.aria) b.setAttribute("aria-label", o.aria);
    b.addEventListener("click", () => onPick(o.value));
    b.addEventListener("keydown", (e) => {
      const i = options.indexOf(o);
      const step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
      if (!step) return;
      e.preventDefault();
      const next = options[(i + step + options.length) % options.length];
      onPick(next.value);
      buttons[options.indexOf(next)].focus();
    });
    group.appendChild(b);
    return b;
  });
  return {
    el: group,
    set(value, busy = false) {
      options.forEach((o, i) => {
        const on = o.value === value;
        buttons[i].setAttribute("aria-checked", on ? "true" : "false");
        buttons[i].setAttribute("tabindex", on ? "0" : "-1");
      });
      if (!options.some((o) => o.value === value)) buttons[0].setAttribute("tabindex", "0");
      if (busy) group.setAttribute("aria-busy", "true");
      else group.removeAttribute("aria-busy");
    },
  };
}

export function mount(ctx) {
  const labels = ctx.regions.labels;
  const doc = (labels && labels.ownerDocument) || globalThis.document;
  const { store, actions, host } = ctx;
  const frame = labels ? labels.parentNode : null;
  const app = frame ? frame.parentNode : null;

  // The image credit is one unboxed line on the scene's bottom edge; labels keep clear of it (data-label-avoid).
  // At 390 px the line is the short form; the Credits tab holds the full rows.
  const creditFull = el(doc, "span", "scene-credit__full", "");
  const creditShort = el(doc, "span", "scene-credit__short", CREDIT_SHORT);
  const credit = el(doc, "p", "scene-credit", creditFull, creditShort);
  credit.setAttribute("data-nonmetric", "");
  credit.setAttribute("data-label-avoid", "");
  credit.setAttribute("data-fit-avoid", "");
  if (frame) frame.append(credit);

  let banner = null;
  if (ctx.opts && ctx.opts.data === "mock" && app) {
    banner = el(doc, "div", "banner banner--mock banner--float",
      el(doc, "span", "banner__word", "Mock data"),
      el(doc, "span", "banner__text", "Synthetic scene, not Mars. Every value here is tagged mock."));
    banner.setAttribute("role", "note");
    app.appendChild(banner);
  }

  const vertical = segmented(doc, {
    label: "Vertical",
    aria: "Vertical scale",
    options: [
      { value: 1, text: "True", aria: "True vertical scale" },
      { value: 2, text: "2x", nonmetric: true, aria: "Vertical scale stretched two times" },
    ],
    onPick: (v) => actions.setExaggeration(v),
  });
  const drawer = ctx.regions.drawer || ctx.regions.dock;
  const panel = drawer && drawer.querySelector ? drawer.querySelector("#panel-layers") : null;
  const plate = el(doc, "section", "plate view-plate",
    el(doc, "h2", "plate__label", "View"),
    vertical.el,
    el(doc, "p", "plate__note", "Ridges of a metre or two look flat at true scale. The stretched view doubles the heights only."));
  if (panel) panel.insertBefore(plate, panel.firstChild);

  const render = (s) => {
    vertical.set(s.exaggeration === 2 ? 2 : 1);
    const modes = host && typeof host.imageryModes === "function" ? host.imageryModes() : [];
    const mode = (s.imagery && s.imagery.mode) || modes[0] || "colour";
    const ct = creditText(mode);
    if (creditFull.textContent !== ct) creditFull.textContent = ct;
  };
  render(store.getState());
  const off = store.subscribe(render);
  return () => {
    off();
    credit.remove();
    plate.remove();
    if (banner) banner.remove();
  };
}
