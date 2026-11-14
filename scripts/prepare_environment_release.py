"""Prepare real GRS/MCS layers and REMS/RAD history; cache original products locally."""
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path
from statistics import median
from urllib.parse import urljoin
import csv
import hashlib
import io
import json
import math
import re
import xml.etree.ElementTree as ET
import requests
from environment_model import predict, validate

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT/'tmp/environment-release/sources'
OUT = ROOT/'public/environment'
GRS = 'https://pds-geosciences.wustl.edu/ody/ody-m-grs-5-elements-v1/odgm_xxxx/data/unsmoothed/5x5/'
REMS = 'https://atmos.nmsu.edu/PDS/data/PDS4/msl_rems_bundle/data_calibrated/SOL_00001_00089/'
RAD = 'https://pds-ppi.igpp.ucla.edu/data/MSL-M-RAD-3-RDR-V1.0/DATA/SOL_00000_00089/'
MCS = 'https://atmos.nmsu.edu/PDS/data/MROM_2104/DATA/2015/201504/20150401/'
SOLS = list(range(10, 29))
sources = {}


def fetch(url):
    CACHE.mkdir(parents=True, exist_ok=True)
    name = hashlib.sha256(url.encode()).hexdigest()[:12]+'-'+(url.rstrip('/').rsplit('/', 1)[-1])
    path = CACHE/name
    if not path.exists():
        for attempt in range(3):
            try:
                response = requests.get(url, timeout=90)
                response.raise_for_status()
                path.with_suffix(path.suffix+'.part').write_bytes(response.content)
                path.with_suffix(path.suffix+'.part').replace(path)
                break
            except requests.RequestException:
                if attempt == 2:
                    raise
    raw = path.read_bytes()
    sources[url] = {'url': url, 'sha256': hashlib.sha256(raw).hexdigest(), 'bytes': len(raw)}
    return raw.decode('utf-8', errors='strict')


def longitude(value):
    return (value+180) % 360-180


def grs_layer(element, factor, unit):
    label = fetch(GRS+element+'_5x5.lbl')
    assert 'WEIGHT PERCENT' in label and '2592' in label
    samples = []
    for index, line in enumerate(fetch(GRS+element+'_5x5.tab').splitlines()):
        lat, lon, value, sigma, corrected_sigma = map(float, line.split())
        valid = math.isfinite(value) and abs(value) < 9999 and value >= 0
        lon = longitude(lon)
        samples.append({'id': f'{element}-{index}', 'lon': lon, 'lat': lat,
                        'value': round(value*factor, 6) if valid else None,
                        'rawValue': value, 'error': round(sigma*factor, 6) if 0 <= sigma < 9999 else None,
                        'bounds': [lon-2.5, lat-2.5, lon+2.5, lat+2.5],
                        'quality': 'Background-subtracted concentration; source sigma retained.' if valid else 'Missing or below-background concentration; not a physical negative abundance.'})
    assert len(samples) == 2592
    return {'id': 'grs-'+element, 'name': {'k':'Potassium', 'th':'Thorium', 'h2o':'Water-equivalent hydrogen'}[element]+' · Odyssey GRS',
            'quantity': {'k':'potassium_mass_fraction', 'th':'thorium_mass_fraction', 'h2o':'water_equivalent_hydrogen'}[element],
            'unit': unit, 'instrument': 'Odyssey GRS', 'kind': 'observation', 'geometry': 'cells',
            'sourceUrl': GRS+element+'_5x5.tab', 'labelUrl': GRS+element+'_5x5.lbl',
            'period': '2002-06-04 to 2005-04-03', 'timeBasis': 'Multi-year composition map',
            'resolution': 'Unsmoothed 5° × 5° accumulation bins; not local surface detail.',
            'note': 'Radioactive-element composition is not astronaut radiation dose.' if element != 'h2o' else 'Hydrogen expressed as equivalent water mass; not a measurement of liquid water or current moisture.',
            'coordinateNote': 'Source Mars latitude/longitude bin centers; longitude normalized to −180…180°. Labels do not specify latitude convention: displayed in the app spherical frame without a fine datum correction. Bin edges are accumulation bounds, not precise chemical contacts.',
            'samples': samples}


