# AI-written (Claude, Anthropic) for the team's NASA Space Apps 2026 project.
"""Copy check for everything a reader sees.

Run as: python3 -I tools/check_copy.py
Scans app/src, app/index.html, app/README.md and app/public/data/*.json. Fails on:
- an em-dash character anywhere;
- the word "placeholder" inside a string or template text of app/src/ui/** or inside app/index.html (identifiers,
  comments and JSON keys are allowed);
- "true colour" or "true color" (also hyphenated) with no "not a" before it;
- "tested with astronauts" with no "not" before it;
- a NASA logo reference (a logo, meatball or worm word, or such a file name) with no "no" before it;
- a claim of who chose the walk inputs ("set by the team", "team input", ...) in code text, app/layers.json or the
  README: stations, tasks and values are labelled "assumption", never attributed.
Exit 0 = pass, exit 1 = at least one failure (file:line).
"""
import glob
import os
import re
import sys

PROJECT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
APP = os.path.join(PROJECT, "app")
DASH = chr(0x2014)
TEXT_EXT = {".js", ".mjs", ".css", ".html", ".svg", ".json", ".md", ".txt"}

TRUE_COLOUR = re.compile(r"true[- ]colou?r", re.I)
ASTRONAUTS = re.compile(r"tested with astronauts", re.I)
LOGO = re.compile(r"nasa[ _-]?(?:logo|meatball|worm|insignia)|(?:meatball|nasa[\w-]*logo)[\w-]*\.(?:svg|png|jpe?g|webp)", re.I)
TEAM_CLAIM = re.compile(r"(?:set|chosen|picked|written|placed|marked|drawn) by (?:the |a )?team|team input|team member sets", re.I)
STRING = re.compile(r"\"(?:\\.|[^\"\\\n])*\"|'(?:\\.|[^'\\\n])*'|`(?:\\.|[^`\\])*`", re.S)


def files():
    for d, dirs, names in os.walk(os.path.join(APP, "src")):
        dirs[:] = [x for x in dirs if x not in {"node_modules"}]
        for n in sorted(names):
            if os.path.splitext(n)[1].lower() in TEXT_EXT:
                yield os.path.join(d, n)
    for extra in (os.path.join(APP, "index.html"), os.path.join(APP, "README.md"), os.path.join(APP, "layers.json")):
        if os.path.exists(extra):
            yield extra
    for p in sorted(glob.glob(os.path.join(APP, "public", "data", "*.json"))):
        yield p


def blank(m):
    return re.sub(r"[^\n]", " ", m.group(0))


def strip_comments(text, ext):
    if ext == ".html":
        return re.sub(r"<!--.*?-->", blank, text, flags=re.S)
    out = re.sub(r"/\*.*?\*/", blank, text, flags=re.S)
    if ext in {".js", ".mjs"}:
        out = re.sub(r"(?m)^\s*//.*$", blank, out)
    return out


def line_of(text, pos):
    return text.count("\n", 0, pos) + 1


def before(text, pos, n=12):
    return text[max(0, pos - n):pos].lower()


def main():
    fails = []
    for p in files():
        rel = os.path.relpath(p, PROJECT)
        ext = os.path.splitext(p)[1].lower()
        in_ui = "/app/src/ui/" in p.replace(os.sep, "/")
        is_index = os.path.basename(p) == "index.html" and os.path.dirname(p) == APP
        with open(p, encoding="utf-8") as f:
            raw = f.read()
        for m in re.finditer(DASH, raw):
            fails.append("%s:%d em-dash" % (rel, line_of(raw, m.start())))
        for m in TRUE_COLOUR.finditer(raw):
            if not before(raw, m.start(), 6).endswith("not a "):
                fails.append("%s:%d true colour without 'not a' before it" % (rel, line_of(raw, m.start())))
        for m in ASTRONAUTS.finditer(raw):
            if "not " not in before(raw, m.start(), 6):
                fails.append("%s:%d 'tested with astronauts' without 'not' before it" % (rel, line_of(raw, m.start())))
        for m in LOGO.finditer(raw):
            if not before(raw, m.start(), 4).endswith("no "):
                fails.append("%s:%d NASA logo reference" % (rel, line_of(raw, m.start())))
        code = strip_comments(raw, ext)
        for m in TEAM_CLAIM.finditer(code):
            fails.append("%s:%d attributes a walk input to the team" % (rel, line_of(code, m.start())))
        if is_index:
            for m in re.finditer(r"placeholder", code, re.I):
                fails.append("%s:%d the word placeholder in index.html" % (rel, line_of(code, m.start())))
        elif in_ui and ext in {".js", ".mjs"}:
            for s in STRING.finditer(code):
                if re.search(r"placeholder", s.group(0), re.I):
                    fails.append("%s:%d the word placeholder in a UI string" % (rel, line_of(code, s.start())))
    if fails:
        for msg in fails:
            print("FAIL " + msg)
        return 1
    print("check_copy: all checks pass")
    return 0


if __name__ == "__main__":
    sys.exit(main())
