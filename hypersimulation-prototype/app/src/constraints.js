// AI-written (Claude, Anthropic) for the team's NASA Space Apps 2026 project.

export const LIMITS = {
  slope_cap_deg: 15,
  rover_range_m: 2000,
  partner_max_m: 100,
  suit_time_max_h: 14,
  career_dose_msv: 600,
};

export const LIMIT_SOURCES = {
  slope_cap_deg: "pena_asensio_2024",
  rover_range_m: "drats_2022",
  partner_max_m: "drats_2022",
  suit_time_max_h: "nasa_std_3001_v2",
  career_dose_msv: "nasa_std_3001_v1",
};

function flagged(p) {
  if (p === true) return true;
  return !!p && typeof p === "object" && Object.values(p).some((v) => v === true);
}

function num(v) {
  return Number.isFinite(v) ? v : null;
}

function row(fields) {
  const { value, limit } = fields;
  const margin = value === null ? null : limit - value;
  return { margin, pass: value === null ? false : value <= limit, limit_source: fields.source, ...fields };
}

export function buildConstraints({ route, inputs, dose }) {
  const ok = !!route && route.ok === true;
  const legs = ok ? route.legs : [];
  const base = inputs && inputs.base;
  const stations = (inputs && inputs.stations) || [];

  const maxSlope = ok ? Math.max(0, ...legs.map((l) => l.max_slope_deg)) : null;
  // The leg that holds the steepest cell, by the ids of its two ends ("base" or a station id).
  let steepLeg = null;
  if (ok) {
    const k = legs.findIndex((l) => l.max_slope_deg === maxSlope);
    const l = legs[k];
    if (l && l.from && l.to) steepLeg = { index: k, from: l.from.id, to: l.to.id };
  }
  let farthest = null;
  if (ok && base) {
    farthest = 0;
    for (const l of legs) for (const [x, y] of l.path) farthest = Math.max(farthest, Math.hypot(x - base.x, y - base.y));
  }
  const speed = num(inputs && inputs.walking_speed_m_s && inputs.walking_speed_m_s.value);
  const work_min = num(inputs && inputs.work_time_min_per_station && inputs.work_time_min_per_station.value);
  const partner = num(inputs && inputs.partner_trail_m && inputs.partner_trail_m.value);

  const duration_s = ok && speed > 0 && work_min !== null
    ? route.total_m / speed + Math.max(0, legs.length - 1) * work_min * 60
    : null;
  const duration_h = duration_s === null ? null : duration_s / 3600;

  const positionAssumed = !!(base && base.assumption) || stations.some((s) => flagged(s.placeholder && typeof s.placeholder === "object" ? s.placeholder.position : s.placeholder));

  const rows = [];

  rows.push(row({
    id: "slope_cap", label: "Steepest slope on the route", value: maxSlope, unit: "deg",
    limit: LIMITS.slope_cap_deg, limit_unit: "deg", body: "Moon", source: LIMIT_SOURCES.slope_cap_deg,
    provenance: "derived", method: "Maximum of the slope cells the route crosses, from the 1 m terrain cut.",
    assumption: positionAssumed, steepest_leg: steepLeg,
  }));

  rows.push(row({
    id: "rover_range", label: "Farthest point from the crew rover", value: farthest, unit: "m",
    limit: LIMITS.rover_range_m, limit_unit: "m", body: "Earth analog for a lunar rover", source: LIMIT_SOURCES.rover_range_m,
    provenance: "derived", method: "Largest straight-line distance from the base to any route point.",
    assumption: positionAssumed,
  }));

  rows.push(row({
    id: "partner_spacing", label: "Distance between the two astronauts", value: partner, unit: "m",
    limit: LIMITS.partner_max_m, limit_unit: "m", body: "Earth analog for a lunar rover", source: LIMIT_SOURCES.partner_max_m,
    provenance: "assumption", assumption: true,
  }));

  rows.push(row({
    id: "suit_time", label: "Total time in suit", value: duration_h, unit: "h",
    limit: LIMITS.suit_time_max_h, limit_unit: "h", body: "Not surface-specific", source: LIMIT_SOURCES.suit_time_max_h,
    provenance: "derived", method: "Route length over walking speed plus work time at each station; speed and work time are assumptions.",
    assumption: true,
  }));

  const days = duration_h === null ? null : duration_h / 24;
  const measuredRate = dose && dose.dose_rate && dose.dose_rate.derived_daily ? num(dose.dose_rate.derived_daily.value) : null;
  const fallback = dose && dose.fallback ? num(dose.fallback.value) : null;
  const useMeasured = measuredRate !== null;
  const rate = useMeasured ? measuredRate : fallback;
  const rateUnit = useMeasured ? dose.dose_rate.derived_daily.unit : dose && dose.fallback ? dose.fallback.unit : null;
  rows.push({
    id: "walk_dose", label: "Absorbed dose during the walk",
    value: rate === null || days === null ? null : rate * days, unit: "mGy",
    limit: null, limit_unit: null, margin: null, pass: null,
    body: useMeasured ? `Mars, Gale, sol ${dose.sol}` : "Mars, Gale, 2012 to 2013",
    source: useMeasured ? "rad" : "hassler_2014",
    provenance: useMeasured ? "derived" : "source",
    rate_basis: useMeasured ? "dose.json derived_daily (this sol)" : "Hassler 2014 fallback",
    rate: rate, rate_unit: rateUnit,
    assumption: true,
  });

  const equiv = dose && dose.dose_equivalent_rate ? num(dose.dose_equivalent_rate.value) : null;
  const equivDose = equiv === null || days === null ? null : equiv * days;
  rows.push({
    ...row({
      id: "career_dose", label: "Walk dose equivalent against the career limit", value: equivDose, unit: "mSv",
      limit: LIMITS.career_dose_msv, limit_unit: "mSv", body: "Mars, Gale, 2012 to 2013", source: "hassler_2014",
      provenance: "derived", method: "Dose equivalent rate (Hassler 2014) times the walk duration.",
      assumption: true,
    }),
    limit_source: LIMIT_SOURCES.career_dose_msv,
    limit_body: "All",
    share_of_limit: equivDose === null ? null : equivDose / LIMITS.career_dose_msv,
  });

  return rows;
}
