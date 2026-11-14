# AI-written (Claude, Anthropic) for the team's NASA Space Apps 2026 project.
"""Download PIA26559 and write two resized WebP files for the station card.

Run as: tools/.venv/bin/python -I tools/fetch_panorama.py
The raw JPEG is untrusted data: it stays outside the repository.
"""
import json
import os
import sys
import urllib.request

from PIL import Image

RAW_DIR = "/Users/ardasarikaya/marswalk-data-raw/panorama"
RAW_FILE = os.path.join(RAW_DIR, "PIA26559.jpg")
URL = ("https://assets.science.nasa.gov/content/dam/science/psd/photojournal/"
       "pia/pia26/pia26559/PIA26559.jpg")
PAGE = "https://science.nasa.gov/photojournal/curiositys-first-360-degree-view-of-boxwork-patterns/"
PROJECT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(PROJECT, "app", "public", "media")
WIDTHS = (4096, 1024)

# The catalogue lists a 36.35 MB JPEG. Pillow's default limit would only warn,
# so the ceiling is set for this one known file, with room for a wide panorama.
Image.MAX_IMAGE_PIXELS = 400_000_000


def download():
    os.makedirs(RAW_DIR, exist_ok=True)
    if os.path.exists(RAW_FILE) and os.path.getsize(RAW_FILE) > 1_000_000:
        return
    tmp = RAW_FILE + ".part"
    with urllib.request.urlopen(URL, timeout=120) as r, open(tmp, "wb") as f:
        while True:
            chunk = r.read(1 << 20)
            if not chunk:
                break
            f.write(chunk)
    os.replace(tmp, RAW_FILE)


def main():
    download()
    with open(RAW_FILE, "rb") as f:
        if f.read(3) != b"\xff\xd8\xff":
            sys.exit("raw file is not a JPEG")
    os.makedirs(OUT_DIR, exist_ok=True)
    img = Image.open(RAW_FILE)
    if img.format != "JPEG":
        sys.exit("raw file is not a JPEG")
    img.load()
    img = img.convert("RGB")
    src_w, src_h = img.size
    credits = []
    for w in WIDTHS:
        if w >= src_w:
            sys.exit("source is not wider than %d px" % w)
        h = round(src_h * w / src_w)
        out = img.resize((w, h), Image.LANCZOS)
        name = "pia26559_%d.webp" % w
        out.save(os.path.join(OUT_DIR, name), "WEBP", quality=85, method=6)
        credits.append({
            "file": name,
            "title": "PIA26559 Curiosity's First 360-Degree View of Boxwork Patterns",
            "credit": "NASA/JPL-Caltech/MSSS",
            "page_url": PAGE,
            "source_url": URL,
            "change": "resized",
            "width_px": w,
            "height_px": h,
            "note": "Resized only, no other change. NASA does not endorse this project.",
        })
    with open(os.path.join(OUT_DIR, "credits.json"), "w") as f:
        json.dump(credits, f, indent=2)
        f.write("\n")
    print("source %d x %d px; wrote %d files" % (src_w, src_h, len(credits)))


if __name__ == "__main__":
    main()
