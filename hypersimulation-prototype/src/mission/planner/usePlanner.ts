import { useEffect, useMemo } from 'react';
import type { TerrainData } from '../data';
import { BrowserPlanner } from './client';
export function usePlanner(data:TerrainData|undefined){
  const planner=useMemo(()=>data?new BrowserPlanner(data):undefined,[data]);
  useEffect(()=>()=>planner?.dispose(),[planner]);
  return planner;
}
