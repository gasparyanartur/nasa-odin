#!/usr/bin/env python3
"""AI-written (Claude, Anthropic) for the team's NASA Space Apps 2026 project.

Cuts one Mars sol out of the REMS weather table, the RAD dose file and the
DONKI space-weather call, and writes conditions.json, dose.json and
sep-event.json. Offline: the raw files are downloaded beforehand and passed in.
Standard library only. Run with `python3 -I`.

The raw files are untrusted data. Only numbers and fixed section names are
read from them; no free text is copied into the outputs.
"""
import argparse
import csv
import json
import os
import re
import sys

RETRIEVED = "2026-11-14"
MISSING = -999.0
KELVIN = 273.15

# column index (0-based) of each value and of the flag that guards it, plus the
# flag bytes (0 = left end of the stripped string) that must all be "1".
# The label (MODRDR PDS4 .xml) says "0 = bad; 1 = good; X = unknown". Requiring
# every byte to be 1 leaves zero values in the sol-4600 file, because some bytes
# describe a state and not a fault (for example GTS byte 0 is 0 in every row).
# Only the bytes below are required; "X" counts as not good.
FIELDS = {
    "ground_brightness_temp_c": {"col": 7, "flag": 10, "bytes": (1, 2), "kelvin": True},
    "air_temp_c": {"col": 15, "flag": 16, "bytes": (2, 7, 8), "kelvin": True},
    "pressure_pa": {"col": 37, "flag": 39, "bytes": (1,), "kelvin": False},
    "uv_abc_w_m2": {"col": 20, "flag": 29, "bytes": (2, 3), "kelvin": False},
    "rel_humidity_pct": {"col": 30, "flag": 35, "bytes": (0, 1, 2), "kelvin": False},
}
FIELD_ORDER = list(FIELDS)
EXPECTED_NAMES = {
    1: "LMST", 7: "BRIGHTNESS_TEMP", 10: "GTS_CONFIDENCE_LEVEL",
    15: "AMBIENT_TEMP", 16: "AMBIENT_TEMP_CONFIDENCE_LEVEL", 20: "UV_ABC",
    29: "UVS_CONFIDENCE_LEVEL", 30: "LOCAL_RELATIVE_HUMIDITY",
    35: "HS_CONFIDENCE_LEVEL", 37: "PRESSURE", 39: "PS_CONFIDENCE_LEVEL",
}

LMST_RE = re.compile(r"^(\d{5})M(\d{2}):\d{2}:\d{2}")


def parse_lmst(text):
    """Return (sol, hour) from 'SSSSSMHH:MM:SS.sss', or None."""
    m = LMST_RE.match(text.strip())
    if not m:
        return None
    hour = int(m.group(2))
    if hour > 23:
        return None
    return int(m.group(1)), hour


def flag_ok(flag_text, required_bytes):
    """True when every required byte of the stripped flag string is '1'."""
    s = flag_text.strip()
    if len(s) <= max(required_bytes):
        return False
    return all(s[i] == "1" for i in required_bytes)


def to_float(text):
    try:
        return float(text)
    except ValueError:
        return None


def rems_hours(rows, sol):
    """rows: list of 40-field lists. Returns the 24 hour entries for `sol`."""
    sums = {f: [0.0] * 24 for f in FIELD_ORDER}
    counts = {f: [0] * 24 for f in FIELD_ORDER}
    for r in rows:
        if len(r) < 40:
            continue
        parsed = parse_lmst(r[1])
        if parsed is None or parsed[0] != sol:
            continue
        hour = parsed[1]
        for name, spec in FIELDS.items():
            v = to_float(r[spec["col"]])
            if v is None or v == MISSING:
                continue
            if not flag_ok(r[spec["flag"]], spec["bytes"]):
                continue
            if spec["kelvin"]:
                v = v - KELVIN
            sums[name][hour] += v
            counts[name][hour] += 1
    hours = []
    for h in range(24):
        entry = {"lmst_hour": h}
        for name in FIELD_ORDER:
            n = counts[name][h]
            entry[name] = round(sums[name][h] / n, 3) if n else None
        entry["n"] = {name: counts[name][h] for name in FIELD_ORDER}
        hours.append(entry)
    return hours


