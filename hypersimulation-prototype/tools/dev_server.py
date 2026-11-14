# AI-written (Claude, Anthropic) for the team's NASA Space Apps 2026 project.
"""Local static server for app/. Standard library only. Binds 127.0.0.1 and nothing else.

--throttle-kbps N paces the response body to N kilobit per second (10000 gives a 10 Mbit/s line).
--fail SUBSTRING answers 404 for every path containing it (repeatable), to test the error screen.
"""
import argparse
import gzip
import mimetypes
import sys
import time
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlsplit

ROOT = (Path(__file__).resolve().parent.parent / "app").resolve()
GZIP_TYPES = {".js", ".mjs", ".css", ".json", ".html", ".bin"}
MIME = {
    ".js": "text/javascript; charset=utf-8",
    ".mjs": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".html": "text/html; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".webp": "image/webp",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".svg": "image/svg+xml",
    ".woff2": "font/woff2",
    ".bin": "application/octet-stream",
    ".md": "text/plain; charset=utf-8",
}
CHUNK = 16 * 1024
GZIP_CACHE = {}


def resolve(url_path):
    """Map a URL path to a file inside ROOT, or None. A folder maps to its index.html. No listing."""
    rel = unquote(urlsplit(url_path).path).lstrip("/")
    if "\x00" in rel or any(part.startswith(".") for part in rel.split("/") if part):
        return None
    target = (ROOT / rel).resolve()
    if target != ROOT and ROOT not in target.parents:
        return None
    if target.is_dir():
        target = target / "index.html"
    return target if target.is_file() else None


def gzipped(path, raw):
    key = (str(path), path.stat().st_mtime_ns, len(raw))
    if key not in GZIP_CACHE:
        GZIP_CACHE[key] = gzip.compress(raw, 6, mtime=0)
    return GZIP_CACHE[key]


class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"
    fail = []
    kbps = 0

    def log_message(self, fmt, *args):
        sys.stderr.write("%s %s\n" % (self.command, self.path))

    def send_plain(self, status, text):
        body = text.encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "text/plain; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        if self.command != "HEAD":
            self.send_body(body)

    def send_body(self, body):
        step = CHUNK
        delay = 0.0
        if self.kbps:
            delay = CHUNK / (self.kbps * 1000 / 8)
        for i in range(0, len(body), step):
            self.wfile.write(body[i:i + step])
            if delay:
                time.sleep(delay)

    def do_HEAD(self):
        self.serve()

    def do_GET(self):
        self.serve()

    def do_other(self):
        self.send_response(HTTPStatus.METHOD_NOT_ALLOWED)
        self.send_header("Allow", "GET, HEAD")
        self.send_header("Content-Length", "0")
        self.end_headers()

    do_POST = do_PUT = do_DELETE = do_PATCH = do_OPTIONS = do_other

    def serve(self):
        try:
            self.serve_file()
        except (BrokenPipeError, ConnectionResetError):
            self.close_connection = True

    def serve_file(self):
        path = urlsplit(self.path).path
        if any(s in path for s in self.fail):
            return self.send_plain(HTTPStatus.NOT_FOUND, "Not found (blocked by --fail)")
        target = resolve(self.path)
        if target is None:
            return self.send_plain(HTTPStatus.NOT_FOUND, "Not found")
        raw = target.read_bytes()
        suffix = target.suffix.lower()
        body = raw
        encoding = None
        if suffix in GZIP_TYPES and "gzip" in self.headers.get("Accept-Encoding", "").lower():
            body = gzipped(target, raw)
            encoding = "gzip"
        ctype = MIME.get(suffix) or mimetypes.guess_type(target.name)[0] or "application/octet-stream"
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        if suffix in GZIP_TYPES:
            self.send_header("Vary", "Accept-Encoding")
        if encoding:
            self.send_header("Content-Encoding", encoding)
        self.end_headers()
        if self.command != "HEAD":
            self.send_body(body)


def main():
    ap = argparse.ArgumentParser(description="Serve the app folder on 127.0.0.1.")
    ap.add_argument("--port", type=int, default=8642)
    ap.add_argument("--throttle-kbps", type=int, default=0, help="pace the body to N kilobit per second")
    ap.add_argument("--fail", action="append", default=[], metavar="PATH_SUBSTRING", help="answer 404 for matching paths")
    args = ap.parse_args()
    if args.throttle_kbps < 0:
        ap.error("--throttle-kbps must be 0 or more")
    Handler.kbps = args.throttle_kbps
    Handler.fail = [s for s in args.fail if s]
    server = ThreadingHTTPServer(("127.0.0.1", args.port), Handler)
    print(f"serving {ROOT} on http://127.0.0.1:{args.port}/", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
