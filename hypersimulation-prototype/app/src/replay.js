// AI-written (Claude, Anthropic) for the team's NASA Space Apps 2026 project.
import { LIMITS } from "./constraints.js";
import { lookHeading } from "./camera-heading.js";

export const MARS_HOUR_S = 3698.97; // 88,775.244 s per sol / 24
const CONDITION_FIELDS = ["ground_brightness_temp_c", "air_temp_c", "pressure_pa", "uv_abc_w_m2", "rel_humidity_pct"];

function bearingDeg(a, b) {
  return ((Math.atan2(b[0] - a[0], b[1] - a[1]) * 180) / Math.PI + 360) % 360;
}

function measure(path) {
  const cum = [0];
  for (let k = 1; k < path.length; k++) cum.push(cum[k - 1] + Math.hypot(path[k][0] - path[k - 1][0], path[k][1] - path[k - 1][1]));
  return cum;
}

function pointAlong(path, cum, s) {
  const total = cum[cum.length - 1];
  if (path.length === 1 || total === 0) return { pos: { x: path[0][0], y: path[0][1] }, heading: null };
  const d = Math.min(Math.max(s, 0), total);
  let k = 1;
  while (k < path.length - 1 && cum[k] < d) k++;
  const seg = cum[k] - cum[k - 1];
  const f = seg === 0 ? 1 : (d - cum[k - 1]) / seg;
  const a = path[k - 1];
  const b = path[k];
  return { pos: { x: a[0] + (b[0] - a[0]) * f, y: a[1] + (b[1] - a[1]) * f }, heading: bearingDeg(a, b) };
}

function need(value, name) {
  if (!Number.isFinite(value)) throw new Error(`replay needs ${name}`);
  return value;
}

