// AI-written (Claude, Anthropic) for the team's NASA Space Apps 2026 project.
// The minimums table in #panel-limits (Details drawer): one limit per two lines, the legend below.
// Line one: the name, the limit and its body, the source as a short code that opens its row in the Credits panel.
// Line two: the margin (limit minus value), the bar, and the value it comes from. The state (icon plus word) spans
// both lines. Built from state.plan.constraints (constraints.js).
import { num, fmtDuration, sourceLabel, sourceCode } from "../provenance.js";
import { marginLevel } from "../hazard.js";
import { keepFocus } from "./focus.js";

const SVG = "http://www.w3.org/2000/svg";
const TIME_NOTE = "computed from the walking speed and the work time per station, both assumptions with no source";

const ROWS = {
  slope_cap: { name: "Slope cap", of: "steepest", unit: "°", digits: 1, limitDigits: 0 },
  rover_range: { name: "From crew rover", of: "farthest", unit: "m", digits: 0, limitDigits: 0 },
  partner_spacing: { name: "Partner spacing", of: "trail", unit: "m", digits: 0, limitDigits: 0 },
  suit_time: { name: "Time in suit", of: "walk", unit: "h", duration: true, limitDigits: 0 },
  walk_dose: { name: "Dose for the walk", of: "absorbed", unit: "mGy", digits: 3, info: true },
  career_dose: { name: "Dose, career", of: "walk", unit: "mSv", digits: 3, marginDigits: 1, limitDigits: 0 },
};
export const ROW_ORDER = ["slope_cap", "rover_range", "partner_spacing", "suit_time", "walk_dose", "career_dose"];

function valueProv(row) {
  if (row.id === "partner_spacing") return { prov: "assumption", detail: { note: "planned partner spacing, an assumption" } };
  if (row.id === "suit_time" || row.id === "career_dose") return { prov: "assumption", detail: { note: TIME_NOTE } };
  if (row.id === "walk_dose") return { prov: "assumption", detail: { note: `${TIME_NOTE}; rate ${row.rate_basis || "not known"}` } };
  return { prov: "derived", detail: { method: row.method || "computed from the planned route", sources: ["dem_1m"] } };
}

// Pure: the display model of each table row. state: "pass" | "caution" | "limit" | "fail" | "nodata", or "info" for
// the walk dose, which has no limit of its own (the career row holds the dose limit). cites: the source ids of the
// row as [{id, code, role}], resolved in the Credits panel.
export function minimumRows(constraints) {
  const byId = new Map((constraints || []).map((r) => [r.id, r]));
  return ROW_ORDER.filter((id) => byId.has(id)).map((id) => {
    const r = byId.get(id);
    const cfg = ROWS[id];
    const { prov, detail } = valueProv(r);
    const has = Number.isFinite(r.value);
    if (cfg.info) {
      return {
        id, name: cfg.name, of: cfg.of, where: null, state: "info", info: true, left: 0,
        body: `${r.body} - ${sourceLabel(r.source)}`,
        bodyShort: r.body,
        cites: [{ id: r.source, code: sourceCode(r.source), role: "rate" }],
        assumedBase: false,
        limit: null,
        value: { value: has ? r.value : null, unit: cfg.unit, prov, detail: { ...detail, digits: cfg.digits } },
        margin: null,
      };
    }
    const margin = has ? r.limit - r.value : null;
    // A margin that shows as zero at the table's precision, with the value inside the limit, reads "At limit".
    const step = cfg.duration ? 1 / 60 : 10 ** -(cfg.marginDigits ?? cfg.digits ?? 0);
    const atLimit = has && r.pass !== false && Math.abs(margin) < step / 2;
    const state = !has ? "nodata" : r.pass === false ? "fail" : atLimit ? "limit" : marginLevel(margin, r.limit) === "caution" ? "caution" : "pass";
    const left = has && r.limit > 0 ? Math.min(1, Math.max(0, margin / r.limit)) : 0;
    const toParts = (v) => (cfg.duration ? (Number.isFinite(v) ? fmtDuration(v * 3600) : null) : v);
    const body = id === "career_dose"
      ? `${r.limit_body || r.body} - ${sourceLabel(r.limit_source)} via OCHMO; rate ${sourceLabel(r.source)}`
      : `${r.body} - ${sourceLabel(r.limit_source || r.source)}`;
    const cites = id === "career_dose"
      ? [{ id: r.limit_source, code: sourceCode(r.limit_source), role: "limit, via OCHMO" }, { id: r.source, code: sourceCode(r.source), role: "rate" }]
      : [{ id: r.limit_source || r.source, code: sourceCode(r.limit_source || r.source), role: "limit" }];
    return {
      id,
      name: cfg.name,
      of: cfg.of,
      where: id === "slope_cap" && has && r.steepest_leg ? legText(r.steepest_leg) : null,
      state,
      left,
      body,
      bodyShort: id === "career_dose" ? r.limit_body || r.body : r.body,
      cites,
      assumedBase: prov === "derived" && r.assumption === true,
      limit: { value: r.limit, unit: cfg.unit, prov: "source", detail: { source: r.limit_source || r.source, digits: cfg.limitDigits, suffix: false } },
      value: { value: toParts(has ? r.value : null), unit: cfg.duration ? null : cfg.unit, prov, detail: { ...detail, digits: cfg.duration ? undefined : cfg.digits } },
      margin: { value: toParts(margin), unit: cfg.duration ? null : cfg.unit, prov, detail: { ...detail, digits: cfg.duration ? undefined : cfg.marginDigits ?? cfg.digits } },
    };
  });
}

