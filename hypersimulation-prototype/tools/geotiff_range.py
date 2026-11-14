"""Read windows of a remote GeoTIFF through HTTP range requests.

AI-written (Claude, Anthropic) for the team's NASA Space Apps 2026 project.

Supports classic TIFF and BigTIFF, tiled and stripped layouts, compression
1 (none), 5 (LZW), 7 (JPEG, through Pillow, with JPEGTables), 8 and 32946
(Deflate), 32773 (PackBits), predictors 1, 2 and 3, and the equirectangular
(CT_Equirectangular = 17) or geographic georeference.

Pixel coordinates: (col, row) are continuous, with integer values on pixel
corners. Pixel (c, r) covers [c, c + 1] x [r, r + 1]; its centre is
(c + 0.5, r + 0.5).
"""

import bisect
import io
import math
import os
import re
import struct
import threading
import time
import urllib.request
import zlib
from concurrent.futures import ThreadPoolExecutor

import numpy as np

USER_AGENT = "marswalk-tools/0.1 (range reader)"
MAX_CONNECTIONS = 8
MERGE_GAP = 64 * 1024
MERGE_MAX = 32 * 1024 * 1024
LAZY_THRESHOLD = 64 * 1024

TYPE_INFO = {
    1: ("B", 1), 2: ("c", 1), 3: ("H", 2), 4: ("I", 4), 5: ("II", 8),
    6: ("b", 1), 7: ("B", 1), 8: ("h", 2), 9: ("i", 4), 10: ("ii", 8),
    11: ("f", 4), 12: ("d", 8), 13: ("I", 4), 16: ("Q", 8), 17: ("q", 8), 18: ("Q", 8),
}

TAG_NAMES = {
    254: "NewSubfileType", 256: "ImageWidth", 257: "ImageLength", 258: "BitsPerSample",
    259: "Compression", 262: "PhotometricInterpretation", 273: "StripOffsets",
    277: "SamplesPerPixel", 278: "RowsPerStrip", 279: "StripByteCounts",
    284: "PlanarConfiguration", 305: "Software", 306: "DateTime", 317: "Predictor",
    320: "ColorMap", 322: "TileWidth", 323: "TileLength", 324: "TileOffsets",
    325: "TileByteCounts", 338: "ExtraSamples", 339: "SampleFormat", 347: "JPEGTables",
    530: "YCbCrSubSampling", 33550: "ModelPixelScale", 33922: "ModelTiepoint",
    34264: "ModelTransformation", 34735: "GeoKeyDirectory", 34736: "GeoDoubleParams",
    34737: "GeoAsciiParams", 42112: "GDAL_METADATA", 42113: "GDAL_NODATA",
}

GEOKEY_NAMES = {
    1024: "GTModelTypeGeoKey", 1025: "GTRasterTypeGeoKey", 1026: "GTCitationGeoKey",
    2048: "GeographicTypeGeoKey", 2049: "GeogCitationGeoKey", 2050: "GeogGeodeticDatumGeoKey",
    2051: "GeogPrimeMeridianGeoKey", 2052: "GeogLinearUnitsGeoKey", 2054: "GeogAngularUnitsGeoKey",
    2056: "GeogEllipsoidGeoKey", 2057: "GeogSemiMajorAxisGeoKey", 2058: "GeogSemiMinorAxisGeoKey",
    2059: "GeogInvFlatteningGeoKey", 2061: "GeogPrimeMeridianLongGeoKey",
    3072: "ProjectedCSTypeGeoKey", 3073: "PCSCitationGeoKey", 3074: "ProjectionGeoKey",
    3075: "ProjCoordTransGeoKey", 3076: "ProjLinearUnitsGeoKey", 3078: "ProjStdParallel1GeoKey",
    3079: "ProjStdParallel2GeoKey", 3080: "ProjNatOriginLongGeoKey", 3081: "ProjNatOriginLatGeoKey",
    3082: "ProjFalseEastingGeoKey", 3083: "ProjFalseNorthingGeoKey",
    3084: "ProjFalseOriginLongGeoKey", 3085: "ProjFalseOriginLatGeoKey",
    3088: "ProjCenterLongGeoKey", 3089: "ProjCenterLatGeoKey", 3092: "ProjScaleAtNatOriginGeoKey",
    4096: "VerticalCSTypeGeoKey", 4099: "VerticalUnitsGeoKey",
}

