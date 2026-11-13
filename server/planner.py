"""Directed, implicit-grid A*. All geometry and costs use local meters."""
import heapq
import math
import numpy as np


class NoRoute(ValueError):
    pass


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

    def search(self, start, goal, settings, mode='shortest', dijkstra=False):
        start, goal = self.cell(*start), self.cell(*goal)
        mask = self.permitted(settings['maxSlopeDeg'], settings.get('exclusions', []))
        if not mask[start] or not mask[goal]:
            raise NoRoute('Start or destination is blocked by terrain, missing data, or an exclusion. Select another point or adjust the declared slope limit.')
        if start == goal:
            raise NoRoute('Select two different terrain cells.')
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
            raise NoRoute('No connected route satisfies the terrain and exclusion constraints.')
        cells = [goal]
        while cells[-1] != start:
            cells.append(tuple(parent[cells[-1]]))
        cells.reverse()
        distance = seconds = ascent = descent = maximum = 0.
        for a, b in zip(cells, cells[1:]):
            _, d, t, dz, slope = self.edge(a,b,mode,settings['maxSlopeDeg'],settings['speedMps'])
            distance += d
            seconds += t
            ascent += max(0,dz)
            descent += max(0,-dz)
            maximum = max(maximum,slope)
        dose = seconds/3600*settings['doseRateMicroGyH']
        return {'mode': mode, 'points': [self.point(*c) for c in cells],
                'metrics': {'distanceM': distance, 'durationS': seconds, 'ascentM': ascent, 'descentM': descent,
                            'maxSlopeDeg': maximum, 'doseMicroGy': dose, 'terrainCost': float(best[goal])}}
