"""Historical site context, held within hourly LMST bins; never extrapolated."""
from functools import lru_cache
from pathlib import Path
import json

# Mean Mars solar day in SI seconds (NASA Mars24 time algorithm, rounded to milliseconds).
# https://www.giss.nasa.gov/tools/mars24/help/algorithm.html
SOL_SECONDS = 88775.244
HOUR_SECONDS = SOL_SECONDS / 24


@lru_cache
def weather():
    path = Path(__file__).resolve().parents[1] / 'public/gale/environment.json'
    return {row['hour']: row for row in json.loads(path.read_text())['weather']}


def evaluate(settings, seconds, departure_hour=None):
    departure = settings.departureHour if departure_hour is None else departure_hour
    cold = unknown = 0.0
    missing_departure = False
    temperatures = []
    if settings.conditionsMode == 'manual':
        temperatures = [settings.temperatureK]
        cold = seconds if settings.temperatureK < settings.minTemperatureK else 0.0
    else:
        start = departure * HOUR_SECONDS
        end = start + seconds
        cursor = start
        # Include departure even for zero-duration returns at habitat.
        row = weather().get(int(start / HOUR_SECONDS + 1e-10))
        missing_departure = not row or row['temperatureK'] is None
        if not missing_departure:
            temperatures.append(row['temperatureK'])
        while cursor < end:
            hour = int(cursor / HOUR_SECONDS + 1e-10)
            edge = min(end, (hour + 1) * HOUR_SECONDS)
            row = weather().get(hour)
            value = row['temperatureK'] if row else None
            if value is None:
                unknown += edge - cursor
            else:
                temperatures.append(value)
                if value < settings.minTemperatureK:
                    cold += edge - cursor
            cursor = edge
    dose = seconds / 3600 * settings.doseRateMicroGyH
    messages = []
    if cold > 0 or (temperatures and min(temperatures) < settings.minTemperatureK):
        messages.append('Excursion temperature falls below the configured demonstration limit.')
    if unknown > 0 or missing_departure:
        messages.append('Historical temperature coverage is incomplete; excursion conditions are unknown beyond the available bins.')
    if settings.windMps > settings.maxWindMps:
        messages.append('Assumed wind exceeds the configured demonstration limit.')
    if seconds > settings.maxDurationMin * 60:
        messages.append('Excursion including return exceeds the configured time budget.')
    if dose > settings.maxDoseMicroGy:
        messages.append('Excursion including return exceeds the configured detector-dose proxy budget.')
    return {
        'departureHour': departure, 'arrivalHour': departure + seconds / HOUR_SECONDS,
        'minTemperatureK': min(temperatures) if temperatures else None,
        'coldSeconds': cold, 'unknownSeconds': unknown,
        'doseMicroGy': dose, 'warnings': messages,
        'coverageComplete': not missing_departure and unknown == 0,
        'status': 'exceeds' if any('exceeds' in m or 'below' in m for m in messages) else 'unknown' if unknown > 0 or missing_departure else 'within',
    }