CHUNK_TAGS = (273, 279, 324, 325)
SUPPORTED_COMPRESSION = (1, 5, 7, 8, 32773, 32946)


def cap(text, n=300):
    """Shorten untrusted text before it is printed."""
    text = str(text)
    return text if len(text) <= n else text[:n] + "...[cut]"


# ---------------------------------------------------------------- byte sources

class MemorySource:
    """Byte source over an in-memory buffer (tests)."""

    def __init__(self, data):
        self.data = bytes(data)
        self.size = len(self.data)
        self.bytes_fetched = 0
        self.requests = 0

    def read_ranges(self, ranges):
        out = []
        for off, n in ranges:
            if off < 0 or off + n > self.size:
                raise ValueError("range outside the buffer")
            out.append(self.data[off:off + n])
        return out


class HttpSource:
    """Byte source over HTTP range requests with an on-disk raw byte cache."""

    def __init__(self, url, cache_dir, timeout=60):
        self.url = self._resolve(url, timeout)
        self.timeout = timeout
        name = re.sub(r"[^A-Za-z0-9._-]", "_", self.url.rsplit("/", 1)[-1])
        self.cache_dir = os.path.join(cache_dir, "tiff", name)
        os.makedirs(self.cache_dir, exist_ok=True)
        self.bytes_fetched = 0
        self.requests = 0
        self._lock = threading.Lock()
        self._segments = []
        for fn in os.listdir(self.cache_dir):
            m = re.fullmatch(r"(\d+)_(\d+)\.bin", fn)
            if m:
                self._segments.append((int(m.group(1)), int(m.group(2))))
        self._segments.sort()
        self._starts = [s for s, _ in self._segments]

    def _resolve(self, url, timeout):
        req = urllib.request.Request(url, method="HEAD", headers={"User-Agent": USER_AGENT})
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            final = resp.geturl()
            accept = resp.headers.get("Accept-Ranges", "")
            self.size = int(resp.headers["Content-Length"])
            self.headers = {k: cap(v, 120) for k, v in resp.headers.items()}
        if accept.strip().lower() != "bytes":
            raise RuntimeError("server does not offer Accept-Ranges: bytes for " + cap(final))
        return final

    def _covering(self, off, n):
        # Earlier segments can be longer than later ones, so scan every segment that starts at or before off.
        i = bisect.bisect_right(self._starts, off) - 1
        while i >= 0:
            s, ln = self._segments[i]
            if off + n <= s + ln:
                return s, ln
            i -= 1
        return None

    def _read_cached(self, seg, off, n):
        seg_start, ln = seg
        path = os.path.join(self.cache_dir, "%d_%d.bin" % (seg_start, ln))
        with open(path, "rb") as fh:
            fh.seek(off - seg_start)
            data = fh.read(n)
        if len(data) != n:
            raise IOError("cache file shorter than expected: " + path)
        return data

    def _fetch(self, off, n):
        last_err = None
        for attempt in range(4):
            try:
                req = urllib.request.Request(self.url, headers={
                    "User-Agent": USER_AGENT, "Range": "bytes=%d-%d" % (off, off + n - 1)})
                with urllib.request.urlopen(req, timeout=self.timeout) as resp:
                    if resp.status != 206:
                        raise IOError("expected HTTP 206, got %d" % resp.status)
                    cr = resp.headers.get("Content-Range", "")
                    if not cr.startswith("bytes %d-%d/" % (off, off + n - 1)):
                        raise IOError("unexpected Content-Range " + cap(cr, 80))
                    data = resp.read()
                if len(data) != n:
                    raise IOError("short read %d of %d" % (len(data), n))
                break
            except Exception as err:  # retry transient network errors
                last_err = err
                time.sleep(1.5 * (attempt + 1))
        else:
            raise IOError("range fetch failed after retries: %s" % last_err)
        path = os.path.join(self.cache_dir, "%d_%d.bin" % (off, n))
        tmp = path + ".part"
        with open(tmp, "wb") as fh:
            fh.write(data)
        os.replace(tmp, path)
        with self._lock:
            self.bytes_fetched += n
            self.requests += 1
            i = bisect.bisect_left(self._starts, off)
            self._starts.insert(i, off)
            self._segments.insert(i, (off, n))
        return data

    def read_ranges(self, ranges):
        missing = []
        for off, n in ranges:
            if n <= 0:
                continue
            if off < 0 or off + n > self.size:
                raise ValueError("range outside the remote file")
            if self._covering(off, n) is None:
                missing.append((off, off + n))
        merged = merge_ranges(missing)
        if merged:
            with ThreadPoolExecutor(max_workers=MAX_CONNECTIONS) as pool:
                list(pool.map(lambda r: self._fetch(r[0], r[1] - r[0]), merged))
        out = []
        for off, n in ranges:
            if n <= 0:
                out.append(b"")
                continue
            seg = self._covering(off, n)
            out.append(self._read_cached(seg, off, n))
        return out