const endName = (id) => (id === "base" ? "base" : `S${id}`);

// "steepest on leg S4 to S5" (or "base to S1").
export function legText(leg) {
  return `steepest on leg ${endName(leg.from)} to ${endName(leg.to)}`;
}

export function routeTotals(route) {
  if (!route || route.ok !== true) return { distance_m: null, climb_m: null };
  let climb = 0;
  let known = true;
  for (const l of route.legs) {
    if (Number.isFinite(l.climb_m)) climb += l.climb_m;
    else known = false;
  }
  return { distance_m: route.total_m, climb_m: known ? climb : null };
}

function el(doc, tag, cls, ...kids) {
  const e = doc.createElement(tag);
  if (cls) e.setAttribute("class", cls);
  for (const k of kids) if (k !== null && k !== undefined) e.append(typeof k === "string" ? doc.createTextNode(k) : k);
  return e;
}

function svgEl(doc, tag, attrs) {
  const e = doc.createElementNS ? doc.createElementNS(SVG, tag) : doc.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  return e;
}

export function stateIcon(doc, state) {
  const amber = state === "caution" || state === "limit";
  const icon = svgEl(doc, "svg", { class: amber ? "icon icon--triangle" : "icon", viewBox: "0 0 24 24", "aria-hidden": "true" });
  const paths = {
    limit: [["icon__shape", "M12 2.5 22.5 21h-21z"], ["icon__bar", "M12 9v6M12 17v2"]],
    pass: [["", "M4 4h16v16H4z"], ["", "m8 12 3 3 5-6"]],
    caution: [["icon__shape", "M12 2.5 22.5 21h-21z"], ["icon__bar", "M12 9v6M12 17v2"]],
    fail: [["", "M3 3h18v18H3z"], ["", "M8 8l8 8M16 8l-8 8"]],
    nodata: [["", "M4 12h4M10 12h4M16 12h4"]],
    info: [["", "M4 4h16v16H4z"], ["", "M12 10v7M12 7v1"]],
  }[state];
  for (const [c, d] of paths) icon.appendChild(svgEl(doc, "path", c ? { class: c, d } : { d }));
  return icon;
}

const WORDS = { pass: "Pass", caution: "Caution", limit: "At limit", fail: "Fail", nodata: "No data", info: "No limit" };

// A source code ("DR22") that opens the Credits panel at its row.
export function citeButton(doc, c, actions) {
  const b = el(doc, "button", "cite", c.code);
  b.setAttribute("type", "button");
  b.setAttribute("data-nonmetric", "");
  b.setAttribute("data-source", c.id);
  const label = `Source of the ${c.role}: ${sourceLabel(c.id)}. Opens its row in Credits.`;
  b.setAttribute("aria-label", label);
  b.setAttribute("title", label);
  b.addEventListener("click", () => {
    if (actions && typeof actions.setPanel === "function") actions.setPanel("credits");
    const row = doc.getElementById ? doc.getElementById(`credit-${c.id}`) : null;
    if (row) {
      if (typeof row.scrollIntoView === "function") row.scrollIntoView({ block: "nearest" });
      if (typeof row.focus === "function") row.focus({ preventScroll: true });
    }
  });
  return b;
}

export function stateCell(doc, state) {
  const cls = state === "caution" || state === "limit" ? "state state--caution state--held" : `state state--${state}`;
  return el(doc, "span", cls, stateIcon(doc, state), WORDS[state]);
}

const n = (doc, spec) => num(spec.value, spec.unit, spec.prov, spec.detail, doc);

