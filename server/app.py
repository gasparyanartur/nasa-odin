from functools import lru_cache
from pathlib import Path
from typing import Literal
import json
import math

import numpy as np
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, ConfigDict, Field
from .planner import Terrain, NoRoute

DATA = Path(__file__).resolve().parents[1] / 'public' / 'gale'
app = FastAPI(title='Martian Map local planner', version='1.0')


class Point(BaseModel):
    model_config = ConfigDict(allow_inf_nan=False, extra='forbid')
    x: float = Field(ge=-1000, le=1000)
    y: float = Field(ge=-1000, le=1000)


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
    exclusions: list[Exclusion] = Field(default_factory=list, max_length=30)


class RouteRequest(BaseModel):
    model_config = ConfigDict(extra='forbid')
    datasetId: Literal['gale-bradbury-v1']
    start: Point
    goal: Point
    settings: Settings = Field(default_factory=Settings)


class ReturnRequest(RouteRequest):
    model_config = ConfigDict(allow_inf_nan=False, extra='forbid')
    mode: Literal['shortest', 'gentler'] = 'shortest'
    elapsedS: float = Field(default=0, ge=0, le=1000000)


@lru_cache
def load_data():
    meta = json.loads((DATA/'manifest.json').read_text())
    shape = meta['size'],meta['size']
    return meta, Terrain(np.fromfile(DATA/'height.f32',dtype='<f4').reshape(shape),
                         np.fromfile(DATA/'slope.f32',dtype='<f4').reshape(shape),
                         np.fromfile(DATA/'valid.u8',dtype='uint8').reshape(shape),meta['stepM'])


def referenced(route, meta):
    lat = meta['origin']['latitude']
    lon = meta['origin']['longitude']
    radius = meta['radiusM']
    route['geographic'] = [[lon+math.degrees(x/(radius*math.cos(math.radians(lat)))),
                            lat+math.degrees(y/radius),z] for x,y,z in route['points']]
    return route


def warnings(settings, seconds, dose):
    result=[]
    if settings.temperatureK < settings.minTemperatureK:
        result.append('Departure temperature is below the configured demonstration limit.')
    if settings.windMps > settings.maxWindMps:
        result.append('Departure wind exceeds the configured demonstration limit.')
    if seconds > settings.maxDurationMin*60:
        result.append('Excursion including return exceeds the configured time budget.')
    if dose > settings.maxDoseMicroGy:
        result.append('Excursion including return exceeds the configured detector-dose proxy budget.')
    return result


@app.get('/api/health')
def health():
    meta,_=load_data()
    return {'status':'ok','datasetId':meta['id'],'version':meta['version']}


@app.post('/api/routes')
def routes(req: RouteRequest):
    meta, terrain = load_data()
    settings=req.settings.model_dump()
    try:
        result=[]
        for mode in ['shortest','gentler']:
            route=referenced(terrain.search((req.start.x,req.start.y),(req.goal.x,req.goal.y),settings,mode),meta)
            back=referenced(terrain.search((req.goal.x,req.goal.y),(req.start.x,req.start.y),settings,mode),meta)
            total=route['metrics']['durationS']+back['metrics']['durationS']
            dose=route['metrics']['doseMicroGy']+back['metrics']['doseMicroGy']
            route.update(returnRoute=back, roundTripS=total, roundTripDoseMicroGy=dose,
                         warnings=warnings(req.settings,total,dose))
            result.append(route)
        return {'datasetId':meta['id'],'version':meta['version'],'reference':meta['horizontalReference'],
                'settings':settings,'routes':result,
                'assumptions':'Fixed departure conditions; time = distance/speed × (1 + 3 uphill grade + 1.5 downhill grade). Dose is a uniform detector-rate proxy, not astronaut dosimetry. Budgets checked after search, not resource-constrained optimization.'}
    except NoRoute as exc:
        raise HTTPException(422,str(exc)) from exc


@app.post('/api/return')
def return_route(req: ReturnRequest):
    meta, terrain=load_data()
    try:
        start_cell=terrain.cell(req.start.x,req.start.y)
        goal_cell=terrain.cell(req.goal.x,req.goal.y)
        mask=terrain.permitted(req.settings.maxSlopeDeg,[e.model_dump() for e in req.settings.exclusions])
        if not mask[start_cell] or not mask[goal_cell]:
            raise NoRoute('Current position or habitat is blocked by the configured terrain/exclusion constraints.')
        if start_cell==goal_cell:
            return {'route':None,'warnings':warnings(req.settings,req.elapsedS,req.elapsedS/3600*req.settings.doseRateMicroGyH),'atHabitat':True}
        back=referenced(terrain.search((req.start.x,req.start.y),(req.goal.x,req.goal.y),req.settings.model_dump(),req.mode),meta)
        total=back['metrics']['durationS']+req.elapsedS
        return {'route':back,'warnings':warnings(req.settings,total,total/3600*req.settings.doseRateMicroGyH)}
    except NoRoute as exc:
        raise HTTPException(422,str(exc)) from exc