def hours_with_data(hours, field):
    return sum(1 for h in hours if h[field] is not None)


def read_rems(tab_path):
    with open(tab_path, newline="", errors="replace") as fh:
        return list(csv.reader(fh))


def rems_label_names(xml_path):
    """Field names from the PDS4 label, in order (names only)."""
    with open(xml_path, errors="replace") as fh:
        text = fh.read()
    return re.findall(r"<name>([A-Z0-9_]{2,40})</name>\s*<field_number>", text)


def check_label(names):
    """Return a list of differences between the label and EXPECTED_NAMES."""
    diffs = []
    for idx, want in EXPECTED_NAMES.items():
        got = names[idx] if idx < len(names) else None
        if got != want:
            diffs.append({"column_index": idx, "expected": want, "label": got})
    return diffs


OBS_RE = re.compile(r"^\[OBSERVATION: (\d+)\]")
DOSE_RE = re.compile(r"^\[DOSIMETRY_TOTAL_DOSE_([BE]): (\d+)\]")
START_RE = re.compile(r'^START_OBS_MARS="(\d+) (\d{1,2}):(\d{2}):(\d{2})"')


def rad_observations(lines, sol):
    """Dose per observation. A dose section is the header line, a blank line
    and one number (layout read from a real file; the SIS only gives the unit).
    Returns a list of {"obs", "hour", "B", "E"} for observations of `sol`.
    Observations after the sol-time clock wraps past midnight carry the old
    sol number in the file, so they are dropped at the first backward step."""
    obs = {}
    order = []
    cur = None
    prev_secs = None
    wrapped = False
    for i, line in enumerate(lines):
        m = OBS_RE.match(line)
        if m:
            cur = m.group(1)
            continue
        m = START_RE.match(line)
        if m and cur is not None:
            file_sol, h, mi, s = (int(x) for x in m.groups())
            secs = h * 3600 + mi * 60 + s
            if prev_secs is not None and secs < prev_secs:
                wrapped = True
            prev_secs = secs
            ok = file_sol == sol and not wrapped
            obs[cur] = {"obs": cur, "hour": h, "B": None, "E": None, "ok": ok}
            order.append(cur)
            continue
        m = DOSE_RE.match(line)
        if m and m.group(2) in obs:
            val = None
            for j in range(i + 1, min(i + 4, len(lines))):
                if lines[j].strip():
                    val = to_float(lines[j].strip())
                    break
            if val is not None and val >= 0:
                obs[m.group(2)][m.group(1)] = val
    return [obs[k] for k in order if obs[k]["ok"]]


def rad_dose(observations, detector):
    """Hourly means of the detector values, then their mean.
    Returns (mean microGy/h, n_obs, hourly list)."""
    by_hour = {}
    n = 0
    for o in observations:
        v = o[detector]
        if v is None:
            continue
        by_hour.setdefault(o["hour"], []).append(v)
        n += 1
    hourly = [{"lmst_hour": h, "value": round(sum(v) / len(v), 5), "n_obs": len(v)}
              for h, v in sorted(by_hour.items())]
    if not hourly:
        return None, 0, []
    mean = sum(x["value"] for x in hourly) / len(hourly)
    return round(mean, 5), n, hourly


def daily_msv(mean_micro_gy_per_h):
    """microGy/hour mean to mGy/day: x 24 / 1000."""
    if mean_micro_gy_per_h is None:
        return None
    return round(mean_micro_gy_per_h * 24 / 1000, 4)


