// AI-written (Claude, Anthropic) for the team's NASA Space Apps 2026 project.
// The document is injectable so the logic runs in Node with a small hand-made fake.
// Markup follows the design pages: .num > .num__value, .num__unit, .num__prov (a ruled suffix cell).

export const PROVENANCE = ["measured", "source", "derived", "assumption", "scenario", "mock"];

// Short citation shown in the suffix of a "source" number. The full rows live in app/sources.json.
export const SOURCE_LABELS = {
  image_25cm: "USGS 25 cm mosaic",
  usgs_gale_colour_2025: "USGS colour mosaic 2025",
  dem_1m: "USGS 1 m terrain",
  hrsc: "ESA/DLR/FU Berlin HRSC",
  rems: "MSL REMS",
  rad: "MSL RAD",
  donki: "DONKI",
  msl_waypoints: "MSL waypoints",
  panorama: "PIA26559",
  boxwork_releases: "NASA releases",
  boxwork_blog: "NASA mission blog",
  drats_2022: "D-RATS 2022",
  nasa_std_3001_v2: "NASA-STD-3001 Vol 2 Rev C",
  nasa_std_3001_v1: "NASA-STD-3001 Vol 1",
  hassler_2014: "Hassler 2014",
  pena_asensio_2024: "Pena-Asensio 2024",
};

export function sourceLabel(id) {
  return SOURCE_LABELS[id] || String(id);
}

// Short citation codes for tight tables (the minimums); each resolves to its row in the Credits panel.
export const SOURCE_CODES = {
  pena_asensio_2024: "PA24",
  drats_2022: "DR22",
  nasa_std_3001_v2: "STD2",
  nasa_std_3001_v1: "STD1",
  hassler_2014: "HA14",
  rad: "RAD",
  rems: "REMS",
  dem_1m: "DEM",
  donki: "DONKI",
};

export function sourceCode(id) {
  return SOURCE_CODES[id] || String(id).slice(0, 4).toUpperCase();
}

const hasText = (v) => typeof v === "string" && v.trim() !== "";
const hasList = (v) => Array.isArray(v) && v.length > 0 && v.every(hasText);

function requireDetail(prov, d) {
  const need = (ok, what) => {
    if (!ok) throw new Error(`num(): provenance "${prov}" needs ${what}`);
  };
  if (!PROVENANCE.includes(prov)) throw new Error(`num(): unknown provenance "${prov}"`);
  if (prov === "measured") {
    need(Number.isFinite(d.sol), "detail.sol");
    need(Number.isFinite(d.lmst) || hasText(d.lmst), "detail.lmst");
    need(hasText(d.source), "detail.source (a source id)");
  } else if (prov === "source") {
    need(hasText(d.source), "detail.source (a source id)");
  } else if (prov === "derived") {
    need(hasText(d.method), "detail.method");
    need(hasList(d.sources), "detail.sources (a list of source ids)");
  }
}

