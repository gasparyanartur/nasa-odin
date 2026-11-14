// AI-written (Claude, Anthropic) for the team's NASA Space Apps 2026 project.
import test from "node:test";
import assert from "node:assert/strict";
import { num, audit, fmtDuration, fmtBearing, formatValue, lmstText } from "../src/provenance.js";

function textNode(v) {
  return { nodeType: 3, nodeValue: v };
}
function makeDoc() {
  return {
    createElement(tag) {
      const attrs = {};
      const el = {
        nodeType: 1, tagName: tag, childNodes: [],
        setAttribute: (k, v) => { attrs[k] = String(v); },
        getAttribute: (k) => (k in attrs ? attrs[k] : null),
        appendChild(c) { el.childNodes.push(c); return c; },
        get textContent() { return el.childNodes.map((c) => c.nodeValue ?? c.textContent).join(""); },
        set textContent(v) { el.childNodes = [textNode(String(v))]; },
      };
      return el;
    },
  };
}
const doc = makeDoc();
const root = (...kids) => {
  const r = doc.createElement("div");
  kids.forEach((k) => r.appendChild(k));
  return r;
};
const measured = { sol: 4600, lmst: 13.5, source: "rems" };
const cls = (el) => el.getAttribute("class");
const child = (el, c) => el.childNodes.filter((k) => k.nodeType === 1 && (cls(k) || "").split(" ").includes(c));

test("null renders NO DATA with dashes and never a number", () => {
  const el = num(null, "degC", "source", { source: "rems" }, doc);
  assert.equal(child(el, "num__value")[0].textContent, "---");
  assert.equal(child(el, "nodata")[0].textContent, "NO DATA");
  assert.equal(el.getAttribute("data-nodata"), "1");
  assert.ok(!/\d/.test(child(el, "num__value")[0].textContent));
  assert.equal(child(num(null, "degC", "measured", measured, doc), "nodata").length, 1);
  assert.equal(num([{ value: null, unit: "h" }], null, "assumption", {}, doc).getAttribute("data-nodata"), "1");
});

test("markup: value, unit and the origin label in words; measured carries its sol and LMST", () => {
  const el = num(-12.34, "degC", "measured", { ...measured, digits: 1 }, doc);
  assert.equal(cls(el), "num");
  assert.equal(child(el, "num__value")[0].textContent, "-12.3");
  assert.equal(child(el, "num__unit")[0].textContent, "degC");
  const prov = child(el, "num__prov")[0];
  assert.equal(prov.textContent, "measuredsol 4600, 13:30 LMST");
  assert.equal(child(prov, "num__prov-word")[0].textContent, "measured");
  assert.equal(child(prov, "num__when")[0].textContent, "sol 4600, 13:30 LMST");
  assert.match(prov.getAttribute("title"), /MSL REMS/);
  assert.equal(el.getAttribute("data-prov"), "measured");
});

test("degree values keep the sign on the value; thousands get a comma", () => {
  const el = num(15, "°", "source", { source: "pena_asensio_2024", label: "Moon, Pena-Asensio 2024" }, doc);
  assert.equal(child(el, "num__value")[0].textContent, "15°");
  assert.equal(child(el, "num__unit").length, 0);
  assert.equal(child(el, "num__prov")[0].textContent, "Moon, Pena-Asensio 2024");
  assert.match(child(el, "num__prov")[0].getAttribute("title"), /Moon, Pena-Asensio 2024/);
  assert.equal(child(num(2000, "m", "source", { source: "drats_2022" }, doc), "num__value")[0].textContent, "2,000");
  assert.equal(child(num(2000, "m", "source", { source: "drats_2022", group: false }, doc), "num__value")[0].textContent, "2000");
  assert.equal(formatValue(-3660.25, { digits: 1 }), "-3,660.3");
  assert.equal(formatValue("2025-05-13"), "2025-05-13");
});

test("num throws when a required detail is missing", () => {
  assert.throws(() => num(1, "degC", "measured", { sol: 4600, source: "rems" }, doc), /lmst/);
  assert.throws(() => num(1, "degC", "measured", { lmst: 1, source: "rems" }, doc), /sol/);
  assert.throws(() => num(1, "degC", "measured", { sol: 1, lmst: 1 }, doc), /source/);
  assert.throws(() => num(1, "m", "source", {}, doc), /source/);
  assert.throws(() => num(1, "m", "derived", { method: "x" }, doc), /sources/);
  assert.throws(() => num(1, "m", "derived", { sources: ["a"] }, doc), /method/);
  assert.throws(() => num(1, "m", "bogus", {}, doc), /unknown/);
  assert.throws(() => num(1, "m", "derived", { compact: true }, doc), /method/);
});