def build_dose_json(sol, observations, rad_url="", detector="B"):
    mean_b, n_b, hourly_b = rad_dose(observations, "B")
    mean_e, n_e, hourly_e = rad_dose(observations, "E")
    mean, n, hourly = (mean_b, n_b, hourly_b) if detector == "B" else (mean_e, n_e, hourly_e)
    other = (mean_e, n_e, hourly_e) if detector == "B" else (mean_b, n_b, hourly_b)
    other_name = "E" if detector == "B" else "B"
    return {
        "sol": sol,
        "source": {
            "title": "MSL RAD RDR, data set MSL-M-RAD-3-RDR-V1.0 (NASA Planetary Data System, PPI node)",
            "urls": [u for u in rad_url.split(",") if u] + [
                "https://pds-ppi.igpp.ucla.edu/data/MSL-M-RAD-3-RDR-V1.0/DOCUMENT/RAD_RDR_SIS.HTM"],
            "citation": "Use of these data is at the user's own risk. (AAREADME.TXT of the data set)",
            "unit_source": "RAD_RDR_SIS.HTM: the total dose for the B and E detectors are given in microGray / hour",
            "layout_note": "Each [DOSIMETRY_TOTAL_DOSE_B: NN] and [DOSIMETRY_TOTAL_DOSE_E: NN] section holds one number. The row layout is not in the SIS or a .FMT file; it was read from the real file.",
            "retrieved": RETRIEVED,
        },
        "dose_rate": {
            "value": mean,
            "unit": "microGy/hour",
            "time_base": "per hour, mean of the sol's hourly means",
            "detector": detector,
            "detector_note": "The SIS does not rank the detectors. B chosen as the first detector the SIS lists; detector %s is given in other_detector." % other_name,
            "n_obs": n,
            "hours_with_data": len(hourly),
            "derived_daily": {
                "value": daily_msv(mean),
                "unit": "mGy/day",
                "method": "mean of the sol's hourly values x 24 / 1000, derived by us",
            },
        },
        "other_detector": {
            "detector": other_name, "value": other[0], "unit": "microGy/hour",
            "n_obs": other[1],
            "derived_daily": {"value": daily_msv(other[0]), "unit": "mGy/day"},
        },
        "hourly": [dict(x, unit="microGy/hour") for x in hourly],
        "fallback": {"value": 0.210, "plus_minus": 0.040, "unit": "mGy/day",
                     "source": "Hassler et al. 2014", "period": "Gale, 2012 to 2013"},
        "dose_equivalent_rate": {"value": 0.64, "plus_minus": 0.12, "unit": "mSv/day",
                                 "source": "Hassler et al. 2014"},
    }


def build_conditions_json(sol, earth_date, hours, urls):
    return {
        "sol": sol,
        "earth_date": earth_date,
        "earth_date_note": "UTC date of the first raw image of the sol in the NASA raw image feed (date_taken). A sol straddles two UTC dates.",
        "source": {
            "title": "MSL REMS RDR MODRDR, data set MSL-M-REMS-5-MODRDR-V1.0",
            "urls": urls,
            "citation": "Gomez-Elvira, J., Mars Science Laboratory Rover Environmental Monitoring Station RDR Data V1.0, MSL-M-REMS-5-MODRDR-V1.0, NASA Planetary Data System, 2013.",
            "retrieved": RETRIEVED,
        },
        "hours": hours,
        "units": {
            "lmst_hour": "hour of local mean solar time (0 to 23), the HH of the LMST text",
            "ground_brightness_temp_c": "degrees Celsius (thermopile brightness temperature, 8-14 um; not a contact temperature)",
            "air_temp_c": "degrees Celsius (AMBIENT_TEMP)",
            "pressure_pa": "pascal",
            "uv_abc_w_m2": "watt per square metre (UV_ABC; dust attenuation flag is 0 in every row, so values are lower bounds)",
            "rel_humidity_pct": "percent (null when the humidity flags are not good)",
            "n": "count of 1 Hz rows per field that passed the flags in that hour",
        },
        "flags": {
            "ground_brightness_temp_c": "GTS_CONFIDENCE_LEVEL bytes 1 (recalibration quality) and 2 (rover still) must be 1",
            "air_temp_c": "AMBIENT_TEMP_CONFIDENCE_LEVEL bytes 2 (power supply), 7 (error under 5 K) and 8 (reliable) must be 1",
            "pressure_pa": "PS_CONFIDENCE_LEVEL byte 1 (no shadow effect) must be 1",
            "uv_abc_w_m2": "UVS_CONFIDENCE_LEVEL bytes 2 (arm stowed) and 3 (no shadow) must be 1",
            "rel_humidity_pct": "HS_CONFIDENCE_LEVEL bytes 0, 1 and 2 must be 1",
            "rule": "-999 is missing; an unknown flag byte (X) counts as not good; null means no data",
        },
    }