export function mount(ctx) {
  const panel = (ctx.regions.drawer || ctx.regions.dock).querySelector("#panel-limits");
  const doc = panel.ownerDocument || globalThis.document;
  const { store, actions } = ctx;
  const host = el(doc, "div", "minimums-host");
  // Above the map key that the drawer keeps at the foot of this tab.
  const legend = typeof panel.querySelector === "function" ? panel.querySelector(".map-key-plate") : null;
  if (legend) panel.insertBefore(host, legend);
  else panel.appendChild(host);

  let seen = null;
  const render = (s) => {
    const key = [s.plan.constraints, s.plan.route, s.plan.status];
    if (seen && key.every((k, i) => k === seen[i])) return;
    seen = key;
    const rows = minimumRows(s.plan.constraints);
    const plate = el(doc, "div", "plate plate--flush");
    plate.append(el(doc, "h2", "plate__label", "Minimums"), el(doc, "span", "plate__aside", "margin = limit - value"));
    const table = el(doc, "table", "minimums minimums--tight");
    const cols = el(doc, "colgroup", "", el(doc, "col", "minimums__col-limit"), el(doc, "col", "minimums__col-state"));
    const head = el(doc, "thead", "sr-only", el(doc, "tr", "", ...["Limit", "State"].map((t) => {
      const th = el(doc, "th", "", t);
      th.setAttribute("scope", "col");
      return th;
    })));
    const body = el(doc, "tbody", "");
    for (const r of rows) {
      const flag = r.state === "pass" || r.state === "info" ? null : r.state === "limit" ? "caution" : r.state;
      const line1 = el(doc, "tr", "minimums__r1");
      const line2 = el(doc, "tr", "minimums__r2");
      if (flag) {
        line1.setAttribute("data-state", flag);
        line2.setAttribute("data-state", flag);
      }
      const bodyText = el(doc, "span", "minimums__body", r.bodyShort);
      bodyText.setAttribute("data-nonmetric", "");
      const cites = r.cites.map((c) => citeButton(doc, c, actions));
      const th = el(doc, "th", "minimums__limit",
        el(doc, "span", "minimums__name", r.name), " ",
        r.limit ? n(doc, r.limit) : null, r.limit ? " " : null,
        bodyText, ...cites, r.assumedBase ? " " : null, r.assumedBase ? el(doc, "span", "minimums__tag", "base") : null);
      th.setAttribute("scope", "row");
      const stateTd = el(doc, "td", "minimums__state", stateCell(doc, r.state));
      stateTd.setAttribute("rowspan", "2");
      line1.append(th, stateTd);

      const parts = [];
      if (r.margin) {
        parts.push(el(doc, "span", "minimums__marginval", n(doc, r.margin)));
        const bar = el(doc, "span", "margin-bar");
        bar.style.setProperty("--left", String(r.left));
        if (r.state === "caution" || r.state === "limit" || r.state === "fail") bar.setAttribute("data-state", "caution");
        bar.setAttribute("aria-hidden", "true");
        parts.push(bar);
      }
      parts.push(el(doc, "span", "minimums__of", `${r.of} `, n(doc, r.value)));
      if (r.where) {
        const where = el(doc, "span", "minimums__of minimums__where", r.where.replace(/^steepest on leg /, ""));
        where.setAttribute("data-nonmetric", "");
        parts.push(where);
      }
      line2.append(el(doc, "td", "minimums__margin", ...parts));
      body.append(line1, line2);
    }
    table.append(cols, head, body);
    plate.appendChild(table);
    if (rows.some((r) => r.assumedBase)) {
      // One line for the rows marked "base" (slope and distance): they depend on the assumed base position.
      const fn = el(doc, "p", "minimums__foot", el(doc, "span", "minimums__tag", "base"), " slope and distance use the assumed base position");
      plate.appendChild(fn);
    }

    const totals = routeTotals(s.plan.route);
    const facts = el(doc, "dl", "facts minimums-summary");
    const fact = (label, node) => facts.append(el(doc, "dt", "", label), el(doc, "dd", "", node));
    const method = (m) => ({ method: m, sources: ["dem_1m"] });
    fact("Route", num(totals.distance_m, "m", "derived", { ...method("sum of the leg lengths of the planned route, in ground metres"), digits: 0 }, doc));
    fact("Climb", num(totals.climb_m, "m", "derived", { ...method("sum of the rises along every leg"), digits: 1 }, doc));
    const foot = el(doc, "div", "minimums-foot");
    const note = el(doc, "p", "plate__note", "Caution lights under a ",
      num(20, "%", "assumption", { note: "design choice, not a sourced value" }, doc),
      " margin and stays lit until acknowledged. Time and dose use the assumed speed and work time. Source codes open their row in Credits.");
    const open = el(doc, "button", "btn btn--block", "Open the route card");
    open.setAttribute("type", "button");
    open.setAttribute("data-focus-key", "route-card");
    if (s.plan.status !== "ok") open.setAttribute("aria-disabled", "true");
    open.addEventListener("click", () => {
      if (store.getState().plan.status === "ok") actions.showSheet("route-card");
    });
    foot.append(facts, note, open);
    plate.appendChild(foot);
    keepFocus(host, () => host.replaceChildren(plate), doc);
  };
  render(store.getState());
  const off = store.subscribe(render);
  return () => {
    off();
    host.remove();
  };
}