def merge_ranges(spans, gap=MERGE_GAP, max_len=MERGE_MAX):
    """Merge [start, end) spans that touch or lie within `gap` bytes, up to `max_len` each."""
    out = []
    for s, e in sorted(spans):
        if out and s - out[-1][1] <= gap and max(e, out[-1][1]) - out[-1][0] <= max_len:
            out[-1][1] = max(out[-1][1], e)
        else:
            out.append([s, e])
    return [(s, e) for s, e in out]


# ---------------------------------------------------------------- decoders

def lzw_decode_py(data):
    """TIFF LZW (MSB first, early change). Pure Python reference."""
    buf = bytes(data) + b"\x00\x00\x00\x00"
    nbits = len(data) * 8
    pos = 0
    width = 9
    table = [bytes([i]) for i in range(256)] + [b"", b""]
    out = []
    prev = None
    while pos + width <= nbits:
        i = pos >> 3
        code = (int.from_bytes(buf[i:i + 4], "big") >> (32 - (pos & 7) - width)) & ((1 << width) - 1)
        pos += width
        if code == 257:
            break
        if code == 256:
            table = table[:258]
            width = 9
            prev = None
            continue
        if prev is None:
            entry = table[code]
            out.append(entry)
            prev = entry
            continue
        if code < len(table):
            entry = table[code]
            table.append(prev + entry[:1])
        else:
            entry = prev + prev[:1]
            table.append(entry)
        out.append(entry)
        prev = entry
        n = len(table)
        if n >= 2047:
            width = 12
        elif n >= 1023:
            width = 11
        elif n >= 511:
            width = 10
    return b"".join(out)


def _tiny_tiff(payload, nbytes, compression):
    """A one-row 8-bit TIFF whose only strip is `payload`, so libtiff decodes it."""
    entries = [(256, 4, nbytes), (257, 4, 1), (258, 3, 8), (259, 3, compression),
               (262, 3, 1), (273, 4, 0), (277, 3, 1), (278, 4, 1), (279, 4, len(payload))]
    ifd_off = 8
    data_off = ifd_off + 2 + 12 * len(entries) + 4
    ifd = struct.pack("<H", len(entries))
    for tag, typ, val in entries:
        if tag == 273:
            val = data_off
        if typ == 3:
            ifd += struct.pack("<HHIHH", tag, typ, 1, val, 0)
        else:
            ifd += struct.pack("<HHII", tag, typ, 1, val)
    ifd += struct.pack("<I", 0)
    return b"II*\x00" + struct.pack("<I", ifd_off) + ifd + payload


def lzw_decode(data, expected):
    """LZW through Pillow's libtiff when present, else the pure Python decoder."""
    try:
        from PIL import Image, features
        if features.check("libtiff"):
            img = Image.open(io.BytesIO(_tiny_tiff(bytes(data), expected, 5)))
            raw = img.tobytes()
            if len(raw) == expected:
                return raw
    except Exception:
        pass
    return lzw_decode_py(data)


def packbits_decode_py(data):
    out = bytearray()
    i = 0
    n = len(data)
    while i < n:
        h = data[i]
        i += 1
        if h < 128:
            out += data[i:i + h + 1]
            i += h + 1
        elif h > 128:
            if i < n:
                out += bytes([data[i]]) * (257 - h)
            i += 1
    return bytes(out)


def packbits_decode(data, expected):
    from PIL import Image
    try:
        img = Image.frombytes("L", (expected, 1), bytes(data), "packbits", "L")
        return img.tobytes()
    except Exception:
        return packbits_decode_py(data)


def jpeg_decode(data, tables):
    from PIL import Image
    if tables and len(tables) > 4:
        data = bytes(tables[:-2]) + bytes(data[2:])
    img = Image.open(io.BytesIO(data))
    img.draft(None, None)
    return np.asarray(img)


