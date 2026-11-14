# AI-written (Claude, Anthropic) for the team's NASA Space Apps 2026 project.
"""Offline check: the app must not request any outside address at run time.

Run as: python3 -I tools/check_offline.py
Scans app/index.html and app/src (JS, CSS, HTML). app/design and app/vendor are skipped. Data files
(app/public/data/*.json, app/sources.json, app/layers.json, app/public/media/credits.json) may hold URLs as text.
Fails on an absolute http(s) address outside an href attribute, and on fetch(, import(, new Worker( or src=
with an absolute address. Exit 0 = pass, exit 1 = at least one failure (file:line).
"""
import os
import re
import sys

PROJECT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
APP = os.path.join(PROJECT, "app")
EXT = {".js", ".mjs", ".css", ".html"}
URL = re.compile(r"(?:https?:)?//[A-Za-z0-9.-]+\.[A-Za-z]{2,}[^\s\"'`)>]*|https?://[^\s\"'`)>]+")
ABS = r"""\s*['"`]\s*(?:https?:)?//"""
CALLS = [
    (re.compile(r"\bfetch\(" + ABS), "fetch( with an absolute address"),
    (re.compile(r"\bimport\(" + ABS), "import( with an absolute address"),
    (re.compile(r"\bnew\s+(?:Shared)?Worker\(" + ABS), "new Worker( with an absolute address"),
    (re.compile(r"\bsrc\s*=\s*['\"]?\s*(?:https?:)?//"), "src= with an absolute address"),
]
# XML namespace names are identifiers, not addresses the browser requests.
NAMESPACES = ("http://www.w3.org/2000/svg", "http://www.w3.org/1999/xlink", "http://www.w3.org/1999/xhtml")
HREF = re.compile(r"""\bhref\s*=\s*(?:"[^"]*"|'[^']*')""")


def files():
    index = os.path.join(APP, "index.html")
    if os.path.exists(index):
        yield index
    for d, dirs, names in os.walk(os.path.join(APP, "src")):
        dirs[:] = [x for x in dirs if x not in {"design", "vendor", "node_modules"}]
        for n in sorted(names):
            if os.path.splitext(n)[1].lower() in EXT:
                yield os.path.join(d, n)


def blank_comments(text, ext):
    # Keeps line numbers: comment text becomes spaces. A URL named in a comment is documentation, not a request.
    if ext == ".html":
        return re.sub(r"<!--.*?-->", lambda m: re.sub(r"[^\n]", " ", m.group(0)), text, flags=re.S)
    out = re.sub(r"/\*.*?\*/", lambda m: re.sub(r"[^\n]", " ", m.group(0)), text, flags=re.S)
    if ext in {".js", ".mjs"}:
        out = re.sub(r"(?m)^\s*//.*$", lambda m: " " * len(m.group(0)), out)
    return out


def main():
    fails = []
    for p in files():
        rel = os.path.relpath(p, PROJECT)
        with open(p, encoding="utf-8") as f:
            text = blank_comments(f.read(), os.path.splitext(p)[1].lower())
        for no, line in enumerate(text.split("\n"), 1):
            for rx, what in CALLS:
                if rx.search(line):
                    fails.append("%s:%d %s" % (rel, no, what))
            probe = HREF.sub("", line)
            for ns in NAMESPACES:
                probe = probe.replace(ns, "")
            for m in URL.finditer(probe):
                fails.append("%s:%d absolute address outside an href: %s" % (rel, no, m.group(0)[:80]))
    if fails:
        for msg in fails:
            print("FAIL " + msg)
        return 1
    print("check_offline: all checks pass")
    return 0


if __name__ == "__main__":
    sys.exit(main())
