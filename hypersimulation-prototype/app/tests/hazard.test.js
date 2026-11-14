// AI-written (Claude, Anthropic) for the team's NASA Space Apps 2026 project.
import test from "node:test";
import assert from "node:assert/strict";
import { hazardState, marginLevel, CAUTION_FRACTION } from "../src/hazard.js";

const sep = { sepID: "2025-05-13T18:14:00-SEP-001", eventTime: "2025-05-13T18:14Z", note: "Measured near Earth. Arrival at Mars is not claimed. Replayed as a scenario." };

test("caution fraction is the named 20 percent design choice", () => {
  assert.equal(CAUTION_FRACTION, 0.2);
});

test("marginLevel: caution under 20 percent of the limit, ok at and above", () => {
  assert.equal(marginLevel(50, 100), "ok");
  assert.equal(marginLevel(20, 100), "ok");
  assert.equal(marginLevel(19.9, 100), "caution");
  assert.equal(marginLevel(0, 100), "caution");
  assert.equal(marginLevel(-5, 100), "caution");
});

test("marginLevel: a missing margin or limit is caution, never silently ok", () => {
  assert.equal(marginLevel(null, 100), "caution");
  assert.equal(marginLevel(10, null), "caution");
  assert.equal(marginLevel(NaN, 100), "caution");
});

test("hazardState: none before the start, return from the start", () => {
  const inputs = { hazard_start_min: { value: 90, placeholder: true } };
  const before = hazardState(5399, inputs, sep);
  assert.equal(before.active, false);
  assert.equal(before.level, "none");
  const at = hazardState(5400, inputs, sep);
  assert.equal(at.active, true);
  assert.equal(at.level, "return");
  assert.equal(at.label, "RETURN NOW");
  assert.equal(at.event_id, "2025-05-13T18:14:00-SEP-001");
  assert.equal(at.event_date, "2025-05-13T18:14Z");
  assert.match(at.note, /not claimed/);
});

test("hazardState: no start time means never active", () => {
  for (const inputs of [{ hazard_start_min: { value: null } }, {}]) {
    const s = hazardState(1e9, inputs, sep);
    assert.equal(s.active, false);
    assert.equal(s.level, "none");
  }
});

test("hazardState tolerates a missing event file", () => {
  const s = hazardState(10, { hazard_start_min: { value: 0 } }, null);
  assert.equal(s.active, true);
  assert.equal(s.event_id, null);
});