def mcs_layer():
    samples, rejected = [], 0
    for hour in range(0, 24, 4):
        url = MCS+f'20150401{hour:02d}_DDR.TAB'
        rows = csv.reader(io.StringIO(fetch(url)))
        names = None
        for row in rows:
            if len(row) > 70 and row[0].strip() == '1':
                names = [v.strip() for v in row]
            if names is None or len(row) != len(names) or row[0].strip() != '0':
                continue
            data = dict(zip(names, [v.strip().strip('"') for v in row]))
            value, error = float(data['T_surf']), float(data['T_surf_err'])
            lat, lon = float(data['Surf_lat']), float(data['Surf_lon'])
            if not (data['Gqual'] == '0' and 0 < value < 400 and 0 <= error < 100 and -90 <= lat <= 90 and -360 <= lon <= 360):
                rejected += 1
                continue
            utc = datetime.strptime(data['Date']+' '+data['UTC'], '%d-%b-%Y %H:%M:%S.%f').replace(tzinfo=timezone.utc).isoformat().replace('+00:00', 'Z')
            samples.append({'id': f'mcs-{hour}-{len(samples)}', 'lon': longitude(lon), 'lat': lat,
                            'value': value, 'error': error, 'utc': utc, 'sourceUrl': url,
                            'localSolarHour': float(data['LTST'])*24,
                            'quality': f"Gqual={data['Gqual']}; surf_qual={data['surf_qual']}; Obs_qual={data['Obs_qual']}. Source retrieval flags retained; not all flags certified good."})
    assert samples, 'No numeric MCS surface temperatures'
    return {'id': 'mcs-temperature', 'name': 'Surface temperature · MRO MCS', 'quantity': 'surface_temperature',
            'unit': 'K', 'instrument': 'MRO MCS', 'kind': 'observation', 'geometry': 'points',
            'sourceUrl': MCS, 'labelUrl': 'https://atmos.nmsu.edu/PDS/data/MROM_2104/DOCUMENT/DP_SIS.ASC',
            'period': '2015-04-01 UTC', 'timeBasis': 'Individual UTC and local true solar time; different locations/times are not simultaneous.',
            'resolution': 'Surface sounding coordinates; point glyphs do not represent a measured pixel footprint. No interpolation.',
            'note': 'Retrieved surface temperature, not near-surface air temperature. Unobserved locations remain unknown; retained surface-quality codes require source interpretation.',
            'coordinateNote': 'MCS areocentric spherical latitude, east longitude (source SIS).',
            'rejected': rejected, 'samples': samples}


