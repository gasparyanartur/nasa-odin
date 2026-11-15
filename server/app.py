"""Offline Python reference API for tests; the app uses the browser planner."""
from functools import lru_cache
from pathlib import Path
from typing import Literal
import json
import math
import os

import numpy as np
from fastapi import FastAPI
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, ConfigDict, Field
from .planner import Terrain, NoRoute
from .conditions import evaluate

DATA = Path(__file__).resolve().parents[1] / 'public' / 'gale'
DATASETS = {'gale-bradbury-v1': DATA, 'gale-boxwork-v1': DATA.parent / 'boxwork'}
app = FastAPI(title='Martian Map local planner', version='0.7.0')
app.add_middleware(GZipMiddleware, minimum_size=1000)


class Point(BaseModel):
    model_config = ConfigDict(allow_inf_nan=False, extra='forbid')
    x: float = Field(ge=-1000000, le=1000000)
    y: float = Field(ge=-1000000, le=1000000)


class Exclusion(Point):
    radius: float = Field(default=40, ge=5, le=500)


class Settings(BaseModel):
    model_config = ConfigDict(allow_inf_nan=False, extra='forbid')
    speedMps: float = Field(default=.8, ge=.1, le=3)
    maxSlopeDeg: float = Field(default=20, ge=1, le=45)
    maxDurationMin: float = Field(default=90, ge=1, le=480)
    doseRateMicroGyH: float = Field(default=10, ge=0, le=10000)
    maxDoseMicroGy: float = Field(default=50, ge=.01, le=100000)
    temperatureK: float = Field(default=220, ge=100, le=350)
    minTemperatureK: float = Field(default=180, ge=100, le=350)
    windMps: float = Field(default=0, ge=0, le=200)
    maxWindMps: float = Field(default=25, ge=0, le=200)
    conditionsMode: Literal['manual', 'historical'] = 'manual'
    departureHour: float = Field(default=12, ge=0, lt=24)
    dwellMin: float = Field(default=0, ge=0, le=240)
    exclusions: list[Exclusion] = Field(default_factory=list, max_length=30)


class RouteRequest(BaseModel):
    model_config = ConfigDict(extra='forbid')
    datasetId: Literal['gale-bradbury-v1', 'gale-boxwork-v1']
    start: Point
    goal: Point
    settings: Settings = Field(default_factory=Settings)


class ReturnRequest(RouteRequest):
    model_config = ConfigDict(allow_inf_nan=False, extra='forbid')
    mode: Literal['shortest', 'gentler'] = 'shortest'
    elapsedS: float = Field(default=0, ge=0, le=1000000)


@lru_cache
def load_data(dataset_id='gale-bradbury-v1'):
    directory = DATASETS[dataset_id]
    meta = json.loads((directory/'manifest.json').read_text())
    shape = meta['size'],meta['size']
    return meta, Terrain(np.fromfile(directory/'height.f32',dtype='<f4').reshape(shape),
                         np.fromfile(directory/'slope.f32',dtype='<f4').reshape(shape),
                         np.fromfile(directory/'valid.u8',dtype='uint8').reshape(shape),meta['stepM'])


def referenced(route, meta):
    lat = meta['origin']['latitude']
    lon = meta['origin']['longitude']
    radius = meta['radiusM']
    route['geographic'] = [[lon+math.degrees(x/(radius*math.cos(math.radians(lat)))),
                            lat+math.degrees(y/radius),z] for x,y,z in route['points']]
    return route


@app.get('/api/health')
def health():
    meta,_=load_data()
    return {'status':'ok','datasetId':meta['id'],'version':meta['version'],'datasets':[{'id':load_data(k)[0]['id'],'version':load_data(k)[0]['version']} for k in DATASETS]}


@app.post('/api/routes')
def routes(req: RouteRequest):
    meta, terrain = load_data(req.datasetId)
    settings=req.settings.model_dump()
    try:
        result=[]
        for mode in ['shortest','gentler']:
            route=referenced(terrain.search((req.start.x,req.start.y),(req.goal.x,req.goal.y),settings,mode),meta)
            back=referenced(terrain.search((req.goal.x,req.goal.y),(req.start.x,req.start.y),settings,mode),meta)
            total=route['metrics']['durationS']+req.settings.dwellMin*60+back['metrics']['durationS']
            evaluation=evaluate(req.settings,total,dataset_id=req.datasetId)
            dose=evaluation['doseMicroGy']
            route.update(returnRoute=back, roundTripS=total, roundTripDoseMicroGy=dose,
                         warnings=evaluation['warnings'], conditions=evaluation,
                         departures=[evaluate(req.settings,total,h,dataset_id=req.datasetId) for h in range(24)] if req.settings.conditionsMode=='historical' else [])
            result.append(route)
        return {'datasetId':meta['id'],'version':meta['version'],'reference':meta['horizontalReference'],
                'settings':settings,'routes':result,
                'recommendedIndex':min(range(len(result)),key=lambda i:(len(result[i]['warnings']),result[i]['roundTripS'])),
                'assumptions':'Terrain candidates evaluated over outbound travel, destination dwell and return. Historical REMS hourly medians are held within their LMST bins, without extrapolation; manual mode holds the configured temperature. Wind is an assumption. RAD is a uniform fixed detector-rate proxy, not astronaut dosimetry. Recommendation compares these candidates only; no environmental path optimization or guarantee of feasibility.'}
    except NoRoute as exc:
        return JSONResponse(status_code=422, content={'detail': str(exc), 'diagnostics': exc.diagnostics})


@app.post('/api/return')
def return_route(req: ReturnRequest):
    meta, terrain=load_data(req.datasetId)
    try:
        start_cell,goal_cell,_,_=terrain.endpoints((req.start.x,req.start.y),(req.goal.x,req.goal.y),
                                                 req.settings.model_dump(),('Current position','Habitat'))
        if start_cell==goal_cell:
            return {'datasetId':meta['id'],'version':meta['version'],'route':None,'warnings':evaluate(req.settings,req.elapsedS,dataset_id=req.datasetId)['warnings'],'atHabitat':True}
        back=referenced(terrain.search((req.start.x,req.start.y),(req.goal.x,req.goal.y),req.settings.model_dump(),req.mode),meta)
        total=back['metrics']['durationS']+req.elapsedS
        return {'datasetId':meta['id'],'version':meta['version'],'route':back,'warnings':evaluate(req.settings,total,dataset_id=req.datasetId)['warnings'], 'conditions':evaluate(req.settings,total,dataset_id=req.datasetId)}
    except NoRoute as exc:
        return JSONResponse(status_code=422, content={'detail': str(exc), 'diagnostics': exc.diagnostics})


# Mount after API routes so unknown APIs/assets remain proper 404s.
# Static mounting is retained for offline reference tests, not deployment.
STATIC = Path(os.environ.get('MARTIAN_STATIC_DIR', DATA.parents[1] / 'dist'))
if os.environ.get('MARTIAN_STATIC_DIR') and not STATIC.is_dir():
    raise RuntimeError('MARTIAN_STATIC_DIR does not contain a production build.')
if STATIC.is_dir():
    app.mount('/', StaticFiles(directory=STATIC, html=True), name='frontend')