export function lmstText(lmst) {
  if (typeof lmst === "string") return lmst;
  const total = Math.floor((((lmst % 24) + 24) % 24) * 60 + 1e-6);
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// The suffix text as the design pages show it.
function shortText(prov, d) {
  if (prov === "measured") return `sol ${d.sol}, ${lmstText(d.lmst)} LMST`;
  if (prov === "source") return hasText(d.label) ? d.label : sourceLabel(d.source);
  if (prov === "derived") return hasText(d.short) ? `derived: ${d.short}` : "derived";
  return prov;
}

// The whole provenance in words: what the suffix stands for.
export function provenanceText(prov, d = {}) {
  const extra = hasText(d.note) ? ` ${d.note}` : "";
  if (prov === "measured") return `Measured, sol ${d.sol}, ${lmstText(d.lmst)} LMST, ${sourceLabel(d.source)}.${extra}`;
  if (prov === "source") return `Source: ${hasText(d.label) ? `${d.label}, ` : ""}${sourceLabel(d.source)}.${extra}`;
  if (prov === "derived") return `Derived by us: ${d.method.trim().replace(/\.$/, "")}. From ${d.sources.map(sourceLabel).join(", ")}.${extra}`;
  if (prov === "assumption") return `Assumption${hasText(d.note) ? `: ${d.note}` : ", no source."}`;
  if (prov === "scenario") return `Scenario${hasText(d.note) ? `: ${d.note}` : ", replayed event."}`;
  return "Mock data, not Mars.";
}

// Thousands grouped with a comma, as on the design pages ("2,000 m"). Strings pass through untouched.
export function formatValue(value, detail = {}) {
  if (typeof value !== "number") return String(value);
  let s = Number.isInteger(detail.digits) ? value.toFixed(detail.digits) : String(value);
  if (detail.group === false) return s;
  const m = s.match(/^(-?)(\d+)(\.\d+)?$/);
  if (!m || m[2].length < 4) return s;
  return `${m[1]}${m[2].replace(/\B(?=(\d{3})+(?!\d))/g, ",")}${m[3] || ""}`;
}

function span(doc, cls, text) {
  const el = doc.createElement("span");
  el.setAttribute("class", cls);
  if (text !== undefined) el.textContent = text;
  return el;
}

// value: a number, a preformatted string, null (NO DATA), or a list of parts [{value, unit}] (see fmtDuration).
// unit "°" is joined to the value, as on the design pages; other units sit in their own cell.
// detail options (beside the provenance fields): count (true = a count with no unit; unit "" is allowed only with it),
// digits, group (false = no thousands comma), label and short (the words for "source" and "derived"), note (extra
// words in the full text), compact (the provenance word alone), suffix (false = no visible label, for a limit printed
// next to its own source line; marked data-prov-near).
// Every number carries its origin label in words (.num__prov): the source name, "derived", "assumption", "scenario";
// a measured value carries "measured" and its sol and local Mars time (.num__when). The screen shows the label when
// "Show sources" is on, always in the Details drawer and on the printed route card (app.css); the data is always here.
// Where the words leave out the method or a note, the label is a focusable note reference that shows the full text
// on focus and on hover, and carries it as aria-label and title.
export function num(value, unit, prov, detail = {}, doc = globalThis.document) {
  const d = detail || {};
  requireDetail(prov, d);
  const el = span(doc, "num");
  el.setAttribute("data-prov", prov);
  el.setAttribute("data-unit", unit ?? "");
  if (d.count === true) el.setAttribute("data-count", "1");
  const full = provenanceText(prov, d);
  const parts = Array.isArray(value) ? value : value === null || value === undefined ? null : [{ value, unit }];
  if (parts === null || parts.some((p) => p.value === null || p.value === undefined)) {
    el.setAttribute("data-nodata", "1");
    el.appendChild(span(doc, "num__value", "---"));
    el.appendChild(span(doc, "nodata", "NO DATA"));
  } else {
    for (const p of parts) {
      const shown = formatValue(p.value, d);
      if (p.unit === "°") el.appendChild(span(doc, "num__value", `${shown}°`));
      else {
        el.appendChild(span(doc, "num__value", shown));
        if (p.unit) el.appendChild(span(doc, "num__unit", p.unit));
      }
    }
  }
  if (d.suffix === false) {
    el.setAttribute("title", full);
    el.setAttribute("data-prov-near", "1");
    return el;
  }
  const noteRef = (prv) => {
    prv.setAttribute("tabindex", "0");
    prv.setAttribute("role", "note");
    prv.setAttribute("aria-label", full);
    prv.setAttribute("title", full);
    prv.setAttribute("data-detail", full);
  };
  let prv;
  if (prov === "measured" && !d.compact) {
    prv = span(doc, "num__prov num__prov--word num__prov--measured");
    prv.appendChild(span(doc, "num__prov-word", "measured"));
    prv.appendChild(span(doc, "num__when", shortText(prov, d)));
  } else prv = span(doc, "num__prov num__prov--word", d.compact ? prov : shortText(prov, d));
  prv.setAttribute("title", full);
  // The method of a derived value and any extra note are not in the visible words: they need the note reference.
  if (d.compact || prov === "derived" || hasText(d.note)) noteRef(prv);
  el.appendChild(prv);
  return el;
}

// Seconds as display parts: under a minute "58 s", under an hour "9 min 48 s", else "4 h 00 min".
export function fmtDuration(seconds) {
  if (!Number.isFinite(seconds)) return null;
  const neg = seconds < 0;
  const s = Math.round(Math.abs(seconds));
  const sign = neg ? "-" : "";
  if (s < 60) return [{ value: `${sign}${s}`, unit: "s" }];
  if (s < 3600) return [{ value: `${sign}${Math.floor(s / 60)}`, unit: "min" }, { value: String(s % 60).padStart(2, "0"), unit: "s" }];
  const mins = Math.round(s / 60);
  return [{ value: `${sign}${Math.floor(mins / 60)}`, unit: "h" }, { value: String(mins % 60).padStart(2, "0"), unit: "min" }];
}

// A compass bearing as three digits ("028"); pass unit "°" to num(). null for a missing bearing.
export function fmtBearing(deg) {
  if (!Number.isFinite(deg)) return null;
  const v = Math.round(((deg % 360) + 360) % 360) % 360;
  return String(v).padStart(3, "0");
}

// Returns [{text, reason}] for: a digit in text (HTML or SVG <text>) outside a num() / data-nonmetric element; a digit in
// aria-label, aria-valuetext, title or alt outside such an element; a num() element with no unit that is not a count
// (num(v, "", prov, {count: true}) renders data-count); a num() element without its provenance label (no .num__prov
// with words and title, and not a limit marked data-prov-near next to its own source line); mock provenance.
// view (in a browser): {isShown(el) -> bool, wantsLabel(numEl) -> true | false | null}. With it, a rendered number
// whose label must show (sources on, the drawer, the route card) but is hidden fails, and so does a label that shows
// where it must not (sources off outside the drawer); null means either is right.
const ATTRS = ["aria-label", "aria-valuetext", "title", "alt"];
export function audit(root, view = null) {
  const checkView = !!view && typeof view.isShown === "function" && typeof view.wantsLabel === "function";
  const out = [];
  const attr = (el, name) => (el.getAttribute ? el.getAttribute(name) : null);
  const childWith = (el, cls) => Array.from(el.childNodes || []).find((k) => k.nodeType === 1 && new RegExp(`(^|\\s)${cls}(\\s|$)`).test(attr(k, "class") || ""));
  const hasUnit = (el) => {
    if (hasText(attr(el, "data-unit"))) return true;
    return !!childWith(el, "num__unit");
  };
  const showsProv = (el) => {
    if (attr(el, "data-prov-near") !== null) return true;
    const p = childWith(el, "num__prov");
    return !!p && hasText(p.textContent || "") && hasText(attr(p, "title"));
  };
  const walk = (node, inside) => {
    if (node.nodeType === 3) {
      const text = node.nodeValue || "";
      if (!inside && /\d/.test(text)) out.push({ text: text.trim(), reason: "digit outside num() and data-nonmetric" });
      return;
    }
    if (node.nodeType !== 1) return;
    let ok = inside;
    if (attr(node, "data-nonmetric") !== null) ok = true;
    const prov = attr(node, "data-prov");
    if (prov !== null) {
      ok = true;
      if (prov === "mock") out.push({ text: (node.textContent || "").trim(), reason: "mock provenance is not allowed in a real run" });
      if (attr(node, "data-nodata") === null && attr(node, "data-count") === null && !hasUnit(node)) {
        out.push({ text: (node.textContent || "").trim(), reason: "num() without a unit (pass detail.count for a count)" });
      }
      if (!showsProv(node)) out.push({ text: (node.textContent || "").trim(), reason: "num() without its provenance label" });
      else if (checkView && attr(node, "data-prov-near") === null && view.isShown(node)) {
        const want = view.wantsLabel(node);
        const shown = view.isShown(childWith(node, "num__prov"));
        if (want === true && !shown) out.push({ text: (node.textContent || "").trim(), reason: "provenance label hidden where it must show" });
        if (want === false && shown) out.push({ text: (node.textContent || "").trim(), reason: "provenance label shown with sources off" });
      }
    }
    if (!ok) {
      for (const a of ATTRS) {
        const v = attr(node, a);
        if (typeof v === "string" && /\d/.test(v)) out.push({ text: v.trim(), reason: `digit in ${a} outside num() and data-nonmetric` });
      }
    }
    const kids = node.childNodes || [];
    for (let i = 0; i < kids.length; i++) walk(kids[i], ok);
  };
  walk(root, false);
  return out;
}