def build_sep_json(events, url):
    target = None
    for e in events:
        if isinstance(e, dict) and e.get("sepID") == "2025-05-13T18:14:00-SEP-001":
            target = e
    if target is None:
        raise ValueError("DONKI event 2025-05-13T18:14:00-SEP-001 not in the response")

    def names(items, key):
        return [str(i.get(key)) for i in items if isinstance(i, dict) and i.get(key)]

    return {
        "sepID": target["sepID"],
        "eventTime": target.get("eventTime"),
        "instruments": names(target.get("instruments") or [], "displayName"),
        "link": target.get("link"),
        "linkedEvents": names(target.get("linkedEvents") or [], "activityID"),
        "submissionTime": target.get("submissionTime"),
        "units": {"eventTime": "UTC, ISO 8601", "submissionTime": "UTC, ISO 8601"},
        "source": {
            "title": "NASA CCMC DONKI, Solar Energetic Particle (SEP) events",
            "urls": [url],
            "citation": "DONKI is provided as is, at prototyping quality and in a research context; no NASA endorsement (https://ccmc.gsfc.nasa.gov/tools/DONKI/).",
            "retrieved": RETRIEVED,
        },
        "note": "Measured near Earth. Arrival at Mars is not claimed. Replayed as a scenario.",
    }


def write_json(path, obj):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w") as fh:
        json.dump(obj, fh, indent=2)
        fh.write("\n")


def main(argv=None):
    ap = argparse.ArgumentParser(description="Cut one sol of REMS, RAD and DONKI data.")
    ap.add_argument("--sol", type=int, required=True)
    ap.add_argument("--rems-tab", required=True)
    ap.add_argument("--rems-xml", help="PDS4 label, used to cross-check column names")
    ap.add_argument("--rad-txt", required=True)
    ap.add_argument("--feed-json", required=True, help="raw image feed answer for the sol")
    ap.add_argument("--donki-json", required=True)
    ap.add_argument("--rems-url", required=True)
    ap.add_argument("--rad-url", required=True)
    ap.add_argument("--donki-url", required=True)
    ap.add_argument("--out-dir", required=True)
    ap.add_argument("--min-hours", type=int, default=20)
    ap.add_argument("--check-only", action="store_true",
                    help="print hour coverage and stop (used to choose the sol)")
    args = ap.parse_args(argv)

    if args.rems_xml:
        diffs = check_label(rems_label_names(args.rems_xml))
        print("label differences:", diffs if diffs else "none")

    hours = rems_hours(read_rems(args.rems_tab), args.sol)
    cover = {f: hours_with_data(hours, f) for f in FIELD_ORDER}
    print("hours with data:", cover)
    if cover["ground_brightness_temp_c"] < args.min_hours:
        print("sol rejected: fewer than %d hours with ground temperature" % args.min_hours)
        return 2
    if args.check_only:
        return 0

    with open(args.feed_json) as fh:
        feed = json.load(fh)
    items = feed.get("items") or []
    taken = str(items[0].get("date_taken", "")) if items else ""
    if not re.match(r"^\d{4}-\d{2}-\d{2}T", taken) or str(items[0].get("sol")) != str(args.sol):
        print("no Earth date for this sol in the feed answer")
        return 3
    earth_date = taken[:10]

    with open(args.rad_txt, errors="replace") as fh:
        lines = fh.read().split("\n")
    observations = rad_observations(lines, args.sol)
    with open(args.donki_json) as fh:
        events = json.load(fh)

    urls = [u for u in args.rems_url.split(",") if u]
    write_json(os.path.join(args.out_dir, "conditions.json"),
               build_conditions_json(args.sol, earth_date, hours, urls))
    write_json(os.path.join(args.out_dir, "dose.json"),
               build_dose_json(args.sol, observations, rad_url=args.rad_url))
    write_json(os.path.join(args.out_dir, "sep-event.json"),
               build_sep_json(events, args.donki_url))
    print("written to", args.out_dir, "earth_date", earth_date, "dose obs", len(observations))
    return 0


if __name__ == "__main__":
    sys.exit(main())
