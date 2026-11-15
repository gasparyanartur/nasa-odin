"""Causal next-sol daily profiles. No spatial prediction or solar-event model."""
from statistics import median


def percentile(values, fraction):
    values = sorted(values)
    index = (len(values) - 1) * fraction
    lo = int(index)
    return values[lo] + (values[min(lo + 1, len(values) - 1)] - values[lo]) * (index - lo)


def predict(records, issue_sol, quantity, window=7):
    """At least three earlier same-hour observations; future rows cannot enter fit."""
    result = []
    for hour in range(24):
        values = [r[quantity] for r in records if issue_sol-window < r['sol'] <= issue_sol
                  and r['hour'] == hour and r[quantity] is not None]
        result.append({'hour': hour, 'value': round(median(values), 5) if len(values) >= 3 else None,
                       'low': round(percentile(values, .1), 5) if len(values) >= 3 else None,
                       'high': round(percentile(values, .9), 5) if len(values) >= 3 else None,
                       'trainingSamples': len(values)})
    return result


def validate(records, quantity, test_sols):
    errors, persistence = [], []
    by_key = {(r['sol'], r['hour']): r[quantity] for r in records}
    per_sol = []
    for sol in test_sols:
        paired = []
        for row in predict(records, sol-1, quantity):
            actual, previous = by_key.get((sol, row['hour'])), by_key.get((sol-1, row['hour']))
            if actual is not None and row['value'] is not None:
                error = abs(row['value']-actual)
                errors.append(error)
                if previous is not None:
                    paired.append((error, abs(previous-actual)))
                    persistence.append((error, abs(previous-actual)))
        per_sol.append({'sol': sol, 'pairedSamples': len(paired)})
    return {'firstTestSol': min(test_sols), 'lastTestSol': max(test_sols), 'samples': len(errors),
            'mae': sum(errors)/len(errors) if errors else None,
            'pairedSamples': len(persistence),
            'pairedModelMae': sum(e[0] for e in persistence)/len(persistence) if persistence else None,
            'persistenceMae': sum(e[1] for e in persistence)/len(persistence) if persistence else None,
            'perSol': per_sol}
