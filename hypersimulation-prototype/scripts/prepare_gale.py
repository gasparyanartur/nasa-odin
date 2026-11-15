"""Extract real USGS Gale data with HTTP range reads; never substitutes generated terrain."""
from pathlib import Path
import hashlib
import json
import math
import argparse

import numpy as np
from PIL import Image
import rasterio
from rasterio.enums import Resampling
from rasterio.transform import from_origin
from rasterio.warp import reproject, transform
from rasterio.windows import from_bounds

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'public' / 'gale'
DEM = 'https://planetarymaps.usgs.gov/mosaic/Mars/MSL/MSL_Gale_DEM_Mosaic_1m_v3.tif'
ORTHO = 'https://asc-pds-services.s3.us-west-2.amazonaws.com/mosaic/MSL_Gale_Orthophoto_Mosaic_25cm_v3.tif'
LON, LAT, RADIUS, SIZE, STEP = 137.4417, -4.5895, 3396190.0, 401, 5.0
CRS = f'+proj=eqc +lat_ts={LAT} +lat_0={LAT} +lon_0={LON} +R={RADIUS} +units=m +no_defs'
TARGET = from_origin(-1002.5, 1002.5, STEP, STEP)


def extract(url, pixels, resampling):
    print('Opening', url, flush=True)
    with rasterio.open(url + '?gale-preparation=v1') as src:
        xs, ys = transform(CRS, src.crs, [-1005, 1005], [-1005, 1005])
        window = from_bounds(min(xs), min(ys), max(xs), max(ys), src.transform).round_offsets().round_lengths()
        # Numeric DEM remains at native resolution for conservative slope aggregation.
        shape = (int(window.height), int(window.width)) if pixels is None else (pixels, pixels)
        data = src.read(1, window=window, out_shape=shape, resampling=resampling)
        t = src.window_transform(window) * rasterio.Affine.scale(window.width / shape[1], window.height / shape[0])
        print('Read', shape, 'valid', float(np.mean(data != src.nodata)), flush=True)
        return data, t, src.crs, src.nodata


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--skip-imagery', action='store_true')
    args = parser.parse_args()
    OUT.mkdir(parents=True, exist_ok=True)
    with rasterio.Env(GDAL_DISABLE_READDIR_ON_OPEN='EMPTY_DIR', GDAL_HTTP_TIMEOUT='45', GDAL_HTTP_MAX_RETRY='3'):
        native, affine, src_crs, nodata = extract(DEM, None, Resampling.nearest)
        valid = np.isfinite(native) & (native != nodata)
        z = np.where(valid, native, np.nan)
        # Source eqc is standard-parallel zero; convert east-west distance at site latitude.
        dy, dx = np.gradient(z, abs(affine.e), affine.a * math.cos(math.radians(LAT)))
        native_slope = np.degrees(np.arctan(np.hypot(dx, dy))).astype('float32')
        native_slope[~np.isfinite(native_slope)] = -9999
        height = np.full((SIZE, SIZE), -9999, dtype='float32')
        slope = height.copy()
        mask = np.zeros((SIZE, SIZE), dtype='uint8')
        for source, dest, missing, method in [(native, height, nodata, Resampling.bilinear),
                                                  (native_slope, slope, -9999, Resampling.max)]:
            reproject(source, dest, src_transform=affine, src_crs=src_crs,
                      dst_transform=TARGET, dst_crs=CRS, src_nodata=missing,
                      dst_nodata=-9999, resampling=method)
        # Any missing native pixels invalidate the planning cell; do not interpolate through gaps.
        reproject(valid.astype('uint8'), mask, src_transform=affine, src_crs=src_crs,
                  dst_transform=TARGET, dst_crs=CRS, resampling=Resampling.min)
        mask = (mask & (height != -9999) & (slope != -9999)).astype('uint8')
        if mask.mean() < .95:
            raise RuntimeError('Crop has insufficient valid terrain; inspect footprint before selecting another area.')
        height.astype('<f4').tofile(OUT / 'height.f32')
        slope.astype('<f4').tofile(OUT / 'slope.f32')
        mask.tofile(OUT / 'valid.u8')
        with rasterio.open(OUT / 'terrain.tif', 'w', driver='GTiff', height=SIZE, width=SIZE,
                           count=1, dtype='float32', crs=CRS, transform=TARGET, nodata=-9999,
                           compress='deflate') as dst:
            dst.write(np.where(mask, height, -9999), 1)
        if not args.skip_imagery:
            image, t, crs, image_nodata = extract(ORTHO, 1024, Resampling.nearest)
            texture = np.zeros((1024, 1024), dtype='uint8')
            reproject(image, texture, src_transform=t, src_crs=crs,
                      dst_transform=from_origin(-1000, 1000, 2000/1024, 2000/1024), dst_crs=CRS,
                      src_nodata=image_nodata, dst_nodata=0, resampling=Resampling.bilinear)
            Image.fromarray(texture).save(OUT / 'ortho.jpg', quality=92)
        # Display derivatives retain an alpha validity mask; all numeric inspection uses original arrays.
        for name, values, upper in [('slope', slope, 30), ('elevation', height - height[mask.astype(bool)].min(), max(1, np.ptp(height[mask.astype(bool)])))]:
            f = np.clip(values / upper, 0, 1)
            rgb = np.stack([70 + f*175, 180 - f*110, 185 - f*145, mask*170], axis=-1).astype('uint8')
            Image.fromarray(rgb).save(OUT / (name + '.png'))
        half_lat = math.degrees(1000 / RADIUS)
        half_lon = half_lat / math.cos(math.radians(LAT))
        metadata = {
            'id': 'gale-bradbury-v1', 'name': 'Gale · Bradbury landing area', 'version': 1,
            'origin': {'longitude': LON, 'latitude': LAT}, 'radiusM': RADIUS,
            'size': SIZE, 'stepM': STEP, 'extentM': 2000,
            'bounds': [LON-half_lon, LAT-half_lat, LON+half_lon, LAT+half_lat],
            'referenceElevationM': float(np.floor(height[mask.astype(bool)].min())),
            'minElevationM': float(height[mask.astype(bool)].min()), 'maxElevationM': float(height[mask.astype(bool)].max()),
            'validFraction': float(mask.mean()),
            'horizontalReference': CRS,
            'verticalReference': 'MOLA-controlled source areoid elevations (meters). Globe relief is relative to patch minimum, not an areoid-to-ellipsoid conversion.',
            'slopeDefinition': 'Maximum native DEM gradient within each 5 m cell; source east-west scale corrected by cos(latitude).',
            'resolutionNote': '5 m prepared grid. DEM source has 1 m posts; mosaics include coarser fill. At landing, source pair PSP_009505_1755 / PSP_009571_1755 (G2). Fine surface strength and boot-scale obstacles are unresolved.',
            'sources': [
                {'name': 'USGS MSL Gale DEM mosaic v3', 'url': DEM, 'catalog': 'https://astrogeology.usgs.gov/search/map/mars_msl_gale_merged_dem_1m', 'nativeGridM': 1, 'published': '2016-10-20'},
                {'name': 'USGS MSL Gale orthophoto mosaic v3', 'url': ORTHO, 'catalog': 'https://astrogeology.usgs.gov/search/map/mars_msl_gale_merged_orthophoto_mosaic_25cm', 'nativeGridM': .25},
            ],
            'attribution': 'NASA / JPL-Caltech / USGS / University of Arizona · Calef & Parker, Gale mosaics',
            'processing': 'scripts/prepare_gale.py: native crop → local metric eqc → bilinear elevation, maximum slope, conservative validity; ortho resampled for display.',
            'checksums': {p.name: hashlib.sha256(p.read_bytes()).hexdigest() for p in OUT.iterdir() if p.is_file() and p.name != 'manifest.json'},
        }
        (OUT / 'manifest.json').write_text(json.dumps(metadata, indent=2) + '\n')
        print(json.dumps({k: metadata[k] for k in ['size','validFraction','minElevationM','maxElevationM','bounds']}, indent=2), flush=True)


if __name__ == '__main__':
    main()