test("every provenance carries its word; no letter codes", () => {
  for (const p of ["assumption", "scenario", "mock"]) {
    const el = num(15, "deg", p, undefined, doc);
    assert.equal(el.getAttribute("data-prov"), p);
    const prov = child(el, "num__prov")[0];
    assert.equal(prov.textContent, p);
    assert.ok(prov.getAttribute("title").length > 3);
  }
  // A note the words leave out makes the label a focusable note reference.
  const noted = child(num(5, "m", "assumption", { note: "walking speed" }, doc), "num__prov")[0];
  assert.equal(noted.getAttribute("tabindex"), "0");
  assert.equal(noted.getAttribute("role"), "note");
  assert.equal(child(num(5, "m", "assumption", {}, doc), "num__prov")[0].getAttribute("tabindex"), null);
});

test("derived shows its word and keeps the method in a focusable note reference", () => {
  const d = num(1, "m", "derived", { method: "mean x 24", sources: ["rad"] }, doc);
  const prov = child(d, "num__prov")[0];
  assert.equal(prov.textContent, "derived");
  assert.equal(prov.getAttribute("tabindex"), "0");
  assert.match(prov.getAttribute("aria-label"), /mean x 24/);
  assert.match(prov.getAttribute("data-detail"), /MSL RAD/);
  assert.equal(child(num(1, "m", "derived", { method: "m", short: "x 24", sources: ["rad"] }, doc), "num__prov")[0].textContent, "derived: x 24");
});

test("compact keeps the provenance word only, as a note reference", () => {
  const c = num(15, "°", "source", { source: "pena_asensio_2024", compact: true }, doc);
  assert.equal(child(c, "num__prov")[0].textContent, "source");
  assert.equal(child(c, "num__prov")[0].getAttribute("tabindex"), "0");
  assert.match(child(c, "num__prov")[0].getAttribute("aria-label"), /Pena-Asensio 2024/);
  const m = num(-20, "degC", "measured", { ...measured, compact: true }, doc);
  assert.equal(child(m, "num__prov")[0].textContent, "measured");
});

test("suffix false hides the suffix, keeps the text in the title and marks the value data-prov-near", () => {
  const el = num(14, "h", "source", { source: "nasa_std_3001_v2", suffix: false }, doc);
  assert.equal(child(el, "num__prov").length, 0);
  assert.match(el.getAttribute("title"), /NASA-STD-3001 Vol 2/);
  assert.equal(el.getAttribute("data-prov-near"), "1");
  assert.deepEqual(audit(root(el)), []);
});

test("parts render one value and unit cell each", () => {
  const el = num(fmtDuration(4 * 3600), null, "assumption", { note: "walking speed and work time" }, doc);
  assert.deepEqual(child(el, "num__value").map((x) => x.textContent), ["4", "00"]);
  assert.deepEqual(child(el, "num__unit").map((x) => x.textContent), ["h", "min"]);
  assert.equal(child(el, "num__prov")[0].getAttribute("tabindex"), "0");
});

test("fmtDuration: seconds, minutes and seconds, hours and minutes", () => {
  assert.deepEqual(fmtDuration(58), [{ value: "58", unit: "s" }]);
  assert.deepEqual(fmtDuration(588), [{ value: "9", unit: "min" }, { value: "48", unit: "s" }]);
  assert.deepEqual(fmtDuration(14396), [{ value: "4", unit: "h" }, { value: "00", unit: "min" }]);
  assert.deepEqual(fmtDuration(36000), [{ value: "10", unit: "h" }, { value: "00", unit: "min" }]);
  assert.deepEqual(fmtDuration(-90), [{ value: "-1", unit: "min" }, { value: "30", unit: "s" }]);
  assert.equal(fmtDuration(null), null);
  assert.equal(fmtDuration(NaN), null);
});

test("fmtBearing: three digits, wraps at 360, null for a missing bearing", () => {
  assert.equal(fmtBearing(28.4), "028");
  assert.equal(fmtBearing(227), "227");
  assert.equal(fmtBearing(359.7), "000");
  assert.equal(fmtBearing(-90), "270");
  assert.equal(fmtBearing(null), null);
  assert.equal(lmstText(9), "09:00");
  assert.equal(lmstText(24.5), "00:30");
});

test("audit flags a bare digit text and passes the same text built with num", () => {
  const bare = root(textNode("15 deg"));
  assert.equal(audit(bare).length, 1);
  assert.equal(audit(bare)[0].text, "15 deg");
  const ok = root(num(15, "deg", "assumption", {}, doc));
  assert.deepEqual(audit(ok), []);
  assert.deepEqual(audit(root(num(fmtDuration(600), null, "assumption", {}, doc))), []);
});

test("audit passes data-nonmetric elements and text without digits", () => {
  const station = doc.createElement("span");
  station.setAttribute("data-nonmetric", "");
  station.textContent = "Station 3";
  assert.deepEqual(audit(root(station, textNode("Next station"))), []);
  assert.equal(audit(root(textNode("Station 3"))).length, 1);
});

test("audit fails mock provenance", () => {
  const r = audit(root(num(5, "m", "mock", {}, doc)));
  assert.equal(r.length, 1);
  assert.match(r[0].reason, /mock/);
});

