"""Prepare bounded real USGS geology and NASA rover visit-area targets.

Requires data-preparation dependencies in requirements.txt; never run at app startup.
"""
from pathlib import Path
import hashlib
import json
import math
import requests
from shapely import make_valid
from shapely.geometry import Polygon, LineString, GeometryCollection, box, mapping

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / 'tmp' / 'science-sources'
OUT = ROOT / 'public' / 'science'
SERVICE = 'https://services.arcgis.com/v01gqwM5QqNysAAi/arcgis/rest/services/Tanaka_et_al_2014_Mars_Global_Map_Features/FeatureServer'
WAYPOINTS = 'https://mars.nasa.gov/mmgis-maps/MSL/Layers/json/MSL_waypoints.json'
BOUNDS = {'gale-bradbury': [135, -7, 140, -2], 'jezero': [75, 16, 80, 21]}
OFFSET = .001
CACHE.mkdir(parents=True, exist_ok=True)
OUT.mkdir(parents=True, exist_ok=True)
sources = []


def retrieve(name, url, params=None):
    path = CACHE / name
    response_url = requests.Request('GET', url, params=params).prepare().url
    if not path.exists():
        r = requests.get(url, params=params, timeout=45)
        r.raise_for_status()
        # Do not cache server JSON errors as a successful source.
        data = r.json()
        if 'error' in data:
            raise RuntimeError(data['error'])
        path.write_bytes(r.content)
    raw = path.read_bytes()
    sources.append({'file': name, 'url': response_url, 'sha256': hashlib.sha256(raw).hexdigest()})
    return json.loads(raw)


def parts(geometry, kind):
    if geometry.is_empty:
        return []
    if geometry.geom_type == kind:
        return [geometry]
    return [g for item in getattr(geometry, 'geoms', []) for g in parts(item, kind)]


item=retrieve('usgs-item.json','https://www.arcgis.com/sharing/rest/content/items/1c7697dbadaf49058bdf3afc9121aad3',{'f':'json'})
assert item['owner']=='mahunter@usgs.gov_USGS' and item['url']==SERVICE
metadata = retrieve('geology-layer-3.json', SERVICE + '/3', {'f': 'json'})
colors = {u['value']: '#'+''.join(f'{n:02x}' for n in u['symbol']['color'][:3]) for u in metadata['drawingInfo']['renderer']['uniqueValueInfos']}
regions = {}
for region, bounds in BOUNDS.items():
    record = {'bounds': bounds, 'units': [], 'contacts': []}
    for layer in [3, 1]:
        data = retrieve(f'{region}-{layer}-offset001.json', f'{SERVICE}/{layer}/query', {
            'f': 'json', 'geometry': ','.join(map(str, bounds)), 'geometryType': 'esriGeometryEnvelope',
            'inSR': 104971, 'outSR': 104971, 'spatialRel': 'esriSpatialRelIntersects',
            'outFields': '*', 'maxAllowableOffset': OFFSET, 'returnGeometry': 'true', 'resultRecordCount': 2000})
        assert not data.get('exceededTransferLimit'), 'Incomplete geology response'
        assert data['spatialReference']['wkid'] == 104971
        for feature in data['features']:
            a, g = feature['attributes'], feature['geometry']
            if layer == 3:
                # ESRI polygon rings have even/odd interiors. Symmetric difference retains holes.
                geometry = GeometryCollection()
                for ring in g['rings']:
                    geometry = geometry.symmetric_difference(make_valid(Polygon(ring)))
                polygons = parts(make_valid(geometry).intersection(box(*bounds)), 'Polygon')
                if not polygons:
                    continue
                record['units'].append({'id': str(a['OBJECTID']), 'code': a['Unit'], 'name': a['UnitDesc'],
                    'group': a['UnitGroup'], 'characteristics': a['PrimaryCharacteristics'].replace('\\r\\n', ' ').strip(),
                    'interpretation': a['Interpretation'], 'color': colors[a['Unit']],
                    'polygons': [mapping(p)['coordinates'] for p in polygons]})
            else:
                lines = [line for path in g['paths'] for line in parts(LineString(path).intersection(box(*bounds)), 'LineString')]
                if lines:
                    record['contacts'].append({'id': str(a['OBJECTID']), 'type': a['ConType'], 'lines': [list(line.coords) for line in lines]})
    regions[region] = record

