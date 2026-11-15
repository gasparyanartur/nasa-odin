"""Reduce actual PDS Sol 10 REMS and RAD products; keep missing values and source flags."""
from pathlib import Path
import csv
import hashlib
import io
import json
import re
import statistics
import requests
import xml.etree.ElementTree as ET

ROOT=Path(__file__).resolve().parents[1]
CACHE=ROOT/'tmp'/'environment-sources'
OUT=ROOT/'public'/'gale'
BASE='https://atmos.nmsu.edu/PDS/data/PDS4/msl_rems_bundle/data_calibrated/SOL_00001_00089/SOL00010/'
REMS='RME_398334213RMD00100000000_______PA'
RAD='RAD_RDR_2012_228_20_41_0010_V00'
RAD_BASE='https://pds-ppi.igpp.ucla.edu/data/MSL-M-RAD-3-RDR-V1.0/DATA/SOL_00000_00089/'


def fetch(url,name):
    CACHE.mkdir(parents=True,exist_ok=True)
    path=CACHE/name
    if not path.exists():
        print('Downloading',name,flush=True)
        r=requests.get(url,timeout=90);r.raise_for_status();path.write_bytes(r.content)
    return path.read_text()


def main():
    tab=fetch(BASE+REMS+'.TAB',REMS+'.TAB')
    label=fetch(BASE+REMS+'.xml',REMS+'.xml')
    root=ET.fromstring(label);ns={'p':'http://pds.nasa.gov/pds4/pds/v1'}
    columns={f.find('p:name',ns).text:int(f.find('p:field_number',ns).text)-1 for f in root.findall('.//p:Field_Character',ns)}
    rows=list(csv.reader(io.StringIO(tab)))
    buckets=[{'temperature':[],'pressure':[],'wind':[]} for _ in range(24)]
    quality={}
    for row in rows:
        get=lambda name:row[columns[name]].strip()
        hour=int(get('LMST').split('M')[1][:2])
        for value,flag,key,quality_index in [('AMBIENT_TEMP','AMBIENT_TEMP_CONFIDENCE_LEVEL','temperature',8),('PRESSURE','PS_CONFIDENCE_LEVEL','pressure',1),('HORIZONTAL_WIND_SPEED','WS_CONFIDENCE_LEVEL','wind',5)]:
            f=get(flag);v=float(get(value));quality.setdefault(flag,set()).add(f)
            if len(f)>quality_index and f[quality_index]=='1' and v>-900:
                buckets[hour][key].append(v)
    weather=[]
    for hour,b in enumerate(buckets):
        median=lambda key:round(statistics.median(b[key]),3) if b[key] else None
        weather.append({'timeLabel':f'Sol 10, {hour:02d}:00–{hour:02d}:59 LMST','hour':hour,
                        'temperatureK':median('temperature'),'pressurePa':median('pressure'),'windMps':median('wind'),
                        'acceptedSamples':{k:len(v) for k,v in b.items()}})
    rad=fetch(RAD_BASE+RAD+'.TXT',RAD+'.TXT')
    rad_label=fetch(RAD_BASE+RAD+'.LBL',RAD+'.LBL')
    if 'microGray / Hour' not in rad_label:
        raise RuntimeError('RAD units could not be verified from label')
    rates=[]
    for observation in re.split(r'\[OBSERVATION:',rad)[1:]:
        qc=re.search(r'\bQC=([01]+)',observation)
        rate=re.search(r'\[DOSIMETRY_TOTAL_DOSE_E:\s*\d+\]\s*([\d.eE+-]+)',observation)
        if rate and qc and set(qc.group(1))=={'0'}:
            value=float(rate.group(1))
            if value>=0:rates.append(value)
    if not rates:raise RuntimeError('No RAD observations passed quality selection')
    result={'sol':10,'weather':weather,'weatherSource':BASE+REMS+'.TAB','weatherProduct':REMS,
            'weatherNote':'Historical Curiosity observations, Sol 10 (2012-08-15/16). Hourly medians in LMST; missing/unknown/unreliable samples excluded using ambient-temperature reliability byte 8, pressure shadow byte 1, wind reliability byte 5. Other confidence flags retained in the audit. Site-level context, not a spatial weather map. Missing wind remains null; editable wind is an assumption.',
            'radiation':{'rateMicroGyH':statistics.mean(rates),'source':RAD_BASE+RAD+'.TXT','product':RAD,'observations':len(rates),
                         'note':'Historical mean of Sol 10 RAD detector E dose-rate observations with all-zero QC. Label units: microGray / Hour. Unweighted observation mean, used as a uniform fixed-rate demonstration proxy. Detector absorbed dose is not astronaut dose equivalent; no suit or terrain shielding is modeled.'},
            'audit':{'weatherRows':len(rows),'qualityFlags':{k:sorted(v) for k,v in quality.items()},'radMin':min(rates),'radMax':max(rates),
                     'sourceChecksums':{p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in CACHE.iterdir() if p.is_file()}}}
    OUT.mkdir(parents=True,exist_ok=True)
    (OUT/'environment.json').write_text(json.dumps(result,indent=2)+'\n')
    print(json.dumps({'noon':weather[12],'radiation':result['radiation']},indent=2))


if __name__=='__main__':main()
