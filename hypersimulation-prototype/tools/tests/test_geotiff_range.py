"""Unit tests for geotiff_range on synthetic in-memory TIFF bytes.

AI-written (Claude, Anthropic) for the team's NASA Space Apps 2026 project.
"""

import io
import math
import os
import struct
import sys
import unittest
import zlib

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import geotiff_range as g  # noqa: E402


# ------------------------------------------------------------ encoders (test only)

def packbits_encode(data):
    out = bytearray()
    i = 0
    n = len(data)
    while i < n:
        j = i
        while j + 1 < n and data[j + 1] == data[i] and j - i < 127:
            j += 1
        if j > i:
            out.append(257 - (j - i + 1))
            out.append(data[i])
            i = j + 1
            continue
        start = i
        while i < n and i - start < 128 and not (i + 1 < n and data[i + 1] == data[i]):
            i += 1
        if i == start:
            i += 1
        out.append(i - start - 1)
        out += data[start:i]
    return bytes(out)


def lzw_encode(data):
    bits = []
    width = 9

    def emit(code):
        bits.append((code, width))

    table = {bytes([i]): i for i in range(256)}
    nxt = 258
    emit(256)
    w = b""
    for byte in data:
        wc = w + bytes([byte])
        if wc in table:
            w = wc
            continue
        emit(table[w])
        table[wc] = nxt
        nxt += 1
        if nxt >= 4094:
            emit(256)
            table = {bytes([i]): i for i in range(256)}
            nxt = 258
            width = 9
        elif nxt >= 2048:
            width = 12
        elif nxt >= 1024:
            width = 11
        elif nxt >= 512:
            width = 10
        w = bytes([byte])
    if w:
        emit(table[w])
    emit(257)
    acc = 0
    nb = 0
    for code, wd in bits:
        acc = (acc << wd) | code
        nb += wd
    pad = (-nb) % 8
    acc <<= pad
    return acc.to_bytes((nb + pad) // 8, "big")


def encode_predictor(arr, predictor, endian):
    """arr: (rows, width, spp). Return raw bytes after the predictor."""
    rows, width, spp = arr.shape
    if predictor == 1:
        return arr.astype(arr.dtype.newbyteorder(endian)).tobytes()
    if predictor == 2:
        d = arr.copy()
        d[:, 1:] = arr[:, 1:] - arr[:, :-1]
        return d.astype(arr.dtype.newbyteorder(endian)).tobytes()
    nb = arr.dtype.itemsize
    be = arr.astype(arr.dtype.newbyteorder(">")).reshape(rows, width * spp)
    b = np.frombuffer(be.tobytes(), np.uint8).reshape(rows, width * spp, nb).transpose(0, 2, 1)
    b = np.ascontiguousarray(b).reshape(rows, width * spp * nb).astype(np.int16)
    d = b.copy()
    d[:, spp:] = (b[:, spp:] - b[:, :-spp]) % 256
    return d.astype(np.uint8).tobytes()


def compress(raw, comp):
    if comp == 1:
        return raw
    if comp == 5:
        return lzw_encode(raw)
    if comp in (8, 32946):
        return zlib.compress(raw)
    if comp == 32773:
        return packbits_encode(raw)
    raise ValueError(comp)


def build_tiff(arr, bigtiff=False, endian="<", tile=None, rows_per_strip=None, comp=1,
               predictor=1, geo=None):
    """Write a TIFF with the given layout. arr: (h, w) or (h, w, spp)."""
    if arr.ndim == 2:
        arr = arr[:, :, None]
    h, w, spp = arr.shape
    kind = arr.dtype.kind
    bps = arr.dtype.itemsize * 8
    fmt = {"u": 1, "i": 2, "f": 3}[kind]
    chunks = []
    if tile:
        tw, th = tile
        across, down = -(-w // tw), -(-h // th)
        for tr in range(down):
            for tc in range(across):
                block = np.zeros((th, tw, spp), arr.dtype)
                part = arr[tr * th:(tr + 1) * th, tc * tw:(tc + 1) * tw]
                block[:part.shape[0], :part.shape[1]] = part
                chunks.append(compress(encode_predictor(block, predictor, endian), comp))
    else:
        rps = rows_per_strip or h
        for r in range(0, h, rps):
            part = arr[r:r + rps]
            chunks.append(compress(encode_predictor(part, predictor, endian), comp))
    e = endian
    off_type = 16 if bigtiff else 4
    entries = [(256, 4, [w]), (257, 4, [h]), (258, 3, [bps] * spp), (259, 3, [comp]),
               (262, 3, [1]), (277, 3, [spp]), (284, 3, [1]), (317, 3, [predictor]),
               (339, 3, [fmt] * spp)]
    if tile:
        entries += [(322, 3, [tile[0]]), (323, 3, [tile[1]]),
                    (324, off_type, None), (325, off_type, [len(c) for c in chunks])]
    else:
        entries += [(273, off_type, None), (278, 4, [rows_per_strip or h]),
                    (279, off_type, [len(c) for c in chunks])]
    if geo:
        entries += geo
    entries.sort(key=lambda t: t[0])
    tfmt = {1: "B", 2: "c", 3: "H", 4: "I", 12: "d", 16: "Q"}
    tsize = {1: 1, 2: 1, 3: 2, 4: 4, 12: 8, 16: 8}
    head = 16 if bigtiff else 8
    esz, csz, vsz = (20, 8, 8) if bigtiff else (12, 2, 4)
    ifd_off = head
    ifd_len = csz + esz * len(entries) + vsz
    extra_off = ifd_off + ifd_len
    extra = bytearray()
    data_start_placeholder = []

    def pack_vals(typ, vals):
        if typ == 2:
            return vals
        return struct.pack(e + tfmt[typ] * len(vals), *vals)

    n_chunks = len(chunks)
    # Reserve space for the offsets array, fill it once data offsets are known.
    resolved = []
    for tag, typ, vals in entries:
        if vals is None:
            vals = [0] * n_chunks
            data_start_placeholder.append(tag)
        resolved.append([tag, typ, vals])
    layout = []
    for tag, typ, vals in resolved:
        blob = pack_vals(typ, vals)
        count = len(vals)
        if len(blob) <= vsz:
            layout.append((tag, typ, count, blob, None))
        else:
            layout.append((tag, typ, count, None, extra_off + len(extra)))
            extra += blob
            if len(extra) % 2:
                extra += b"\x00"
    data_off = extra_off + len(extra)
    offsets = []
    pos = data_off
    for c in chunks:
        offsets.append(pos)
        pos += len(c)
    for i, (tag, typ, count, blob, voff) in enumerate(layout):
        if tag in data_start_placeholder:
            nb = pack_vals(typ, offsets)
            if voff is None:
                layout[i] = (tag, typ, count, nb, None)
            else:
                rel = voff - extra_off
                extra[rel:rel + len(nb)] = nb
    out = bytearray()
    if bigtiff:
        out += (b"II" if e == "<" else b"MM") + struct.pack(e + "HHHQ", 43, 8, 0, ifd_off)
        out += struct.pack(e + "Q", len(layout))
    else:
        out += (b"II" if e == "<" else b"MM") + struct.pack(e + "HI", 42, ifd_off)
        out += struct.pack(e + "H", len(layout))
    for tag, typ, count, blob, voff in layout:
        if bigtiff:
            out += struct.pack(e + "HHQ", tag, typ, count)
            out += (blob.ljust(8, b"\x00") if blob is not None else struct.pack(e + "Q", voff))
        else:
            out += struct.pack(e + "HHI", tag, typ, count)
            out += (blob.ljust(4, b"\x00") if blob is not None else struct.pack(e + "I", voff))
    out += b"\x00" * vsz
    out += extra
    for c in chunks:
        out += c
    return bytes(out)


def eqc_geo(lat_ts, pixel_scale, tie_xy, raster_type=1, radius=3396190.0):
    keys = [(1024, 0, 1, 1), (1025, 0, 1, raster_type), (2054, 0, 1, 9102),
            (2057, 34736, 1, 0), (2058, 34736, 1, 1), (3072, 0, 1, 32767),
            (3075, 0, 1, 17), (3076, 0, 1, 9001), (3078, 34736, 1, 2),
            (3082, 34736, 1, 3), (3083, 34736, 1, 4), (3088, 34736, 1, 5), (3089, 34736, 1, 6)]
    directory = [1, 1, 0, len(keys)]
    for k in keys:
        directory += list(k)
    doubles = [radius, radius, lat_ts, 0.0, 0.0, 0.0, 0.0]
    return [(33550, 12, [pixel_scale, pixel_scale, 0.0]),
            (33922, 12, [0.0, 0.0, 0.0, tie_xy[0], tie_xy[1], 0.0]),
            (34735, 3, directory), (34736, 12, doubles)]


# ------------------------------------------------------------ tests

class LayoutTests(unittest.TestCase):
    def setUp(self):
        rng = np.random.default_rng(7)
        self.u8 = rng.integers(0, 256, size=(300, 260), dtype=np.uint8)
        self.u8[40:90, 10:200] = 17
        y, x = np.mgrid[0:150, 0:170]
        self.f32 = (-3600.0 + 0.37 * x - 0.21 * y + rng.normal(0, 0.05, (150, 170))).astype(np.float32)

    def check_window(self, tif, arr, col0, row0, w, h):
        got = tif.read_window(col0, row0, w, h)
        np.testing.assert_array_equal(got, arr[row0:row0 + h, col0:col0 + w])

    def test_classic_packbits_tiles_cross_edges(self):
        data = build_tiff(self.u8, tile=(64, 32), comp=32773)
        t = g.open_bytes(data)
        self.assertFalse(t.bigtiff)
        self.assertTrue(t.tiled)
        self.check_window(t, self.u8, 50, 20, 100, 70)
        self.check_window(t, self.u8, 200, 280, 60, 20)

    def test_bigtiff_packbits_tiles_cross_edges(self):
        data = build_tiff(self.u8, bigtiff=True, tile=(32, 32), comp=32773)
        t = g.open_bytes(data)
        self.assertTrue(t.bigtiff)
        self.check_window(t, self.u8, 31, 31, 66, 99)

    def test_bigtiff_big_endian_deflate(self):
        data = build_tiff(self.u8, bigtiff=True, endian=">", tile=(64, 64), comp=8)
        t = g.open_bytes(data)
        self.check_window(t, self.u8, 0, 0, 260, 300)

    def test_lzw_strips_no_predictor(self):
        data = build_tiff(self.f32, rows_per_strip=1, comp=5, predictor=1)
        t = g.open_bytes(data)
        self.assertFalse(t.tiled)
        self.check_window(t, self.f32, 13, 7, 120, 40)

    def test_lzw_strips_float_predictor(self):
        data = build_tiff(self.f32, rows_per_strip=3, comp=5, predictor=3)
        t = g.open_bytes(data)
        self.assertEqual(t.predictor, 3)
        self.check_window(t, self.f32, 0, 100, 170, 50)

    def test_lzw_float_predictor_big_endian_tiles(self):
        data = build_tiff(self.f32, endian=">", tile=(48, 16), comp=5, predictor=3)
        t = g.open_bytes(data)
        self.check_window(t, self.f32, 40, 10, 90, 60)

    def test_horizontal_predictor_uint16(self):
        arr = (np.arange(200 * 90, dtype=np.uint32).reshape(90, 200) * 7 % 65536).astype(np.uint16)
        data = build_tiff(arr, rows_per_strip=8, comp=32946, predictor=2)
        t = g.open_bytes(data)
        self.check_window(t, arr, 5, 5, 150, 70)

    def test_window_outside_gets_fill(self):
        data = build_tiff(self.u8, tile=(64, 64), comp=1)
        t = g.open_bytes(data)
        got = t.read_window(-5, -3, 20, 10, fill=0)
        self.assertTrue((got[:3] == 0).all() and (got[:, :5] == 0).all())
        np.testing.assert_array_equal(got[3:, 5:], self.u8[0:7, 0:15])

    def test_lzw_pure_python_matches_libtiff(self):
        raw = encode_predictor(self.f32[:, :, None], 3, "<")
        enc = lzw_encode(raw)
        self.assertEqual(g.lzw_decode_py(enc), raw)
        self.assertEqual(g.lzw_decode(enc, len(raw)), raw)

    def test_reads_lzw_written_by_libtiff(self):
        from PIL import Image
        buf = io.BytesIO()
        Image.fromarray(self.u8).save(buf, format="TIFF", compression="tiff_lzw")
        t = g.open_bytes(buf.getvalue())
        self.assertEqual(t.compression, 5)
        orig = g.lzw_decode
        g.lzw_decode = lambda data, expected: g.lzw_decode_py(data)
        try:
            self.check_window(t, self.u8, 0, 0, 260, 300)
        finally:
            g.lzw_decode = orig

    def test_packbits_pure_python_matches_pillow(self):
        raw = self.u8.tobytes()
        enc = packbits_encode(raw)
        self.assertEqual(g.packbits_decode_py(enc), raw)
        self.assertEqual(g.packbits_decode(enc, len(raw)), raw)

    def test_unsupported_compression_raises(self):
        data = bytearray(build_tiff(self.u8, tile=(64, 64), comp=1))
        t = g.open_bytes(bytes(data))
        t.compression = 34887
        with self.assertRaises(NotImplementedError):
            t.read_window(0, 0, 10, 10)


class GeorefTests(unittest.TestCase):
    R = 3396190.0

    def test_round_trip_nonzero_standard_parallel(self):
        lat_ts = 30.0
        tie = (8126248.0, -241164.0)
        arr = np.zeros((40, 50), np.uint8)
        t = g.open_bytes(build_tiff(arr, comp=1, geo=eqc_geo(lat_ts, 0.25, tie)))
        self.assertEqual(t.proj["lat_ts_deg"], 30.0)
        for col, row in [(0, 0), (12.5, 7.25), (50, 40), (-1000.0, 3000.0)]:
            lon, lat = t.pixel_to_lonlat(col, row)
            c2, r2 = t.lonlat_to_pixel(lon, lat)
            self.assertAlmostEqual(c2, col, places=6)
            self.assertAlmostEqual(r2, row, places=6)
        lon, lat = t.pixel_to_lonlat(0, 0)
        exp_lon = math.degrees(tie[0] / (self.R * math.cos(math.radians(lat_ts))))
        exp_lat = math.degrees(tie[1] / self.R)
        self.assertAlmostEqual(lon, exp_lon, places=9)
        self.assertAlmostEqual(lat, exp_lat, places=9)
        lon2, _ = t.pixel_to_lonlat(4, 0)
        ground = math.radians(lon2 - lon) * self.R * math.cos(math.radians(lat_ts))
        self.assertAlmostEqual(ground, 1.0, places=6)
        self.assertEqual(t.lat_type(), "planetocentric")
        self.assertEqual(t.lon_direction(), "east")

    def test_pixel_is_point_half_pixel_shift(self):
        arr = np.zeros((10, 10), np.float32)
        area = g.open_bytes(build_tiff(arr, comp=1, geo=eqc_geo(0.0, 1.0, (1000.0, -2000.0), 1)))
        point = g.open_bytes(build_tiff(arr, comp=1, geo=eqc_geo(0.0, 1.0, (1000.0, -2000.0), 2)))
        self.assertEqual(area.pixel_to_model(0, 0), (1000.0, -2000.0))
        self.assertEqual(point.pixel_to_model(0.5, 0.5), (1000.0, -2000.0))

    def test_bilinear_between_centres(self):
        y, x = np.mgrid[0:20, 0:30]
        arr = (2.0 * x + 3.0 * y).astype(np.float32)
        t = g.open_bytes(build_tiff(arr, rows_per_strip=1, comp=5, geo=eqc_geo(0.0, 1.0, (0.0, 0.0))))
        val = t.bilinear([5.5, 10.0], [3.5, 7.25])
        np.testing.assert_allclose(val, [2 * 5 + 3 * 3, 2 * 9.5 + 3 * 6.75], atol=1e-4)


class RangeTests(unittest.TestCase):
    def test_merge_ranges(self):
        self.assertEqual(g.merge_ranges([(10, 20), (0, 5), (21, 30)], gap=1), [(0, 5), (10, 30)])
        self.assertEqual(g.merge_ranges([(0, 10), (12, 20)], gap=1), [(0, 10), (12, 20)])
        self.assertEqual(g.merge_ranges([(0, 10), (10, 20)], gap=0, max_len=15), [(0, 10), (10, 20)])

    def test_cache_lookup_finds_long_earlier_segment(self):
        src = object.__new__(g.HttpSource)
        src._segments = [(0, 1000), (500, 100), (500, 300)]
        src._starts = [0, 500, 500]
        self.assertEqual(src._covering(700, 50), (500, 300))
        self.assertEqual(src._covering(900, 50), (0, 1000))
        self.assertIsNone(src._covering(990, 50))

    def test_cap(self):
        self.assertEqual(g.cap("x" * 1000), "x" * 300 + "...[cut]")


if __name__ == "__main__":
    unittest.main()