meta = json.loads((ROOT / 'public/gale/manifest.json').read_text())
feed = retrieve('msl-waypoints.json', WAYPOINTS)
targets = []
for id_, sol, name, question, evidence, url in [
    ('rocknest', 56, 'Rocknest visit area', 'How does wind sort and accumulate loose sand beside rock obstacles?',
     'NASA describes a windblown sand-and-dust drift at Rocknest; this offers an aeolian-material comparison with bedrock at Yellowknife Bay.',
     'https://science.nasa.gov/resource/rocknest-from-sol-52-location/'),
    ('yellowknife', 125, 'Yellowknife Bay entry', 'What can sedimentary bedrock reveal about ancient water and deposition?',
     'NASA documents entry into Yellowknife Bay on Sol 125 and later interprets the bay as a former lake-bed setting. This waypoint represents the entry area, not a drill site.',
     'https://www.jpl.nasa.gov/images/pia16553-looking-back-at-entry-into-yellowknife-bay/')]:
    candidates = [f for f in feed['features'] if f['properties']['sol'] == sol]
    assert len(candidates) == 1
    f = candidates[0]
    lon, lat = f['geometry']['coordinates'][:2]
    x = math.radians(lon-meta['origin']['longitude'])*meta['radiusM']*math.cos(math.radians(meta['origin']['latitude']))
    y = math.radians(lat-meta['origin']['latitude'])*meta['radiusM']
    targets.append({'id': id_, 'name': name, 'regionId': 'gale-bradbury', 'longitude': lon, 'latitude': lat,
        'point': {'x': round(x/5)*5, 'y': round(y/5)*5}, 'sol': sol, 'rmc': f['properties']['RMC'],
        'question': question, 'evidence': evidence, 'sourceUrl': url,
        'additionalSource': 'https://astrobiology.nasa.gov/news/dating-on-the-shores-of-a-habitable-martian-lake/' if id_=='yellowknife' else 'https://science.nasa.gov/resource/curiositys-rocknest-workplace/',
        'positionSource': WAYPOINTS, 'positionNote': 'NASA/JPL published rover waypoint at this visit area; not an exact contact, scoop or drill location. Planner endpoint snapped to the 5 m grid. The feed does not state a positional error bound or latitude convention; used as spherical Mars latitude, consistent with the prepared map frame.',
        'timeNote': f'Curiosity visit: Sol {sol}, 2012. Environmental replay remains Sol 10 and is a separate demonstration scenario.'})
    assert abs(targets[-1]['point']['x']) <= meta['extentM']/2 and abs(targets[-1]['point']['y']) <= meta['extentM']/2

package = {'id': 'mars-geology-context-v1', 'version': 1, 'preparedDate': '2026-11-14',
    'title': 'USGS geological context', 'publication': 'Tanaka et al. (2014), Geologic map of Mars, USGS SIM 3292',
    'sourceUrl': 'https://doi.org/10.3133/sim3292', 'serviceUrl': SERVICE, 'serviceItemId': '1c7697dbadaf49058bdf3afc9121aad3',
    'sourceOwner': 'mahunter@usgs.gov_USGS', 'mapScale': '1:20,000,000', 'publicationYear': 2014,
    'coordinateReference': 'GCS_Mars_2000_Sphere (ArcGIS 104971), radius 3396190 m; spherical latitude and east-positive longitude in degrees. Source Robinson geometry transformed by the service.',
    'processing': f'Regional intersect queries in 104971; maximum allowable offset {OFFSET} degrees (about 59 m at equator); even/odd polygon holes retained; clipped to declared bounds. Simplification tolerance is not positional accuracy.',
    'limitation': 'Regional geological interpretation. Too coarse to distinguish local outcrops or determine footing, bearing strength, or exact contact positions. Unit colors are the published service palette. No geological routing penalties are applied.',
    'regions': regions, 'targets': targets, 'sources': sources}
(OUT / 'geology.json').write_text(json.dumps(package, ensure_ascii=False, separators=(',', ':'))+'\n')
print('Prepared real geology:', {k: (len(v['units']), len(v['contacts'])) for k,v in regions.items()})
print('Targets:', [(t['id'], t['point']) for t in targets])