def undo_predictor(raw, predictor, rows, width, spp, bps, dtype):
    """Return a (rows, width, spp) array of `dtype` from decompressed bytes."""
    nb = bps // 8
    if predictor == 3:
        b = np.frombuffer(raw, dtype=np.uint8)[: rows * width * spp * nb].reshape(rows, width * spp * nb)
        b = _cumsum_stride(b, spp)
        b = b.reshape(rows, nb, width * spp).transpose(0, 2, 1)
        arr = np.ascontiguousarray(b).view(np.dtype(dtype).newbyteorder(">"))
        return arr.reshape(rows, width, spp).astype(np.dtype(dtype).newbyteorder("="))
    arr = np.frombuffer(raw, dtype=dtype)[: rows * width * spp].reshape(rows, width, spp)
    if predictor == 2:
        arr = np.cumsum(arr, axis=1, dtype=arr.dtype)
    return arr.astype(np.dtype(dtype).newbyteorder("="))


def _cumsum_stride(b, stride):
    """Byte-wise running sum along each row, modulo 256, with the given sample stride."""
    rows, n = b.shape
    pad = (-n) % stride
    if pad:
        b = np.concatenate([b, np.zeros((rows, pad), np.uint8)], axis=1)
    c = np.cumsum(b.reshape(rows, -1, stride), axis=1, dtype=np.uint8)
    return c.reshape(rows, -1)[:, :n]


# ---------------------------------------------------------------- TIFF structure

class LazyArray:
    """A large tag array (offsets, byte counts) read on demand."""

    def __init__(self, source, endian, typ, count, offset):
        self.source, self.endian, self.typ, self.count, self.offset = source, endian, typ, count, offset
        self.fmt, self.size = TYPE_INFO[typ]

    def get(self, indices):
        indices = sorted(set(int(i) for i in indices))
        spans = merge_ranges([(self.offset + i * self.size, self.offset + (i + 1) * self.size)
                              for i in indices], gap=4096, max_len=8 * 1024 * 1024)
        blobs = self.source.read_ranges([(s, e - s) for s, e in spans])
        out = {}
        j = 0
        for (s, e), blob in zip(spans, blobs):
            first = (s - self.offset) // self.size
            n = (e - s) // self.size
            vals = struct.unpack(self.endian + self.fmt * n, blob)
            while j < len(indices) and indices[j] < first + n:
                out[indices[j]] = vals[indices[j] - first]
                j += 1
        return out


