"""Prepare the full-resolution Boxwork package (public/boxwork/full/ and the panorama in public/marswalk/).

Usage: node scripts/python.mjs scripts/prepare_boxwork_full.py <Marswalk app folder>

The Marswalk app folder must hold public/data/, public/media/ and sources.json. Only public/data/ and sources.json are
still in this repository (odin/app/); public/media/ left with the old static app. Take the full
old folder from git history: in the repository root run git worktree add ../marswalk-old 66ee212, then, in this
folder, pass ../../marswalk-old/odin/app.

Needs only numpy. No downloads, no image re-encoding: the 0.25 m tiles stay the byte-identical webp files that
scripts/prepare_boxwork.py already copied into public/boxwork/detail/ortho/, and this script checks that they match
the given Marswalk folder. The 1 m height grid is decoded from dem_core.bin once (no resampling).
"""
from pathlib import Path
import hashlib
import json
import shutil
import struct
import sys
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
BOXWORK = ROOT/'public/boxwork'
DETAIL = BOXWORK/'detail'
OUT = BOXWORK/'full'
MEDIA_OUT = ROOT/'public/marswalk'


def sha256(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def webp_size(path):
    with open(path, 'rb') as f:
        head = f.read(30)
    if head[:4] != b'RIFF' or head[8:12] != b'WEBP':
        raise ValueError(f'{path}: not a WebP file')
    kind = head[12:16]
    if kind == b'VP8 ':
        w, h = struct.unpack('<HH', head[26:30])
        return w & 0x3FFF, h & 0x3FFF
    if kind == b'VP8L':
        b = head[21:25]
        w = 1 + (((b[1] & 0x3F) << 8) | b[0])
        h = 1 + (((b[3] & 0x0F) << 10) | (b[2] << 2) | ((b[1] & 0xC0) >> 6))
        return w, h
    if kind == b'VP8X':
        w = 1 + int.from_bytes(head[24:27], 'little')
        h = 1 + int.from_bytes(head[27:30], 'little')
        return w, h
    raise ValueError(f'{path}: unknown WebP chunk {kind!r}')


def bilinear(grid, col, row):
    c, r = np.floor(col).astype(int), np.floor(row).astype(int)
    n_rows, n_cols = grid.shape
    c = np.clip(c, 0, n_cols-2)
    r = np.clip(r, 0, n_rows-2)
    dx, dy = col-c, row-r
    return (grid[r, c]*(1-dx)+grid[r, c+1]*dx)*(1-dy)+(grid[r+1, c]*(1-dx)+grid[r+1, c+1]*dx)*dy


def prepare(source_app):
    raw = source_app/'public/data'
    scene = json.loads((raw/'scene.json').read_text())
    team_scene = json.loads((DETAIL/'scene.json').read_text())
    for key in ['origin', 'ground_scale', 'projection', 'core', 'height']:
        if scene[key] != team_scene[key]:
            raise SystemExit(f'scene.json "{key}" differs between {raw} and {DETAIL}; rerun scripts/prepare_boxwork.py first.')
    team = json.loads((BOXWORK/'manifest.json').read_text())
    gs = scene['ground_scale']['x']
    core = scene['core']
    n = core['dem_samples']
    half = core['size_m']/2
    step = core['size_m']/(n-1)
    hdef = scene['height']

    OUT.mkdir(parents=True, exist_ok=True)
    codes = np.fromfile(raw/core['dem'], '<u2')
    if codes.size != n*n:
        raise SystemExit(f'{core["dem"]}: expected {n*n} samples, got {codes.size}')
    codes = codes.reshape(n, n)
    nodata = codes == hdef['nodata']
    z = hdef['offset_m']+codes.astype(np.float64)*hdef['scale_m']
    z[nodata] = np.nan
    z.astype('<f4').tofile(OUT/'height.f32')
    del codes

    # Check 1: the team's 5 m grid is the same bilinear of these samples (prepare_boxwork.py), so its nodes must agree.
    tn, tstep, text = team['size'], team['stepM'], team['extentM']
    team_h = np.fromfile(BOXWORK/'height.f32', '<f4').reshape(tn, tn).astype(np.float64)
    yy, xx = np.indices((tn, tn))
    tx, ty = xx*tstep-text/2, text/2-yy*tstep
    at_nodes = bilinear(z, (tx/gs+half)/step, (half-ty)/step)
    node_diff = float(np.nanmax(np.abs(at_nodes-team_h)))

    # Check 2: how far the 5 m surface strays from the 1 m surface, measured at every 1 m sample in the team square.
    rr, cc = np.indices((n, n))
    sx, sy = (cc*step-half)*gs, half-rr*step
    inside = (np.abs(sx) <= text/2) & (np.abs(sy) <= text/2) & ~nodata
    five = bilinear(team_h, (sx[inside]+text/2)/tstep, (text/2-sy[inside])/tstep)
    dev = np.abs(z[inside]-five)
    dev_max, dev_p99 = float(dev.max()), float(np.percentile(dev, 99))
    del rr, cc, sx, sy, five, dev

    tiles = {}
    for mode in ['colour', 'grey']:
        grid = scene['imagery'][mode]['tiles']
        for r, row in enumerate(grid):
            for c, rel in enumerate(row):
                src, dst = raw/rel, DETAIL/rel
                if not dst.exists() or sha256(dst) != sha256(src):
                    raise SystemExit(f'{dst} is missing or differs from {src}; rerun scripts/prepare_boxwork.py first.')
                w, h = webp_size(dst)
                if (w, h) != (core['tile_px'], core['tile_px']):
                    raise SystemExit(f'{dst}: {w}x{h} px, scene.json says {core["tile_px"]}')
                tiles[f'{mode}_{r}_{c}'] = {'url': f'/boxwork/detail/{rel}', 'widthPx': w, 'heightPx': h,
                    'bytes': dst.stat().st_size, 'sha256': sha256(dst)}
        rel = scene['imagery'][mode]['half_res']
        w, h = webp_size(DETAIL/rel)
        tiles[f'{mode}_half'] = {'url': f'/boxwork/detail/{rel}', 'widthPx': w, 'heightPx': h,
            'bytes': (DETAIL/rel).stat().st_size, 'sha256': sha256(DETAIL/rel)}

    credits = json.loads((source_app/'public/media/credits.json').read_text())
    pano = []
    for entry in credits:
        src = source_app/'public/media'/entry['file']
        shutil.copyfile(src, MEDIA_OUT/entry['file'])
        w, h = webp_size(MEDIA_OUT/entry['file'])
        pano.append({**entry, 'url': f'/marswalk/{entry["file"]}', 'widthPx': w, 'heightPx': h,
            'bytes': (MEDIA_OUT/entry['file']).stat().st_size, 'sha256': sha256(MEDIA_OUT/entry['file'])})
    panorama = {'schema': 'marswalk-panorama', 'version': 1,
        'shows': 'Curiosity ground panorama, a 360-degree view of the boxwork ridges and hollows taken by the rover Mastcam at the Boxwork site. Ground photo, not georeferenced to the orbital grid.',
        'credit': 'NASA/JPL-Caltech/MSSS',
        'licenceNote': 'NASA image, resized only. No NASA logo, flag or mission patch is used; NASA does not endorse this project.',
        'derivedFrom': 'Copied byte for byte from the Marswalk app public/media/ by scripts/prepare_boxwork_full.py.',
        'files': pano}
    (MEDIA_OUT/'panorama.json').write_text(json.dumps(panorama, indent=2)+'\n')

    tile_m = core['size_m']/len(core['tiles'])
    manifest = {
        'id': 'gale-boxwork-full-v1', 'datasetId': team['id'], 'version': 1,
        'frame': {'name': 'team local frame', 'rule': 'x_team = x_marswalk * groundScaleX; y_team = y_marswalk',
            'groundScaleX': gs, 'origin': team['origin'], 'radiusM': team['radiusM'],
            'derivedFrom': 'public/boxwork/detail/scene.json ground_scale.x, the cosine of the origin latitude'},
        'extentTeamM': {'west': -half*gs, 'east': half*gs, 'south': -half, 'north': half,
            'derivedFrom': f'scene.json core.size_m = {core["size_m"]} projected metres centred on the origin; x times groundScaleX'},
        'teamAreaM': {'west': -text/2, 'east': text/2, 'south': -text/2, 'north': text/2,
            'derivedFrom': 'public/boxwork/manifest.json extentM'},
        'imagery': {
            'pixelSizeM': {'east': core['image_m_per_px']*gs, 'north': core['image_m_per_px']},
            'pixelSizeNote': f'scene.json core.image_m_per_px = {core["image_m_per_px"]} projected metres; east size times groundScaleX',
            'tileGrid': {'rows': len(core['tiles']), 'cols': len(core['tiles'][0]), 'tilePx': core['tile_px'],
                'tileSizeTeamM': {'east': tile_m*gs, 'north': tile_m},
                'order': 'row 0 is north, column 0 is west; image pixel edges sit on the extent edges'},
            'modes': {m: {'label': scene['imagery'][m]['label'], 'sourceId': scene['imagery'][m]['source_id']} for m in ['colour', 'grey']},
            'files': tiles,
            'note': 'The tiles are not duplicated here: they are the byte-identical files already in public/boxwork/detail/ortho/ (checked by sha256 against the Marswalk app).'},
        'height': {
            'url': '/boxwork/full/height.f32', 'format': 'float32 little-endian, row-major',
            'rows': n, 'cols': n, 'order': 'row 0 is north, column 0 is west; samples sit on the grid corners, so the first and last sample lie on the extent edges',
            'stepTeamM': {'east': step*gs, 'north': step},
            'units': 'metres, source areoid elevation (same as public/boxwork/height.f32)',
            'noData': 'NaN', 'noDataCount': int(nodata.sum()),
            'min': float(np.nanmin(z)), 'max': float(np.nanmax(z)),
            'bytes': (OUT/'height.f32').stat().st_size, 'sha256': sha256(OUT/'height.f32'),
            'derivedFrom': f'Marswalk public/data/{core["dem"]}: uint16 little-endian codes; elevation = {hdef["offset_m"]} + code * {hdef["scale_m"]} m; code {hdef["nodata"]} becomes NaN. Decoded once, not resampled. Encoding step 0.01 m.'},
        'checks': {
            'teamNodeMaxAbsDiffM': node_diff,
            'teamNodeNote': 'Bilinear of this grid at every 5 m node of public/boxwork/height.f32 minus that node (float32 rounding only).',
            'fiveMetreDeviationMaxM': dev_max, 'fiveMetreDeviationP99M': dev_p99,
            'fiveMetreDeviationNote': 'Absolute difference between this 1 m grid and the bilinear 5 m team grid, at every valid 1 m sample inside the team area. The maximum is the largest disagreement found at any 1 m sample and serves as the comparison tolerance.'},
        'licence': 'CC BY-SA 3.0 IGO (https://creativecommons.org/licenses/by-sa/3.0/igo/); see public/boxwork/DATA-LICENSE.md',
        'credit': ['Calef III, F. J., & Parker, T. (2016), USGS Astrogeology. MSL Gale Merged Orthophoto Mosaic and MSL Gale Merged DEM Mosaic, v3.',
            'USGS Gale HiRISE colour mosaic (July 2025); NASA/JPL-Caltech/University of Arizona (HiRISE).', 'ESA/DLR/FU Berlin (HRSC).'],
        'sources': [{'id': s['id'], 'title': s['title'], 'url': s['url'], 'licence': s['licence'], 'credit': s['credit']}
            for s in json.loads((source_app/'sources.json').read_text()) if s['id'] in scene['sources']],
        'inputHashes': {f'public/data/{core["dem"]}': sha256(raw/core['dem']), 'public/data/scene.json': sha256(raw/'scene.json'),
            'public/media/credits.json': sha256(source_app/'public/media/credits.json')},
        'script': 'scripts/prepare_boxwork_full.py',
    }
    (OUT/'manifest.json').write_text(json.dumps(manifest, indent=2)+'\n')
    print(f'height {n}x{n}, no-data {int(nodata.sum())}; team node diff {node_diff:.6f} m; 5 m deviation max {dev_max:.3f} m, p99 {dev_p99:.3f} m')


if __name__ == '__main__':
    if len(sys.argv) != 2:
        raise SystemExit('Usage: prepare_boxwork_full.py <Marswalk app folder>')
    prepare(Path(sys.argv[1]).resolve())
