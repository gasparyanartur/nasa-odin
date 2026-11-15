"""Offline Python oracle for the browser planner parity tests; never shipped."""
import json
from server.app import load_data, routes, return_route, RouteRequest, ReturnRequest

cases = []
for dataset in ['gale-bradbury-v1', 'gale-boxwork-v1']:
    meta, _ = load_data(dataset)
    start = meta.get('defaultStart', {'x': 0, 'y': 0})
    goal = meta.get('defaultGoal', {'x': 600, 'y': 450})
    requests = [
        ('manual', 'routes', {}),
        ('historical', 'routes', {'settings': {'conditionsMode': 'historical', 'departureHour': 12.75, 'dwellMin': 10, 'minTemperatureK': 251}}),
        ('sol-end', 'routes', {'settings': {'conditionsMode': 'historical', 'departureHour': 23.75}}),
        ('blocked', 'routes', {'settings': {'exclusions': [{**start, 'radius': 40}]}}),
        ('slope', 'routes', {'settings': {'maxSlopeDeg': 1}}),
        ('outside', 'routes', {'goal': {'x': meta['extentM'], 'y': 0}}),
        ('same-cell', 'routes', {'goal': start}),
        ('half-cell', 'return', {'start': {'x': start['x'] + 2.5, 'y': start['y'] - 2.5}, 'goal': start, 'elapsedS': 100}),
        ('return', 'return', {'start': goal, 'goal': start, 'mode': 'gentler', 'elapsedS': 600, 'settings': {'conditionsMode': 'historical', 'departureHour': 14.9, 'minTemperatureK': 253}}),
        ('at-habitat', 'return', {'goal': start, 'elapsedS': 600, 'settings': {'maxDurationMin': 1}}),
    ]
    for name, operation, override in requests:
        request = {'datasetId': dataset, 'start': start, 'goal': goal, **override}
        model = (RouteRequest if operation == 'routes' else ReturnRequest)(**request)
        response = (routes if operation == 'routes' else return_route)(model)
        result = json.loads(response.body) if hasattr(response, 'body') else response
        cases.append({'name': dataset + '/' + name, 'operation': operation, 'folder': 'gale' if dataset == 'gale-bradbury-v1' else 'boxwork', 'request': model.model_dump(), 'result': result})
print(json.dumps(cases))