class RemoteTiff:
    def __init__(self, source):
        self.source = source
        head = source.read_ranges([(0, 16)])[0]
        if head[:2] == b"II":
            self.endian = "<"
        elif head[:2] == b"MM":
            self.endian = ">"
        else:
            raise ValueError("not a TIFF file")
        magic = struct.unpack(self.endian + "H", head[2:4])[0]
        if magic == 42:
            self.bigtiff = False
            first = struct.unpack(self.endian + "I", head[4:8])[0]
        elif magic == 43:
            self.bigtiff = True
            first = struct.unpack(self.endian + "Q", head[8:16])[0]
        else:
            raise ValueError("unknown TIFF magic %d" % magic)
        self.ifd_offsets = [first]
        self.tags, nxt = self._read_ifd(first, full=True)
        self.subifds = []
        while nxt and len(self.subifds) < 64:
            t, nxt2 = self._read_ifd(nxt, full=False)
            self.subifds.append({TAG_NAMES.get(k, k): v for k, v in t.items()
                                 if k in (254, 256, 257, 259, 322, 323)})
            self.ifd_offsets.append(nxt)
            nxt = nxt2
        self._setup()

    def open_ifd(self, k):
        """A reader for IFD k of the same file (an overview or mask), with this file's georeference scaled."""
        other = object.__new__(RemoteTiff)
        other.__dict__.update(self.__dict__)
        tags, _ = self._read_ifd(self.ifd_offsets[k], full=True)
        for key in (33550, 33922, 34264, 34735, 34736, 34737, 42113):
            if key in self.tags and key not in tags:
                tags[key] = self.tags[key]
        other.tags = tags
        other._setup()
        if other.affine and other.width != self.width:
            x0, a, b, y0, c, d = self.affine
            fx = self.width / other.width
            fy = self.height / other.height
            other.affine = (x0, a * fx, b * fy, y0, c * fx, d * fy)
        return other

    def _read_ifd(self, off, full):
        e = self.endian
        if self.bigtiff:
            cnt = struct.unpack(e + "Q", self.source.read_ranges([(off, 8)])[0])[0]
            esz, hdr, vsz = 20, 8, 8
        else:
            cnt = struct.unpack(e + "H", self.source.read_ranges([(off, 2)])[0])[0]
            esz, hdr, vsz = 12, 2, 4
        body = self.source.read_ranges([(off + hdr, cnt * esz + vsz)])[0]
        tags = {}
        pending = []
        for k in range(cnt):
            ent = body[k * esz:(k + 1) * esz]
            if self.bigtiff:
                tag, typ, count = struct.unpack(e + "HHQ", ent[:12])
                rawval = ent[12:20]
            else:
                tag, typ, count = struct.unpack(e + "HHI", ent[:8])
                rawval = ent[8:12]
            if typ not in TYPE_INFO:
                continue
            fmt, size = TYPE_INFO[typ]
            total = size * count
            if total <= vsz:
                tags[tag] = self._unpack(typ, count, rawval[:total])
            else:
                voff = struct.unpack(e + ("Q" if self.bigtiff else "I"), rawval)[0]
                if tag in CHUNK_TAGS or total > LAZY_THRESHOLD:
                    tags[tag] = LazyArray(self.source, e, typ, count, voff)
                elif full:
                    pending.append((tag, typ, count, voff, total))
        if pending:
            blobs = self.source.read_ranges([(p[3], p[4]) for p in pending])
            for (tag, typ, count, _, _), blob in zip(pending, blobs):
                tags[tag] = self._unpack(typ, count, blob)
        nxt = struct.unpack(e + ("Q" if self.bigtiff else "I"), body[cnt * esz:cnt * esz + vsz])[0]
        return tags, nxt

    def _unpack(self, typ, count, blob):
        fmt, size = TYPE_INFO[typ]
        if typ == 2:
            return blob.split(b"\x00")[0].decode("latin-1") if b"\x00" in blob else blob.decode("latin-1")
        if typ == 7 or (typ == 1 and count > 16):
            return bytes(blob)
        if typ in (5, 10):
            v = struct.unpack(self.endian + fmt[0] * (2 * count), blob)
            vals = tuple(v[2 * i] / v[2 * i + 1] if v[2 * i + 1] else float("nan") for i in range(count))
        else:
            vals = struct.unpack(self.endian + fmt * count, blob)
        return vals[0] if count == 1 else tuple(vals)

    def _first(self, tag, default=None):
        v = self.tags.get(tag, default)
        if isinstance(v, tuple):
            return v[0]
        return v

    def _setup(self):
        self.width = int(self._first(256))
        self.height = int(self._first(257))
        self.spp = int(self._first(277, 1))
        self.bps = int(self._first(258, 1))
        self.sample_format = int(self._first(339, 1))
        self.compression = int(self._first(259, 1))
        self.predictor = int(self._first(317, 1))
        self.planar = int(self._first(284, 1))
        self.tiled = 322 in self.tags
        if self.tiled:
            self.chunk_w = int(self._first(322))
            self.chunk_h = int(self._first(323))
            self.offsets = self.tags[324]
            self.counts = self.tags[325]
            self.chunks_across = -(-self.width // self.chunk_w)
            self.chunks_down = -(-self.height // self.chunk_h)
        else:
            self.chunk_w = self.width
            self.chunk_h = int(self._first(278, self.height))
            self.offsets = self.tags[273]
            self.counts = self.tags[279]
            self.chunks_across = 1
            self.chunks_down = -(-self.height // self.chunk_h)
        for name in ("offsets", "counts"):
            v = getattr(self, name)
            if not isinstance(v, LazyArray):
                vals = v if isinstance(v, tuple) else (v,)
                setattr(self, name, _ListArray(vals))
        kind = {1: "u", 2: "i", 3: "f"}.get(self.sample_format)
        if kind is None:
            raise ValueError("unsupported SampleFormat %d" % self.sample_format)
        self.dtype = np.dtype("%s%s%d" % (self.endian, kind, self.bps // 8)) if self.bps >= 8 else None
        nod = self.tags.get(42113)
        self.nodata = None
        if isinstance(nod, str) and nod.strip():
            try:
                self.nodata = float(nod.strip())
            except ValueError:
                self.nodata = None
        self.geokeys = self._parse_geokeys()
        self._setup_georef()

    # ------------------------------------------------------------ georeference

    def _parse_geokeys(self):
        d = self.tags.get(34735)
        if not d:
            return {}
        doubles = self.tags.get(34736, ())
        if not isinstance(doubles, tuple):
            doubles = (doubles,)
        ascii_ = self.tags.get(34737, "")
        keys = {}
        n = d[3]
        for k in range(n):
            kid, loc, cnt, val = d[4 + 4 * k:8 + 4 * k]
            if loc == 0:
                keys[kid] = val
            elif loc == 34736:
                v = doubles[val:val + cnt]
                keys[kid] = v[0] if cnt == 1 else tuple(v)
            elif loc == 34737:
                keys[kid] = ascii_[val:val + cnt].rstrip("|")
            elif loc == 34735:
                keys[kid] = tuple(d[val:val + cnt])
        return keys

    def _setup_georef(self):
        gk = self.geokeys
        self.raster_type = gk.get(1025, 1)
        scale = self.tags.get(33550)
        tie = self.tags.get(33922)
        trans = self.tags.get(34264)
        if scale and tie:
            self.affine = (tie[3] - tie[0] * scale[0], scale[0], 0.0,
                           tie[4] + tie[1] * scale[1], 0.0, -scale[1])
        elif trans:
            self.affine = (trans[3], trans[0], trans[1], trans[7], trans[4], trans[5])
        else:
            self.affine = None
        if self.raster_type == 2 and self.affine:
            x0, a, b, y0, c, d = self.affine
            self.affine = (x0 - 0.5 * a - 0.5 * b, a, b, y0 - 0.5 * c - 0.5 * d, c, d)
        self.model_type = gk.get(1024)
        self.proj = None
        if self.model_type == 1:
            ct = gk.get(3075)
            if ct != 17:
                raise NotImplementedError("projection transform %s not supported" % ct)
            a = float(gk.get(2057))
            b = float(gk.get(2058, a))
            inv_f = gk.get(2059)
            if inv_f and float(inv_f) != 0 and 2058 not in gk:
                b = a * (1 - 1 / float(inv_f))
            self.proj = {
                "name": "equirectangular",
                "semi_major_m": a,
                "semi_minor_m": b,
                "lat_ts_deg": float(gk.get(3078, 0.0)),
                "lat0_deg": float(gk.get(3089, gk.get(3081, 0.0))),
                "lon0_deg": float(gk.get(3088, gk.get(3080, 0.0))),
                "false_easting_m": float(gk.get(3082, 0.0)),
                "false_northing_m": float(gk.get(3083, 0.0)),
            }
            unit = gk.get(3076, 9001)
            if unit != 9001:
                raise NotImplementedError("linear unit %s not supported" % unit)
        elif self.model_type == 2:
            self.proj = {"name": "geographic"}
        angular = gk.get(2054, 9102)
        if angular != 9102:
            raise NotImplementedError("angular unit %s not supported" % angular)

    def pixel_to_model(self, col, row):
        x0, a, b, y0, c, d = self.affine
        return x0 + a * col + b * row, y0 + c * col + d * row

    def model_to_pixel(self, x, y):
        x0, a, b, y0, c, d = self.affine
        det = a * d - b * c
        dx, dy = x - x0, y - y0
        return (d * dx - b * dy) / det, (-c * dx + a * dy) / det

    def model_to_lonlat(self, x, y):
        p = self.proj
        if p["name"] == "geographic":
            return x, y
        R = p["semi_major_m"]
        lon = p["lon0_deg"] + math.degrees((x - p["false_easting_m"]) / (R * math.cos(math.radians(p["lat_ts_deg"]))))
        lat = p["lat0_deg"] + math.degrees((y - p["false_northing_m"]) / R)
        return lon, lat

    def lonlat_to_model(self, lon, lat):
        p = self.proj
        if p["name"] == "geographic":
            return lon, lat
        R = p["semi_major_m"]
        x = p["false_easting_m"] + R * math.radians(lon - p["lon0_deg"]) * math.cos(math.radians(p["lat_ts_deg"]))
        y = p["false_northing_m"] + R * math.radians(lat - p["lat0_deg"])
        return x, y

    def pixel_to_lonlat(self, col, row):
        return self.model_to_lonlat(*self.pixel_to_model(col, row))

    def lonlat_to_pixel(self, lon, lat):
        return self.model_to_pixel(*self.lonlat_to_model(lon, lat))

    def lat_type(self):
        p = self.proj or {}
        cit = " ".join(str(self.geokeys.get(k, "")) for k in (1026, 2049, 3073)).lower()
        if "ographic" in cit:
            return "planetographic"
        if p.get("name") == "equirectangular" and abs(p["semi_major_m"] - p["semi_minor_m"]) < 1e-6:
            return "planetocentric"
        if "ocentric" in cit:
            return "planetocentric"
        return "unknown"

    def lon_direction(self):
        """East-positive when pixel columns grow eastward in the model frame."""
        if not self.affine:
            return "unknown"
        return "east" if self.affine[1] > 0 else "west"

    def extent_lonlat(self):
        w, s = self.pixel_to_lonlat(0, self.height)
        e, n = self.pixel_to_lonlat(self.width, 0)
        return {"west": w, "east": e, "south": s, "north": n}

    # ------------------------------------------------------------ windows

    def _chunks_for(self, col0, row0, width, height):
        c_first = max(col0, 0) // self.chunk_w
        c_last = (min(col0 + width, self.width) - 1) // self.chunk_w
        r_first = max(row0, 0) // self.chunk_h
        r_last = (min(row0 + height, self.height) - 1) // self.chunk_h
        out = []
        for tr in range(r_first, r_last + 1):
            for tc in range(c_first, c_last + 1):
                out.append((tr, tc))
        return out

    def _index(self, tr, tc):
        return tr * self.chunks_across + tc

    def estimate_window_bytes(self, col0, row0, width, height):
        chunks = self._chunks_for(col0, row0, width, height)
        counts = self.counts.get([self._index(tr, tc) for tr, tc in chunks])
        return sum(counts.values()), len(chunks)

    def _decode_chunk(self, blob, rows):
        cw = self.chunk_w
        spp = self.spp
        expected = rows * cw * spp * (self.bps // 8)
        comp = self.compression
        if comp == 7:
            arr = jpeg_decode(blob, self.tags.get(347))
            if arr.ndim == 2:
                arr = arr[:, :, None]
            return arr[:rows, :cw, :]
        if comp == 1:
            raw = bytes(blob)
        elif comp == 5:
            raw = lzw_decode(blob, expected)
        elif comp in (8, 32946):
            raw = zlib.decompress(bytes(blob))
        elif comp == 32773:
            raw = packbits_decode(blob, expected)
        else:
            raise NotImplementedError("compression %d not supported" % comp)
        if len(raw) < expected:
            raw = raw + b"\x00" * (expected - len(raw))
        return undo_predictor(raw, self.predictor, rows, cw, spp, self.bps, self.dtype)

    def read_window(self, col0, row0, width, height, fill=None):
        """Return pixels [row0, row0 + height) x [col0, col0 + width).

        Shape (height, width) for one band, else (height, width, bands).
        Pixels outside the image get `fill` (default: the no-data value, else 0).
        """
        if self.planar != 1 and self.spp > 1:
            raise NotImplementedError("PlanarConfiguration 2 not supported")
        if self.compression not in SUPPORTED_COMPRESSION:
            raise NotImplementedError("compression %d not supported" % self.compression)
        if fill is None:
            fill = self.nodata if self.nodata is not None else 0
        out_dtype = self.dtype.newbyteorder("=")
        out = np.full((height, width, self.spp), fill, dtype=out_dtype)
        if col0 >= self.width or row0 >= self.height or col0 + width <= 0 or row0 + height <= 0:
            return out[:, :, 0] if self.spp == 1 else out
        chunks = self._chunks_for(col0, row0, width, height)
        idx = [self._index(tr, tc) for tr, tc in chunks]
        offs = self.offsets.get(idx)
        cnts = self.counts.get(idx)
        ranges = [(offs[i], cnts[i]) for i in idx]
        blobs = self.source.read_ranges(ranges)

        def work(item):
            (tr, tc), blob = item
            rows = self.chunk_h
            if not self.tiled:
                rows = min(self.chunk_h, self.height - tr * self.chunk_h)
            if len(blob) == 0:
                arr = np.full((rows, self.chunk_w, self.spp), fill, dtype=out_dtype)
            else:
                arr = self._decode_chunk(blob, rows)
            y0 = tr * self.chunk_h
            x0 = tc * self.chunk_w
            ys, ye = max(row0, y0), min(row0 + height, y0 + rows, self.height)
            xs, xe = max(col0, x0), min(col0 + width, x0 + self.chunk_w, self.width)
            out[ys - row0:ye - row0, xs - col0:xe - col0] = arr[ys - y0:ye - y0, xs - x0:xe - x0]

        with ThreadPoolExecutor(max_workers=os.cpu_count() or 4) as pool:
            list(pool.map(work, zip(chunks, blobs)))
        return out[:, :, 0] if self.spp == 1 else out

    def bilinear(self, cols, rows, fill=np.nan):
        """Bilinear sample at continuous corner-convention pixel coordinates.

        Interpolates between pixel centres. Any of the four neighbours that is
        no-data makes the result `fill`.
        """
        cols = np.asarray(cols, dtype=np.float64)
        rows = np.asarray(rows, dtype=np.float64)
        u = cols - 0.5
        v = rows - 0.5
        c0 = int(math.floor(np.nanmin(u)))
        r0 = int(math.floor(np.nanmin(v)))
        c1 = int(math.floor(np.nanmax(u))) + 2
        r1 = int(math.floor(np.nanmax(v))) + 2
        win = self.read_window(c0, r0, c1 - c0, r1 - r0).astype(np.float64)
        return bilinear_from_window(win, u - c0, v - r0, self.nodata, fill)

    def describe(self):
        """Header facts for the data check report (numbers and short strings only)."""
        tags = {}
        for k, v in sorted(self.tags.items()):
            name = TAG_NAMES.get(k, str(k))
            if isinstance(v, LazyArray):
                tags[name] = "array of %d (type %d) at offset %d" % (v.count, v.typ, v.offset)
            elif isinstance(v, bytes):
                tags[name] = "%d bytes" % len(v)
            elif isinstance(v, str):
                tags[name] = cap(v)
            elif isinstance(v, tuple) and len(v) > 24:
                tags[name] = "tuple of %d values" % len(v)
            else:
                tags[name] = v
        keys = {GEOKEY_NAMES.get(k, str(k)): (cap(v) if isinstance(v, str) else v)
                for k, v in sorted(self.geokeys.items())}
        return {
            "format": "BigTIFF" if self.bigtiff else "classic TIFF",
            "byte_order": "little" if self.endian == "<" else "big",
            "width": self.width, "height": self.height,
            "layout": ("tiles %d x %d" % (self.chunk_w, self.chunk_h)) if self.tiled
                      else ("strips of %d rows" % self.chunk_h),
            "chunks": self.chunks_across * self.chunks_down,
            "compression": self.compression, "predictor": self.predictor,
            "sample_format": self.sample_format, "bits_per_sample": self.bps,
            "samples_per_pixel": self.spp, "planar": self.planar,
            "nodata": self.nodata, "overviews": self.subifds,
            "geokeys": keys, "projection": self.proj, "affine": self.affine,
            "raster_type": self.raster_type, "lat_type": self.lat_type(),
            "lon_direction": self.lon_direction(),
            "extent_lonlat": self.extent_lonlat() if self.proj and self.affine else None,
            "tags": tags,
        }


class _ListArray:
    def __init__(self, vals):
        self.vals = vals

    def get(self, indices):
        return {int(i): self.vals[int(i)] for i in indices}


def bilinear_from_window(win, u, v, nodata=None, fill=np.nan):
    """Bilinear in a window; (u, v) are in centre units relative to win[0, 0]."""
    i0 = np.floor(u).astype(np.int64)
    j0 = np.floor(v).astype(np.int64)
    fu = u - i0
    fv = v - j0
    a = win[j0, i0]
    b = win[j0, i0 + 1]
    c = win[j0 + 1, i0]
    d = win[j0 + 1, i0 + 1]
    res = (a * (1 - fu) * (1 - fv) + b * fu * (1 - fv) + c * (1 - fu) * fv + d * fu * fv)
    bad = ~np.isfinite(a) | ~np.isfinite(b) | ~np.isfinite(c) | ~np.isfinite(d)
    if nodata is not None:
        bad |= (a == nodata) | (b == nodata) | (c == nodata) | (d == nodata)
    return np.where(bad, fill, res)


def open_remote(url, cache_dir):
    return RemoteTiff(HttpSource(url, cache_dir))


def open_bytes(data):
    return RemoteTiff(MemorySource(data))