export function buildTimeline({ route, inputs, conditions }) {
  if (!route || route.ok !== true) throw new Error("replay needs a route that planned");
  // No sourced speed-versus-slope model exists, so time per leg is distance over the team's walking speed.
  const speed = need(inputs.walking_speed_m_s && inputs.walking_speed_m_s.value, "walking_speed_m_s");
  if (!(speed > 0)) throw new Error("replay needs walking_speed_m_s above 0");
  const workS = need(inputs.work_time_min_per_station && inputs.work_time_min_per_station.value, "work_time_min_per_station") * 60;
  const partner = Number.isFinite(inputs.partner_trail_m && inputs.partner_trail_m.value) ? inputs.partner_trail_m.value : null;
  const startLmst = Number.isFinite(inputs.start_lmst_hour && inputs.start_lmst_hour.value) ? inputs.start_lmst_hour.value : null;
  const legs = route.legs;
  const baseXY = legs.length ? { x: legs[0].from.x, y: legs[0].from.y } : { x: inputs.base.x, y: inputs.base.y };

  const baseSegments = [];
  const baseEvents = [];
  let t = 0;
  legs.forEach((leg, i) => {
    const cum = measure(leg.path);
    const dur = leg.distance_m / speed;
    baseEvents.push({ type: "depart", station_id: leg.from.id, t_s: t });
    baseSegments.push({ kind: "walk", leg_index: i, t0: t, t1: t + dur, end: t + dur, path: leg.path, cum, target: leg.to, toStation: i < legs.length - 1 });
    t += dur;
    baseEvents.push({ type: "arrive", station_id: leg.to.id, t_s: t });
    if (i < legs.length - 1) {
      baseSegments.push({ kind: "work", leg_index: i, t0: t, t1: t + workS, end: t + workS, station: leg.to, next_leg: i + 1 });
      t += workS;
    }
  });
  const baseDuration = t;
  let segments = baseSegments;
  let events = baseEvents;
  let hazardT = null;

  const conditionsFor = (lmst) => {
    const hours = conditions && Array.isArray(conditions.hours) ? conditions.hours : [];
    const entry = lmst === null ? null : hours.find((h) => h.lmst_hour === Math.floor(lmst)) || null;
    const out = {};
    for (const f of CONDITION_FIELDS) out[f] = entry && entry[f] !== undefined ? entry[f] : null;
    return out;
  };

  const timeline = {
    get duration_s() { return segments.length ? segments[segments.length - 1].end : 0; },
    get events() { return events; },
    get hazard_t_s() { return hazardT; },

    stateAt(t_s) {
      const tt = Math.max(0, t_s);
      const lmstRaw = startLmst === null ? null : startLmst + tt / MARS_HOUR_S;
      const lmst = lmstRaw === null ? null : ((lmstRaw % 24) + 24) % 24;
      const common = {
        suit_time_left_s: LIMITS.suit_time_max_h * 3600 - tt,
        lmst_hour: lmst,
        conditions: conditionsFor(lmst),
      };
      const seg = segments.find((s) => tt >= s.t0 && tt < s.end);
      if (!seg) {
        return {
          ...common, pos: { ...baseXY }, heading_deg: null, look_deg: null, leg_index: legs.length ? legs.length - 1 : null,
          at_station: null, next_station: null, dist_to_next_m: null, bearing_to_next_deg: null,
          dist_to_base_m: 0, dist_to_partner_m: partner, mode: "done",
        };
      }
      let pos, heading, look, target, nextStation, mode, atStation = null, legIndex;
      if (seg.kind === "work") {
        const nl = legs[seg.next_leg];
        pos = { x: seg.station.x, y: seg.station.y };
        heading = nl.bearing_deg;
        look = lookHeading(nl.path, 0);
        target = nl.to;
        nextStation = seg.next_leg < legs.length - 1 ? nl.to.id : null;
        mode = "work";
        atStation = seg.station.id;
        legIndex = seg.leg_index;
      } else {
        const total = seg.cum[seg.cum.length - 1];
        const frac = seg.t1 === seg.t0 ? 1 : (tt - seg.t0) / (seg.t1 - seg.t0);
        const p = pointAlong(seg.path, seg.cum, frac * total);
        pos = p.pos;
        heading = p.heading;
        target = seg.target;
        nextStation = seg.kind === "walk" && seg.toStation ? seg.target.id : null;
        mode = seg.kind === "return" ? "return" : "walk";
        legIndex = seg.kind === "return" ? null : seg.leg_index;
        if (heading === null) heading = bearingDeg([pos.x, pos.y], [target.x, target.y]);
        look = lookHeading(seg.path, frac * total, { cum: seg.cum });
      }
      if (look === null) look = heading;
      return {
        ...common, pos, heading_deg: heading, look_deg: look, leg_index: legIndex, at_station: atStation, next_station: nextStation,
        dist_to_next_m: Math.hypot(target.x - pos.x, target.y - pos.y),
        bearing_to_next_deg: bearingDeg([pos.x, pos.y], [target.x, target.y]),
        dist_to_base_m: Math.hypot(baseXY.x - pos.x, baseXY.y - pos.y),
        // The partner is not simulated: the shown spacing is the team's input, not a measurement.
        dist_to_partner_m: partner,
        mode,
      };
    },

    // The caller computes returnLeg with planReturn from stateAt(t_s).pos.
    triggerHazard(t_s, returnLeg) {
      const th = Math.max(0, t_s);
      if (th >= baseDuration || !returnLeg || !Array.isArray(returnLeg.path)) return timeline;
      const cut = [];
      for (const s of baseSegments) {
        if (s.t1 <= th) cut.push(s);
        else if (s.t0 < th) cut.push({ ...s, end: th });
      }
      const dur = returnLeg.distance_m / speed;
      const to = returnLeg.to || { id: "base", ...baseXY };
      cut.push({ kind: "return", t0: th, t1: th + dur, end: th + dur, path: returnLeg.path, cum: measure(returnLeg.path), target: to, toStation: false });
      segments = cut;
      events = baseEvents.filter((e) => e.t_s <= th).concat([
        { type: "hazard", station_id: null, t_s: th },
        { type: "arrive", station_id: to.id, t_s: th + dur },
      ]);
      hazardT = th;
      return timeline;
    },

    clearHazard() {
      segments = baseSegments;
      events = baseEvents;
      hazardT = null;
      return timeline;
    },
  };
  return timeline;
}
