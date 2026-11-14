// AI-written (Claude, Anthropic) for the team's NASA Space Apps 2026 project.

// Design choice, not a sourced value: a margin under this fraction of its limit shows the amber caution state.
export const CAUTION_FRACTION = 0.2;

// A margin or limit that is missing counts as caution, never as "ok" (missing data is never silent).
export function marginLevel(margin, limit) {
  if (!Number.isFinite(margin) || !Number.isFinite(limit)) return "caution";
  return margin < limit * CAUTION_FRACTION ? "caution" : "ok";
}

export function hazardState(t_s, inputs, sep) {
  const start_min = inputs && inputs.hazard_start_min ? inputs.hazard_start_min.value : null;
  const start_s = Number.isFinite(start_min) ? start_min * 60 : null;
  const active = start_s !== null && Number.isFinite(t_s) && t_s >= start_s;
  return {
    active,
    level: active ? "return" : "none",
    label: active ? "RETURN NOW" : "",
    start_s,
    event_id: sep ? (sep.sepID ?? sep.activityID ?? sep.id ?? null) : null,
    event_date: sep ? (sep.eventTime ?? sep.startTime ?? null) : null,
    note: sep ? (sep.note ?? null) : null,
  };
}
