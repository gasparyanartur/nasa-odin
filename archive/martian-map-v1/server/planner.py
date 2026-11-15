"""Directed, implicit-grid A*. All geometry and costs use local meters."""
import heapq
import math
import numpy as np


class NoRoute(ValueError):
    def __init__(self, message, diagnostics=None):
        super().__init__(message)
        self.diagnostics = diagnostics


class Terrain:
    def __init__(self, heights, slopes, valid, step=5.0):
        self.heights, self.slopes, self.valid = heights, slopes, valid.astype(bool)
        self.rows, self.cols = heights.shape
        self.step = step
        self.half_x, self.half_y = (self.cols-1)*step/2, (self.rows-1)*step/2

    def cell(self, x, y):
        if not math.isfinite(x) or not math.isfinite(y) or abs(x) > self.half_x or abs(y) > self.half_y:
            raise NoRoute('Point is outside the prepared terrain footprint.')
        return round((self.half_y-y)/self.step), round((x+self.half_x)/self.step)

    def point(self, row, col):
        return [col*self.step-self.half_x, self.half_y-row*self.step, float(self.heights[row, col])]

    def permitted(self, slope_limit, exclusions):
        base = self.valid & np.isfinite(self.heights) & np.isfinite(self.slopes) & (self.slopes <= slope_limit)
        # Walking height is bilinear: reserve its right/down interpolation footprint too.
        # This matches the browser sampler rather than planning through unwalkable fringe cells.
        mask = base & np.concatenate([base[:,1:],base[:,-1:]],axis=1)
        mask &= np.concatenate([mask[1:,:],mask[-1:,:]],axis=0)
        if exclusions:
            yy, xx = np.indices(mask.shape)
            xx = xx*self.step-self.half_x
            yy = self.half_y-yy*self.step
            for area in exclusions:
                self.cell(area['x'],area['y'])
                # Include cells touching the exclusion, not just cell centers.
                mask &= (xx-area['x'])**2+(yy-area['y'])**2 > (area['radius']+self.step/math.sqrt(2))**2
        return mask

    def edge(self, a, b, mode, slope_limit, speed):
        dr, dc = b[0]-a[0], b[1]-a[1]
        flat = math.hypot(dr, dc)*self.step
        dz = float(self.heights[b]-self.heights[a])
        distance = math.hypot(flat, dz)
        grade = dz/flat
        seconds = distance/speed*(1+3*max(0, grade)+1.5*max(0, -grade))
        slope = max(float(self.slopes[a]), float(self.slopes[b]))
        cost = distance if mode == 'shortest' else distance*(1+4*(slope/slope_limit)**2+8*max(0, grade))
        return cost, distance, seconds, dz, slope

    def endpoints(self, start, goal, settings, labels=('Habitat / start', 'Destination')):
        """Explain the exact same footprint and exclusion mask used by search."""
        limit, exclusions = settings['maxSlopeDeg'], settings.get('exclusions', [])
        info, cells = [], []
        for label, point in zip(labels, (start, goal)):
            reasons, hits = [], []
            endpoint = {'label': label, 'x': point[0], 'y': point[1], 'reasons': reasons, 'exclusionIndices': hits}
            info.append(endpoint)
            try:
                row, col = self.cell(*point)
            except NoRoute:
                reasons.append(f'Outside the prepared footprint (east ±{self.half_x:g} m, north ±{self.half_y:g} m).')
                cells.append(None)
                continue
            cells.append((row, col))
            endpoint.update(x=col*self.step-self.half_x, y=self.half_y-row*self.step)
            footprint = np.s_[row:min(row+2,self.rows), col:min(col+2,self.cols)]
            valid = self.valid[footprint] & np.isfinite(self.heights[footprint]) & np.isfinite(self.slopes[footprint])
            if not valid.all():
                reasons.append('Missing or invalid terrain in the walking interpolation footprint.')
            slopes = self.slopes[footprint][valid]
            if slopes.size:
                maximum = float(slopes.max())
                endpoint['slopeDeg'] = maximum
                if maximum > limit:
                    reasons.append(f'Walking-footprint slope {maximum:.1f}° exceeds the {limit:g}° limit.')
            for i, area in enumerate(exclusions):
                distance = math.hypot(endpoint['x']-area['x'], endpoint['y']-area['y'])
                if distance <= area['radius']+self.step/math.sqrt(2):
                    hits.append(i)
                    reasons.append(f'Exclusion #{i+1}: center E {area["x"]:g} / N {area["y"]:g} m, radius {area["radius"]:g} m; endpoint is {distance:.1f} m from its center (including the cell margin).')
        diagnostics = {'code': 'blocked_endpoints', 'endpoints': info, 'slopeLimitDeg': limit,
                       'stepM': self.step, 'activeExclusionCount': len(exclusions), 'notes': []}
        if any(e['reasons'] for e in info):
            message = ' '.join(f'{e["label"]} is blocked: {" ".join(e["reasons"])}' for e in info if e['reasons'])
            raise NoRoute(message, diagnostics)
        return cells[0], cells[1], self.permitted(limit, exclusions), diagnostics

    @staticmethod
    def connected(mask, start, goal):
        # Four-neighbor connectivity is equivalent to our eight-neighbor policy:
        # diagonals cannot connect components because corner cutting is forbidden.
        if not mask[start] or not mask[goal]:
            return False
        seen = np.zeros(mask.shape, dtype=bool)
        seen[start] = True
        stack = [start]
        rows, cols = mask.shape
        while stack:
            row, col = stack.pop()
            if (row, col) == goal:
                return True
            for nr, nc in ((row-1,col),(row+1,col),(row,col-1),(row,col+1)):
                if 0 <= nr < rows and 0 <= nc < cols and mask[nr,nc] and not seen[nr,nc]:
                    seen[nr,nc] = True
                    stack.append((nr,nc))
        return False

    def disconnected(self, start, goal, settings, diagnostics):
        """Counterfactual checks identify barriers without altering a route's limits."""
        limit, exclusions = settings['maxSlopeDeg'], settings.get('exclusions', [])
        diagnostics['code'] = 'disconnected'
        notes = diagnostics['notes']
        if not self.connected(self.permitted(float('inf'), []), start, goal):
            notes.append('Missing or invalid terrain separates these endpoints even with slope and exclusion constraints removed.')
        else:
            without_exclusions = self.connected(self.permitted(limit, []), start, goal)
            without_slope = self.connected(self.permitted(float('inf'), exclusions), start, goal)
            if not without_exclusions:
                notes.append(f'Terrain above the {limit:g}° slope limit separates these endpoints even without exclusions.')
            if not without_slope:
                notes.append('Active exclusions separate these endpoints even with the slope limit removed.')
            if without_exclusions:
                notes.append('A connected path exists at the current slope limit when active exclusions are removed; the exclusions block the connection.')
            if without_slope:
                notes.append('Removing the slope limit restores a connected path with current exclusions retained; slopes block the connection.')
            if without_exclusions and without_slope:
                notes.append('Slope limits and exclusions together close the available corridors.')
        raise NoRoute('No connected route satisfies the terrain and exclusion constraints. ' + ' '.join(notes), diagnostics)

    def search(self, start, goal, settings, mode='shortest', dijkstra=False):
        start, goal, mask, diagnostics = self.endpoints(start, goal, settings)
        if start == goal:
            diagnostics['code'] = 'same_cell'
            raise NoRoute('Select two different terrain cells.', diagnostics)
        best = np.full(mask.shape, np.inf)
        parent = np.full((self.rows, self.cols, 2), -1, dtype='int32')
        best[start] = 0
        queue = [(0., 0., start)]
        while queue:
            _, cost, cell = heapq.heappop(queue)
            if cost != best[cell]:
                continue
            if cell == goal:
                break
            row, col = cell
            for dr, dc in [(-1,0),(1,0),(0,-1),(0,1),(-1,-1),(-1,1),(1,-1),(1,1)]:
                nr, nc = row+dr, col+dc
                if not (0 <= nr < self.rows and 0 <= nc < self.cols and mask[nr,nc]):
                    continue
                if dr and dc and (not mask[row,nc] or not mask[nr,col]):
                    continue
                neighbor = nr,nc
                edge = self.edge(cell, neighbor, mode, settings['maxSlopeDeg'], settings['speedMps'])
                if edge[0]+cost < best[neighbor]:
                    best[neighbor] = edge[0]+cost
                    parent[neighbor] = cell
                    h = 0 if dijkstra else math.hypot(goal[0]-nr, goal[1]-nc)*self.step
                    heapq.heappush(queue,(edge[0]+cost+h, edge[0]+cost, neighbor))
        if not math.isfinite(best[goal]):
            self.disconnected(start, goal, settings, diagnostics)
        cells = [goal]
        while cells[-1] != start:
            cells.append(tuple(parent[cells[-1]]))
        cells.reverse()
        distance = seconds = ascent = descent = maximum = 0.
        profile = [{'distanceM':0., 'elapsedS':0., 'elevationM':float(self.heights[start]), 'slopeDeg':float(self.slopes[start])}]
        segments = []
        for a, b in zip(cells, cells[1:]):
            cost, d, t, dz, slope = self.edge(a,b,mode,settings['maxSlopeDeg'],settings['speedMps'])
            flat=math.hypot(b[0]-a[0],b[1]-a[1])*self.step
            grade=dz/flat
            segments.append({'fromDistanceM':distance,'distanceM':d,'durationS':t,'slopeDeg':slope,
                             'gradePercent':grade*100,'cost':cost,
                             'slopePenalty':d*4*(slope/settings['maxSlopeDeg'])**2 if mode=='gentler' else 0.,
                             'uphillPenalty':d*8*max(0,grade) if mode=='gentler' else 0.})
            distance += d
            seconds += t
            ascent += max(0,dz)
            descent += max(0,-dz)
            maximum = max(maximum,slope)
            profile.append({'distanceM':distance,'elapsedS':seconds,'elevationM':float(self.heights[b]),'slopeDeg':slope})
        dose = seconds/3600*settings['doseRateMicroGyH']
        return {'mode': mode, 'points': [self.point(*c) for c in cells], 'profile':profile,'segments':segments,
                'metrics': {'distanceM': distance, 'durationS': seconds, 'ascentM': ascent, 'descentM': descent,
                            'maxSlopeDeg': maximum, 'doseMicroGy': dose, 'terrainCost': float(best[goal])}}
