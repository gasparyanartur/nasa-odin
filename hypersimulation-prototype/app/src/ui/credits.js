// AI-written (Claude, Anthropic) for the team's NASA Space Apps 2026 project.
// Credits panel (#panel-credits): one row per app/sources.json entry, the data and code licences, the font, and the
// simulation statement. These are the only links in the app; they open the source page and are never fetched.
import { whenPanel } from "../layers.js";
import { SOURCE_CODES } from "../provenance.js";

export const DATA_LICENCE = "Derived image, terrain and slope files: CC BY-SA 3.0 IGO (both USGS products contain HRSC data; credit Calef III and Parker / USGS and ESA/DLR/FU Berlin).";
export const CODE_LICENCE = "Code: Apache-2.0.";
export const SIM_STATEMENT = "The helmet display is a simulation. Designed against named NASA human-systems rules; not tested with astronauts.";

export function creditRows(sources) {
  return (Array.isArray(sources) ? sources : []).map((s) => ({
    id: s.id,
    title: s.title || s.id,
    provider: s.provider || "",
    licence: s.licence || "",
    credit: s.credit || "",
    url: typeof s.page === "string" && s.page ? s.page : typeof s.url === "string" ? s.url : "",
  }));
}

export function fontLine(sources) {
  const f = (Array.isArray(sources) ? sources : []).find((s) => s.id === "font");
  return f ? `Type: ${f.title}. ${f.licence}.` : "Type: B612, SIL Open Font License 1.1.";
}

function el(doc, tag, attrs = {}, ...kids) {
  const e = doc.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue;
    e.setAttribute(k, v === true ? "" : String(v));
  }
  for (const k of kids) if (k !== null && k !== undefined) e.append(typeof k === "string" ? doc.createTextNode(k) : k);
  return e;
}

const safeUrl = (u) => (/^https:\/\//.test(u) ? u : null);

export function mount(ctx) {
  const doc = globalThis.document;
  if (!doc) return () => {};
  const sources = (ctx.data && ctx.data.sources) || [];
  let plate = null;
  const stop = whenPanel(doc, "panel-credits", (panel) => {
    if (panel.querySelector('[data-owner="credits"]')) return;
    plate = el(doc, "section", { class: "plate credits-panel", "data-owner": "credits", "aria-labelledby": "credits-h", "data-nonmetric": true },
      el(doc, "h2", { class: "plate__label", id: "credits-h" }, "Sources and credits"));
    const statement = el(doc, "div", { class: "banner credits-panel__sim" },
      el(doc, "span", { class: "banner__word" }, "Simulation"),
      el(doc, "span", { class: "banner__text" }, SIM_STATEMENT));
    const list = el(doc, "ol", { class: "credits-list" });
    for (const r of creditRows(sources)) {
      const url = safeUrl(r.url);
      // The row is the target of the short source codes in the minimums table (id credit-<source id>).
      const code = SOURCE_CODES[r.id];
      list.append(el(doc, "li", { class: "credits-list__row", id: `credit-${r.id}`, tabindex: "-1" },
        el(doc, "span", { class: "credits-list__title" }, code ? el(doc, "span", { class: "cite cite--key" }, code) : null, code ? " " : null, r.title),
        r.provider ? el(doc, "span", { class: "credits-list__line" }, r.provider) : null,
        r.credit ? el(doc, "span", { class: "credits-list__line" }, el(doc, "strong", {}, "Credit "), r.credit) : null,
        r.licence ? el(doc, "span", { class: "credits-list__line" }, el(doc, "strong", {}, "Licence "), r.licence) : null,
        url ? el(doc, "a", { class: "credits-list__link", href: url, rel: "noopener noreferrer", target: "_blank" }, "Source page", el(doc, "span", { class: "sr-only" }, ` for ${r.title} (opens a new tab)`)) : null));
    }
    plate.append(
      statement,
      el(doc, "div", { class: "credits credits-panel__licences" },
        el(doc, "span", {}, el(doc, "strong", {}, "Data licence "), DATA_LICENCE),
        el(doc, "span", {}, el(doc, "strong", {}, "Code licence "), CODE_LICENCE),
        el(doc, "span", {}, el(doc, "strong", {}, "Font "), fontLine(sources))),
      list,
    );
    panel.append(plate);
  });
  return () => {
    stop();
    if (plate) plate.remove();
  };
}
