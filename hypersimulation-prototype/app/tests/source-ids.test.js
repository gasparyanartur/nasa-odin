// AI-written (Claude, Anthropic) for the team's NASA Space Apps 2026 project.
// Every source id the app cites must be a row of app/sources.json, so a credit or a provenance note never points
// at a source that is not listed.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { LIMIT_SOURCES } from "../src/constraints.js";
import { SOURCE_LABELS } from "../src/provenance.js";

const APP = join(dirname(fileURLToPath(import.meta.url)), "..");
const SOURCES = JSON.parse(readFileSync(join(APP, "sources.json"), "utf8"));
const KNOWN = new Set(SOURCES.map((s) => s.id));

function jsFiles(dir) {
  const out = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...jsFiles(p));
    else if (e.name.endsWith(".js")) out.push(p);
  }
  return out;
}

// String literals that follow the keys `source:`, `sources:`, `source_ids:`, `limit_source:` or `SOURCES =`, up to the end
// of that value (a comma at depth zero, a closing brace or the end of the line).
export function citedIds(text) {
  const ids = [];
  const re = /\b(?:(?:sources?|source_ids?|limit_source)\s*:|SOURCES\s*=)\s*/g;
  for (const line of text.split("\n")) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(line))) {
      let depth = 0;
      let end = line.length;
      for (let i = m.index + m[0].length; i < line.length; i++) {
        const c = line[i];
        if (c === "[" || c === "(") depth++;
        else if (c === "]" || c === ")") {
          if (depth === 0) {
            end = i;
            break;
          }
          depth--;
        } else if ((c === "," || c === "}") && depth === 0) {
          end = i;
          break;
        }
      }
      for (const lit of line.slice(m.index + m[0].length, end).matchAll(/"([a-z0-9_]+)"/g)) ids.push(lit[1]);
    }
  }
  return ids;
}

test("sources.json lists every source by a unique id", () => {
  assert.ok(SOURCES.length > 0);
  assert.equal(KNOWN.size, SOURCES.length);
});

test("the limit sources are rows of sources.json", () => {
  for (const [limit, id] of Object.entries(LIMIT_SOURCES)) assert.ok(KNOWN.has(id), `${limit} cites "${id}"`);
});

test("every short source label belongs to a row of sources.json", () => {
  for (const id of Object.keys(SOURCE_LABELS)) assert.ok(KNOWN.has(id), `SOURCE_LABELS has "${id}"`);
});

test("every source id cited in app/src and app/layers.json exists in sources.json", () => {
  const missing = [];
  let seen = 0;
  for (const file of jsFiles(join(APP, "src"))) {
    for (const id of citedIds(readFileSync(file, "utf8"))) {
      seen++;
      if (!KNOWN.has(id)) missing.push(`${file.slice(APP.length + 1)}: ${id}`);
    }
  }
  const layers = JSON.parse(readFileSync(join(APP, "layers.json"), "utf8"));
  for (const l of layers) {
    for (const id of l.source_ids || []) {
      seen++;
      if (!KNOWN.has(id)) missing.push(`layers.json ${l.id}: ${id}`);
    }
  }
  assert.ok(seen > 20, `the scan found ${seen} citations`);
  assert.deepEqual(missing, []);
});

test("the citation scan reads ternaries and lists", () => {
  assert.deepEqual(citedIds('x = { source: useMeasured ? "rad" : "hassler_2014", y: "nope" }'), ["rad", "hassler_2014"]);
  assert.deepEqual(citedIds('{ method: "m", sources: ["dem_1m", "hrsc"], digits: 1 }'), ["dem_1m", "hrsc"]);
  assert.deepEqual(citedIds('const SOURCES = ["dem_1m", "msl_waypoints"];'), ["dem_1m", "msl_waypoints"]);
});
