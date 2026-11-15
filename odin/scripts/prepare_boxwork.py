"""Prepare the integrated Boxwork package from the committed Fable inputs (no downloads)."""
from pathlib import Path
import hashlib
import json
import shutil
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT/'app'  # the donor data kept at odin/app/ (ROOT is this folder)
OUT = ROOT/'public/boxwork'

def prepare():
    OUT.mkdir(parents=True, exist_ok=True)
    raw = SOURCE/'public/data'
    scene = json.loads((raw/'scene.json').read_text())
    # Preserve the original encoded grids, tiled imagery and provenance for rendering.
    shutil.copytree(raw, OUT/'detail', dirs_exist_ok=True)
    for name in ['DATA-LICENSE.md', 'LICENSE', 'sources.json']:
        shutil.copyfile(SOURCE/name, OUT/name)
    h = np.fromfile(raw/'dem_core.bin', '<u2').reshape(1025,1025)
    valid = h != scene['height']['nodata']
    z = scene['height']['offset_m'] + h.astype(float)*scene['height']['scale_m']
    gs = scene['ground_scale']['x']
    # Ground-metre 1000 m square sits entirely inside the projected 1024 m core.
    n, step, extent = 201, 5., 1000.
    yy, xx = np.indices((n,n))
    x, y = xx*step-extent/2, extent/2-yy*step
    col, row = x/gs+512, 512-y
    c, r = np.floor(col).astype(int), np.floor(row).astype(int)
    dx, dy = col-c, row-r
    heights = (z[r,c]*(1-dx)+z[r,c+1]*dx)*(1-dy)+(z[r+1,c]*(1-dx)+z[r+1,c+1]*dx)*dy
    # Native gradient retained conservatively around each analytical interpolation node.
    gz_y, gz_x = np.gradient(z, 1., gs)
    native = np.degrees(np.arctan(np.hypot(gz_x, gz_y)))
    slopes = np.zeros((n,n)); mask = np.ones((n,n), dtype=bool)
    for dr in range(-3,5):
        for dc in range(-3,5):
            slopes = np.maximum(slopes, native[r+dr,c+dc])
            mask &= valid[r+dr,c+dc]
    heights.astype('<f4').tofile(OUT/'height.f32')
    slopes.astype('<f4').tofile(OUT/'slope.f32')
    mask.astype('u1').tofile(OUT/'valid.u8')
    # Map images use the exact same ground-metre footprint as route coordinates.
    for mode in ['colour','grey']:
        mosaic = Image.new('RGB', (4096,4096))
        for tr in range(2):
            for tc in range(2):
                with Image.open(raw/f'ortho/{mode}_core_{tr}_{tc}.webp') as tile:
                    mosaic.paste(tile, (tc*2048,tr*2048))
        crop = (2048-2000/gs,48,2048+2000/gs,4048)
        mosaic.resize((1600,1600), Image.Resampling.LANCZOS, box=crop).save(OUT/('ortho.jpg' if mode=='colour' else 'ortho-grey.jpg'),quality=94)
    for name, values, lo, hi in [('elevation',heights,float(heights.min()),float(heights.max())),('slope',slopes,0,30)]:
        t = np.clip((values-lo)/(hi-lo),0,1)[...,None]
        rgb = np.array([70,139,133])*(1-t)+np.array([190,105,67])*t
        rgba = np.concatenate([rgb,np.where(mask,255,0)[...,None]],axis=-1).astype('u1')
        Image.fromarray(rgba).save(OUT/f'{name}.png')
    conditions = json.loads((raw/'conditions.json').read_text())
    dose = json.loads((raw/'dose.json').read_text())
    environment = {'sol':4600,'earthDate':conditions['earth_date'],'aggregation':'means',
        'weather':[{'hour':v['lmst_hour'],'timeLabel':f"Sol 4600 {v['lmst_hour']:02}:00 LMST",'temperatureK':None if v['air_temp_c'] is None else v['air_temp_c']+273.15,'groundBrightnessTemperatureK':None if v['ground_brightness_temp_c'] is None else v['ground_brightness_temp_c']+273.15,'pressurePa':v['pressure_pa'],'windMps':None,'uvLowerBoundWm2':v['uv_abc_w_m2'],'humidityPct':v['rel_humidity_pct'],'sampleCounts':v['n']} for v in conditions['hours']],
        'weatherSource':conditions['source']['urls'][0],'weatherProduct':'REMS RDR Sol 4600',
        'weatherNote':'Sol 4600 site observations, hourly accepted-sample means. Air and ground brightness temperatures are separate. UV is a lower bound; humidity and wind are unavailable. No spatial weather field or forecast.',
        'radiation':{'rateMicroGyH':dose['dose_rate']['value'],'source':dose['source']['urls'][0],'product':'RAD RDR Sol 4600 detector B','detector':'B','note':'Fixed uniform detector B absorbed-dose-rate proxy; not astronaut dose equivalent. See detail/dose.json for hourly analysis and detector E.','observations':86}}
    (OUT/'environment.json').write_text(json.dumps(environment,indent=2)+'\n')
    waypoints=json.loads((raw/'waypoints.json').read_text())
    evidence={'sourceUrl':waypoints['source']['url'],'path':[{'x':w['x']*gs,'y':w['y'],'sol':w['sol']} for w in waypoints['waypoints'] if w['in_campaign']], 'markers':[{'id':f'drill-{i}','label':d['name']+' · approximate rover position','x':d['x']*gs,'y':d['y'],'note':d.get('note','Nearest published rover position; exact drill position is not published.')} for i,d in enumerate(waypoints['drill_markers'])]}
    (OUT/'evidence.json').write_text(json.dumps(evidence,indent=2)+'\n')
    origin = {'longitude':scene['origin']['lon'],'latitude':scene['origin']['lat']}
    radius=scene['projection']['radius_m']; degrees=180/np.pi
    bounds=[origin['longitude']-500/(radius*gs)*degrees,origin['latitude']-500/radius*degrees,origin['longitude']+500/(radius*gs)*degrees,origin['latitude']+500/radius*degrees]
    meta={'id':'gale-boxwork-v1','regionId':'gale-boxwork','horizontalReference':'Mars planetocentric latitude, east-positive longitude; radius 3396190 m; local ground metres east/north.','version':1,'name':'Gale · Mount Sharp Boxwork','size':n,'stepM':step,'extentM':extent,'origin':origin,'radiusM':radius,'bounds':bounds,'referenceElevationM':float(heights.min()),'minElevationM':float(heights.min()),'maxElevationM':float(heights.max()),'validFraction':float(mask.mean()),'verticalReference':'Source areoid elevations. Source accuracy and registration are not established by encoding precision; see DATA-LICENSE.md and donor alignment report.','resolutionNote':'1 m core height posts; 0.25 m/pixel colour/grey imagery. 5 ground-metre analytical grid over a 1 km square. Source detail/accuracy vary. Surround is display only.','slopeDefinition':'Maximum native DEM gradient in an 8 by 8 sample neighborhood of each 5 m analytical node; browser/planner reserve the interpolation footprint. Donor smoothed 5 m-baseline slopes are a separate product.','attribution':'Calef III & Parker (2016), Parker & Calef III (2025); NASA/JPL-Caltech/University of Arizona; ESA/DLR/FU Berlin. Derived data CC BY-SA 3.0 IGO.','sources':[{'name':'USGS MSL Gale DEM mosaic v3','url':'https://astrogeology.usgs.gov/search/map/mars_msl_gale_merged_dem_1m','catalog':'https://astrogeology.usgs.gov/search/map/mars_msl_gale_merged_dem_1m'},{'name':'USGS Gale HiRISE colour mosaic 2025 and orthophoto v3','url':'https://astrogeology.usgs.gov/','catalog':'https://astrogeology.usgs.gov/'}], 'detail':{'baseUrl':'/boxwork/detail','scene':'scene.json'},'defaultStart':{'x':195,'y':315},'defaultGoal':{'x':5,'y':225},'inputHashes':{str(p.relative_to(SOURCE)):hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(raw.rglob('*')) if p.is_file()}}
    (OUT/'manifest.json').write_text(json.dumps(meta,indent=2)+'\n')
    print(f'Prepared {n}x{n} Boxwork analytical grid; valid {mask.mean():.3f}; slopes {slopes.min():.2f}–{slopes.max():.2f} degrees')

if __name__=='__main__': prepare()
