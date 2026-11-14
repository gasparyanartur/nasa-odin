# AI-written (Claude, Anthropic) for the team's NASA Space Apps 2026 project.
"""Consistency check for the README, sources.json, layers.json and vendored files.

Run as: python3 -I tools/check_readme.py [--final]
--final also fails on any "PENDING" left in app/ text files and sources.
Exit 0 = all checks pass, exit 1 = at least one failure.
"""
import hashlib
import json
import os
import re
import sys

PROJECT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
APP = os.path.join(PROJECT, "app")
TOOLS = os.path.join(PROJECT, "tools")
DASH = chr(0x2014)
LAYER_IDS = ["image", "height", "slope", "thermal", "atmosphere", "radiation",
             "space_weather", "rover_path", "stations", "no_go", "drill_sites"]
HEADINGS = ["What it is", "Run it locally", "Layers", "Sources and licences",
            "Credits", "Assumptions", "Walk inputs", "Reproduce every screen", "Known limits",
            "Design model", "Interface rules", "AI use", "Project licence",
            "Rebuild the data"]
TEXT_EXT = {".md", ".json", ".js", ".css", ".html", ".py", ".txt", ".svg", ".mjs", ""}
# vendor/ holds third-party files copied unchanged; data and media are generated.
SKIP_DIRS = {"vendor", "node_modules", ".venv", "__pycache__", "data", "data-mock", "media"}

fails = []


def fail(msg):
    fails.append(msg)


def text_files(root):
    for d, dirs, files in os.walk(root):
        dirs[:] = [x for x in dirs if x not in SKIP_DIRS]
        for n in files:
            if os.path.splitext(n)[1].lower() in TEXT_EXT:
                yield os.path.join(d, n)


def load_json(path):
    try:
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    except (OSError, ValueError) as e:
        fail("cannot read %s: %s" % (os.path.relpath(path, PROJECT), e))
        return None


def main():
    final = "--final" in sys.argv[1:]
    try:
        with open(os.path.join(APP, "README.md"), encoding="utf-8") as f:
            readme = f.read()
    except OSError as e:
        print("FAIL cannot read README: %s" % e)
        return 1

    sources = load_json(os.path.join(APP, "sources.json")) or []
    layers = load_json(os.path.join(APP, "layers.json")) or []

    # sources: every id in the README, licence and credit present, ids unique
    ids = [s.get("id") for s in sources]
    if len(ids) != len(set(ids)):
        fail("duplicate ids in sources.json")
    for s in sources:
        sid = s.get("id")
        if not sid:
            fail("a sources.json row has no id")
            continue
        if sid not in readme:
            fail("source id %s is not in the README" % sid)
        for key in ("title", "provider", "url", "licence", "credit", "used_for"):
            if not str(s.get(key, "")).strip():
                fail("source %s has an empty %s" % (sid, key))
        if not isinstance(s.get("layer"), bool):
            fail("source %s: layer must be true or false" % sid)
    if "font" not in ids:
        fail('sources.json has no row with id "font"')

    # layers: ids, units, source ids, README table and count
    lids = [l.get("id") for l in layers]
    if lids != LAYER_IDS:
        fail("layers.json ids differ from the 11 required ids, in order")
    used = set()
    for l in layers:
        for key in ("label", "unit", "kind"):
            if not str(l.get(key, "")).strip():
                fail("layer %s has an empty %s" % (l.get("id"), key))
        if l.get("kind") not in ("map", "panel"):
            fail("layer %s: kind must be map or panel" % l.get("id"))
        for sid in l.get("source_ids", []):
            used.add(sid)
            if sid not in ids:
                fail("layer %s names unknown source %s" % (l.get("id"), sid))
        if "`%s`" % l.get("id") not in readme:
            fail("layer %s is not in the README table" % l.get("id"))
    flagged = {s.get("id") for s in sources if s.get("layer") is True}
    if flagged != used:
        fail("sources with layer true differ from the sources named by layers.json: %s"
             % sorted(flagged ^ used))
    m = re.search(r"^Layer count:\s*(\d+)\s*$", readme, re.M)
    if not m:
        fail('README has no "Layer count: N" line')
    elif int(m.group(1)) != len(layers):
        fail("README layer count %s differs from layers.json count %d"
             % (m.group(1), len(layers)))
    rows = re.findall(r"^\| `([a-z_]+)` \|", readme, re.M)
    table_rows = [r for r in rows if r in LAYER_IDS]
    if len(table_rows) != len(layers):
        fail("README layer table has %d rows, layers.json has %d"
             % (len(table_rows), len(layers)))

    # headings
    found = {h.strip() for h in re.findall(r"^#{1,3}\s+(.+)$", readme, re.M)}
    for h in HEADINGS:
        if h not in found:
            fail("README section missing: %s" % h)

    # licence files
    for name in ("LICENSE", "DATA-LICENSE.md"):
        if not os.path.exists(os.path.join(APP, name)):
            fail("missing app/%s" % name)

    # vendored three.js: SHA-256 in VERSION.md matches the files
    vpath = os.path.join(APP, "vendor", "three", "VERSION.md")
    try:
        with open(vpath, encoding="utf-8") as f:
            version = f.read()
        pairs = re.findall(r"^\| `([^`]+)` \| `([0-9a-f]{64})` \|", version, re.M)
        if not pairs:
            fail("VERSION.md lists no SHA-256 values")
        for rel, want in pairs:
            p = os.path.join(APP, "vendor", "three", rel)
            try:
                with open(p, "rb") as f:
                    got = hashlib.sha256(f.read()).hexdigest()
            except OSError:
                fail("vendored file missing: %s" % rel)
                continue
            if got != want:
                fail("SHA-256 mismatch for %s" % rel)
    except OSError:
        fail("missing app/vendor/three/VERSION.md")

    # em-dash and (final only) PENDING in text files
    for root in (APP, TOOLS):
        for p in text_files(root):
            try:
                with open(p, encoding="utf-8") as f:
                    body = f.read()
            except (OSError, UnicodeDecodeError):
                continue
            rel = os.path.relpath(p, PROJECT)
            if DASH in body:
                fail("em-dash in %s" % rel)
            if final and "PENDING" in body and os.path.basename(p) != "check_readme.py":
                fail("PENDING left in %s" % rel)

    if fails:
        for msg in fails:
            print("FAIL " + msg)
        return 1
    print("check_readme: all checks pass%s" % (" (final)" if final else ""))
    return 0


if __name__ == "__main__":
    sys.exit(main())