test("audit (a): digits in aria-label, aria-valuetext, title and alt need num() or data-nonmetric", () => {
  for (const name of ["aria-label", "aria-valuetext", "title", "alt"]) {
    const el = doc.createElement("button");
    el.setAttribute(name, "Move 3 steps");
    const r = audit(root(el));
    assert.equal(r.length, 1, name);
    assert.match(r[0].reason, new RegExp(name));
    const okEl = doc.createElement("button");
    okEl.setAttribute(name, "Move 3 steps");
    okEl.setAttribute("data-nonmetric", "");
    assert.deepEqual(audit(root(okEl)), [], `${name} with data-nonmetric`);
  }
  const words = doc.createElement("button");
  words.setAttribute("aria-label", "Move north");
  assert.deepEqual(audit(root(words)), []);
  // a num() element carries its own title and note text; an attribute inside a num() is fine
  assert.deepEqual(audit(root(num(15, "deg", "derived", { method: "from 1 m terrain", sources: ["dem_1m"] }, doc))), []);
  // an ancestor that is data-nonmetric covers the attribute of a child
  const outer = doc.createElement("div");
  outer.setAttribute("data-nonmetric", "");
  const inner = doc.createElement("span");
  inner.setAttribute("aria-label", "Station 3");
  outer.appendChild(inner);
  assert.deepEqual(audit(root(outer)), []);
});

test("audit (b): a num() element needs a unit unless it is marked as a count", () => {
  const noUnit = num(65, "", "source", { source: "msl_waypoints" }, doc);
  const r = audit(root(noUnit));
  assert.equal(r.length, 1);
  assert.match(r[0].reason, /unit/);
  const count = num(65, "", "source", { source: "msl_waypoints", count: true }, doc);
  assert.equal(count.getAttribute("data-count"), "1");
  assert.deepEqual(audit(root(count)), []);
  assert.deepEqual(audit(root(num(5, "m", "assumption", {}, doc))), []);
  // the unit may be a child cell (parts) and NO DATA needs none
  assert.deepEqual(audit(root(num(fmtDuration(600), null, "assumption", {}, doc))), []);
  assert.deepEqual(audit(root(num(null, "m", "assumption", {}, doc))), []);
  const bare = doc.createElement("span");
  bare.setAttribute("data-prov", "assumption");
  bare.setAttribute("data-unit", "");
  const r2 = audit(root(bare));
  assert.equal(r2.length, 2);
  assert.ok(r2.some((x) => /unit/.test(x.reason)));
  assert.ok(r2.some((x) => /provenance/.test(x.reason)));
});

test("audit (d): a num() element must carry its provenance label unless it is marked data-prov-near", () => {
  const ok = num(5, "m", "assumption", {}, doc);
  assert.deepEqual(audit(root(ok)), []);
  const stripped = num(5, "m", "assumption", {}, doc);
  stripped.childNodes = stripped.childNodes.filter((k) => !(cls(k) || "").split(" ").includes("num__prov"));
  const r = audit(root(stripped));
  assert.equal(r.length, 1);
  assert.match(r[0].reason, /provenance label/);
  assert.deepEqual(audit(root(num(null, "m", "source", { source: "rems" }, doc))), []);
});

test("audit (e): in a browser view, the label shows where it must and hides where it must not", () => {
  const a = num(5, "m", "assumption", {}, doc);
  const b = num(7, "m", "assumption", {}, doc);
  const label = (n) => child(n, "num__prov")[0];
  // a: label wanted but hidden; b: label not wanted but shown
  const shown = new Set([a, b, label(b)]);
  const view = { isShown: (el) => shown.has(el), wantsLabel: (n) => n === a };
  const r = audit(root(a, b), view);
  assert.equal(r.length, 2);
  assert.match(r[0].reason, /hidden where it must show/);
  assert.match(r[1].reason, /shown with sources off/);
  // a number that is not rendered and a "either is right" context pass
  assert.deepEqual(audit(root(a, b), { isShown: () => false, wantsLabel: () => true }), []);
  assert.deepEqual(audit(root(a, b), { isShown: () => true, wantsLabel: () => null }), []);
  // without a view only the data is checked
  assert.deepEqual(audit(root(a, b)), []);
});

test("audit (c): SVG text nodes are scanned like HTML text", () => {
  const svg = doc.createElement("svg");
  const t = doc.createElement("text");
  t.textContent = "1,200";
  svg.appendChild(t);
  const r = audit(root(svg));
  assert.equal(r.length, 1);
  assert.equal(r[0].text, "1,200");
  const ok = doc.createElement("svg");
  ok.appendChild(num(1200, "m", "derived", { method: "m", sources: ["dem_1m"] }, doc));
  const wrap = doc.createElement("text");
  wrap.setAttribute("data-nonmetric", "");
  wrap.textContent = "S3";
  ok.appendChild(wrap);
  assert.deepEqual(audit(root(ok)), []);
});