def history_sol(sol, rad_products, waypoints):
    folder = REMS+f'SOL{sol:05d}/'
    products = sorted(set(re.findall(r'href="([^"]+RMD[^"/]+\.xml)"', fetch(folder))))
    assert len(products) == 1, (sol, products)
    xml_url = urljoin(folder, products[0]); xml = ET.fromstring(fetch(xml_url)); ns = {'p':'http://pds.nasa.gov/pds4/pds/v1'}
    fields = xml.findall('.//p:Field_Character', ns)
    columns = {f.findtext('p:name', namespaces=ns): int(f.findtext('p:field_number', namespaces=ns))-1 for f in fields}
    assert next(f for f in fields if f.findtext('p:name', namespaces=ns)=='AMBIENT_TEMP').findtext('p:unit', namespaces=ns).upper() == 'KELVIN'
    weather_url = xml_url[:-4]+'.TAB'
    buckets = [{'temperature': [], 'radiation': [], 'times': []} for _ in range(24)]
    for row in csv.reader(io.StringIO(fetch(weather_url))):
        get = lambda name: row[columns[name]].strip()
        hour = int(get('LMST').split('M')[1][:2]); flag = get('AMBIENT_TEMP_CONFIDENCE_LEVEL'); value = float(get('AMBIENT_TEMP'))
        if len(flag) > 8 and flag[8] == '1' and 100 < value < 350:
            buckets[hour]['temperature'].append(value); buckets[hour]['times'].append(get('TIMESTAMP'))
    product = next((name for name in rad_products if re.search(f'_{sol:04d}_V00.TXT$', name)), None)
    rad_url = RAD+product if product else None
    if rad_url:
        label = fetch(rad_url[:-4]+'.LBL')
        assert 'microGray / Hour' in label
        for observation in re.split(r'\[OBSERVATION:', fetch(rad_url))[1:]:
            qc = re.search(r'\bQC=([01]+)', observation)
            rate = re.search(r'\[DOSIMETRY_TOTAL_DOSE_E:\s*\d+\]\s*([\d.eE+-]+)', observation)
            mars = re.search(r'START_OBS_MARS="(\d+) (\d+):', observation)
            if qc and set(qc.group(1)) == {'0'} and rate and mars and int(mars.group(1)) == sol:
                value = float(rate.group(1)); hour = int(mars.group(2))
                if 0 <= hour < 24 and math.isfinite(value) and value >= 0:
                    buckets[hour]['radiation'].append(value)
    # Last published rover visit at or before the sol: contextual, not per-reading localization.
    waypoint = max((f for f in waypoints if f['properties']['sol'] <= sol), key=lambda f: f['properties']['sol'])
    lon, lat = waypoint['geometry']['coordinates'][:2]
    records = []
    for hour, b in enumerate(buckets):
        records.append({'sol': sol, 'hour': hour, 'temperature': round(median(b['temperature']), 4) if b['temperature'] else None,
                        'radiation': round(median(b['radiation']), 5) if b['radiation'] else None,
                        'temperatureSamples': len(b['temperature']), 'radiationSamples': len(b['radiation']),
                        'firstSclk': min(b['times']) if b['times'] else None, 'lastSclk': max(b['times']) if b['times'] else None})
    print(f'Sol {sol}: {sum(bool(b["temperature"]) for b in buckets)} temperature / {sum(bool(b["radiation"]) for b in buckets)} RAD hours', flush=True)
    return {'sol': sol, 'lon': lon, 'lat': lat, 'waypointSol': waypoint['properties']['sol'],
            'weatherUrl': weather_url, 'radiationUrl': rad_url, 'records': records}


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    waypoint_url = 'https://mars.nasa.gov/mmgis-maps/MSL/Layers/json/MSL_waypoints.json'
    waypoints = json.loads(fetch(waypoint_url))['features']
    rad_products = re.findall(r'href="([^"]+\.TXT)"', fetch(RAD), re.I)
    with ThreadPoolExecutor(max_workers=4) as pool:
        sols = list(pool.map(lambda sol: history_sol(sol, rad_products, waypoints), SOLS))
    records = [r for s in sols for r in s['records']]
    layers = [grs_layer('k', 1, 'wt%'), grs_layer('th', 10000, 'ppm'), grs_layer('h2o', 1, 'wt%'), mcs_layer()]
    forecast = {'issueSol': 28, 'targetSol': 29, 'trainingSols': [22, 28], 'method': 'Seven-sol same-hour median; at least three observations per hour.',
                'spreadNote': '10th–90th percentile of training observations, not a calibrated prediction interval.',
                'temperature': predict(records, 28, 'temperature'), 'radiation': predict(records, 28, 'radiation'),
                'validation': {q: validate(records, q, list(range(24, 29))) for q in ['temperature','radiation']}}
    payload = {'schemaVersion': 1, 'id': 'mars-environment-v1', 'reference': 'Mars spherical display frame; per-layer source coordinate conventions and limitations apply',
               'layers': layers, 'history': {'firstSol': 10, 'lastSol': 28, 'site': 'Curiosity / Gale', 'waypointSource': waypoint_url,
                'positionNote': 'Last published waypoint at or before each sol: approximate site context, not per-reading localization. No position error bound supplied.',
                'timeNote': 'REMS: LMST bins. RAD: archive START_OBS_MARS hour bins, kept as instrument time; cross-instrument synchronization is not asserted.',
                'qualityNote': 'Temperature: ambient reliability byte 8 = 1, physical range 100–350 K; other flags not all certified. RAD: all-zero QC, finite nonnegative detector E rates; unweighted hourly medians.',
                'sols': sols}, 'forecast': forecast, 'sources': sorted(sources.values(), key=lambda s:s['url'])}
    (OUT/'catalog.json').write_text(json.dumps(payload, separators=(',', ':'), allow_nan=False)+'\n')
    (OUT/'summary.json').write_text(json.dumps({'id': payload['id'], 'layers': [{k:v for k,v in l.items() if k!='samples'}|{'samples':len(l['samples']), 'valid':sum(s['value'] is not None for s in l['samples'])} for l in layers],
                                              'sols': len(sols), 'hourlyRecords': len(records), 'forecast': forecast, 'sources':len(sources)}, indent=2)+'\n')
    print('Prepared', OUT, 'with', len(sources), 'source records.', flush=True)


if __name__ == '__main__':
    main()
