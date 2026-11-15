import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { RegionId } from '../datasets/catalog';
import { api, type Alternative, type Point, type Pose, type Settings, type TerrainData } from '../mission/data';
import { arrivalText, hazardStatus, shouldSample, stopsAt } from './helmet';
import { HAZARD_ZONES } from './hazards';
import { appendSample, closeWalk, listWalks, localStore, saveWalk, startWalk, type Walk, type WalkRegion } from './pathlog';
import { effective, pickMission, pickRegion, toggleFeature, type FeatureId, type MissionId, type Setup } from './presets';
import { isFailure, planScienceWalk, type LegResult, type ScienceWalkFailure, type ScienceWalkPlan } from './sciencewalk';
import { loadSetup, saveSetup } from './setupStore';
import { IDLE, advance, cancelReturn, dismiss, fade, message, reopen, reset as resetStorm, resumeReturn, trigger, AUTO_FADE, type StormState } from './storm';
import { WALK_STOPS } from './sciencewalk';
import { cellSlope, loadWalkTerrain, type SlopeCells } from './preparedRoute';

export type ScienceSource = 'prepared' | 'planned';

export type ScienceState =
  | { status: 'idle' }
  | { status: 'busy'; leg: number; total: number }
  | { status: 'done'; plan: ScienceWalkPlan }
  | { status: 'failed'; failure: ScienceWalkFailure };

interface Args {
  regionId?: RegionId; data?: TerrainData; pose: Pose; walking: boolean; session: number;
}

const walkable = (r?: RegionId): r is WalkRegion => r === 'gale-bradbury' || r === 'gale-boxwork';

/** Marswalk state that lives beside the team app's mission state: walk choice, science walk, stops, storm, walked paths. */
export function useMarswalk({ regionId, data, pose, walking, session }: Args) {
  const [setup, setSetupState] = useState<Setup>(() => loadSetup());
  const [persistent, setPersistent] = useState(true);
  const setSetup = useCallback((next: Setup) => { setSetupState(next); setPersistent(saveSetup(next)); }, []);
  useEffect(() => { if (regionId && regionId !== setup.region) setSetup(pickRegion(setup, regionId)); }, [regionId]);
  const on = useMemo(() => effective(setup), [setup]);
  const boxwork = regionId === 'gale-boxwork';

  // Science walk
  const [science, setScience] = useState<ScienceState>({ status: 'idle' });
  const [scienceSelected, setScienceSelected] = useState(false);
  // On Boxwork the prepared route is the default science walk; a successful re-plan with the team planner replaces it.
  const [scienceSource, setScienceSource] = useState<ScienceSource>('prepared');
  const source = useRef(scienceSource); source.current = scienceSource;
  const scienceRequest = useRef<AbortController | null>(null);
  const clearScience = useCallback(() => { scienceRequest.current?.abort(); scienceRequest.current = null; setScience({ status: 'idle' }); setScienceSelected(false); setScienceSource('prepared'); }, []);
  const choosePrepared = useCallback(() => { setScienceSource('prepared'); setScienceSelected(true); }, []);
  const choosePlanned = useCallback(() => { setScienceSource('planned'); setScienceSelected(true); }, []);
  const planScience = useCallback(async (habitat: Point, settings: Settings) => {
    if (!data || !boxwork) return;
    scienceRequest.current?.abort();
    const c = new AbortController(); scienceRequest.current = c;
    // A selected prepared route stays the guidance while the planner works and when it refuses.
    if (source.current === 'planned') setScienceSelected(false);
    setScience({ status: 'busy', leg: 0, total: WALK_STOPS.length + 1 });
    const call = (start: Point, goal: Point, s: Settings, elapsedS: number) =>
      api<LegResult>('/api/return', { datasetId: data.meta.id, start, goal, settings: s, mode: 'shortest', elapsedS }, c.signal);
    try {
      const plan = await planScienceWalk(data, habitat, settings, call, (leg, total) => { if (scienceRequest.current === c) setScience({ status: 'busy', leg, total }); });
      if (scienceRequest.current !== c) return;
      setScience({ status: 'done', plan }); setScienceSource('planned'); setScienceSelected(true);
    } catch (e) {
      if (scienceRequest.current !== c || (e as Error)?.name === 'AbortError') return;
      setScience({ status: 'failed', failure: isFailure(e) ? e : { message: (e as Error)?.message ?? 'The science walk could not be planned.' } });
    } finally { if (scienceRequest.current === c) scienceRequest.current = null; }
  }, [data, boxwork]);
  const plan = science.status === 'done' ? science.plan : undefined;
  const planned = scienceSource === 'planned' ? plan : undefined;
  const scienceRoute = (prepared?: Alternative) => !scienceSelected || !boxwork ? undefined : planned ? planned.route : prepared;
  const ends = useMemo(() => new Map((planned?.approaches ?? []).map(a => [a.stop.id, a.point])), [planned]);

  // The 1 m walking grid, loaded only while the prepared route is the guidance.
  const [walkData, setWalkData] = useState<{ terrain: TerrainData; slope: SlopeCells }>();
  const [walkDataError, setWalkDataError] = useState('');
  const wantWalk = boxwork && scienceSelected && !planned && !!data?.meta.detail;
  useEffect(() => {
    if (!wantWalk || !data) { setWalkData(undefined); setWalkDataError(''); return; }
    const c = new AbortController();
    loadWalkTerrain(data, c.signal).then(w => { if (!c.signal.aborted) setWalkData(w); }).catch(e => { if ((e as Error).name !== 'AbortError') setWalkDataError((e as Error).message); });
    return () => c.abort();
  }, [wantWalk, data]);

  // Stops reached on this excursion
  const [visited, setVisited] = useState<Set<number>>(() => new Set());
  const [lastArrival, setLastArrival] = useState<number>();
  useEffect(() => { setVisited(new Set()); setLastArrival(undefined); }, [session, regionId]);
  useEffect(() => {
    if (!walking || !boxwork || !on.stops) return;
    const here = stopsAt(pose, ends).filter(s => !visited.has(s.id));
    if (!here.length) return;
    setVisited(v => new Set([...v, ...here.map(s => s.id)]));
    setLastArrival(here[0].id);
  }, [pose.x, pose.y, walking, boxwork, on.stops, ends]);
  const arrival = lastArrival !== undefined && on.stops && boxwork ? WALK_STOPS.find(s => s.id === lastArrival) : undefined;

  // Solar storm scenario
  const [storm, setStorm] = useState<StormState>(IDLE);
  useEffect(() => { setStorm(resetStorm()); }, [session, regionId]);
  useEffect(() => { if (walking && on.spacewx) setStorm(s => advance(s, pose.elapsed, Date.now())); }, [pose.elapsed, walking, on.spacewx]);
  // The notice is for the helmet: its ten seconds start when the helmet view is open, not while the tablet is.
  useEffect(() => { if (walking) setStorm(s => s.warning === 'shown' ? reopen(s, Date.now()) : s); }, [walking]);
  useEffect(() => {
    if (!walking || storm.warning !== 'shown' || storm.shownAtMs === null) return;
    const t = window.setTimeout(() => setStorm(s => fade(s, Date.now())), Math.max(0, storm.shownAtMs + AUTO_FADE.value - Date.now()) + 50);
    return () => window.clearTimeout(t);
  }, [walking, storm.warning, storm.shownAtMs]);
  const runStorm = useCallback(() => setStorm(s => trigger(s.phase === 'active' ? resetStorm() : s, pose.elapsed, Date.now())), [pose.elapsed]);
  const stormMessage = message(storm);

  // Walked paths
  const store = useMemo(() => localStore(), []);
  const current = useRef<Walk | null>(null);
  const latest = useRef(pose); latest.current = pose;
  const [walks, setWalks] = useState<Walk[]>(() => walkable(regionId) ? listWalks(store, regionId) : []);
  const [savedOk, setSavedOk] = useState(store.persistent);
  const refresh = useCallback(() => setWalks(walkable(regionId) ? listWalks(store, regionId) : []), [store, regionId]);
  const flush = useCallback((end: boolean) => {
    // Opening the tablet keeps the last position even when it is closer than one sampling step.
    if (!end && current.current) current.current = appendSample(current.current, { x: latest.current.x, y: latest.current.y, elapsedS: latest.current.elapsed });
    const w = current.current;
    if (w && w.samples.length >= 2) { setSavedOk(saveWalk(store, closeWalk(w, new Date().toISOString())) && store.persistent); }
    if (end) current.current = null;
    refresh();
  }, [store, refresh]);
  useEffect(() => () => flush(true), [session, regionId]);
  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => { if (!walking) flush(false); }, [walking]);
  useEffect(() => {
    if (!walking || !walkable(regionId) || !data) return;
    if (!current.current) {
      const now = new Date();
      current.current = startWalk(`walk-${now.getTime()}`, regionId, `${regionId === 'gale-boxwork' ? 'Boxwork' : 'Bradbury'} walk, ${now.toISOString().slice(0, 16).replace('T', ' ')} UTC`, now.toISOString());
    }
    const last = current.current.samples.at(-1);
    if (shouldSample(last, pose, data.meta.stepM)) current.current = appendSample(current.current, { x: pose.x, y: pose.y, elapsedS: pose.elapsed });
  }, [pose.x, pose.y, walking, regionId, data]);

  const hazard = useMemo(() => boxwork && on.nogo ? hazardStatus(pose) : null, [boxwork, on.nogo, pose.x, pose.y]);

  return {
    setup, persistent, on, boxwork,
    pickMission: (id: MissionId) => { const next = pickMission(setup, id); setSetup(next); return next; },
    toggle: (id: FeatureId) => { const next = toggleFeature(setup, id); setSetup(next); return next; },
    science, scienceSelected, setScienceSelected, planScience, clearScience, plan, scienceSource, choosePrepared, choosePlanned, scienceRoute,
    walkData: wantWalk ? walkData?.terrain : undefined, walkDataError: wantWalk ? walkDataError : '',
    // The slope the prepared route was planned on, for its suit limit check in Look closer.
    walkSlopeAt: wantWalk && walkData ? (p: Point) => cellSlope(walkData.slope, p) : undefined,
    visited, arrival, arrivalLine: arrival ? arrivalText(arrival) : undefined,
    storm, stormMessage, runStorm,
    dismissStorm: () => setStorm(dismiss), reopenStorm: () => setStorm(s => reopen(s, Date.now())),
    cancelReturn: () => setStorm(cancelReturn), resumeReturn: () => setStorm(resumeReturn), resetStorm: () => setStorm(resetStorm()),
    walks, walksPersistent: savedOk, zones: boxwork && on.nogo ? HAZARD_ZONES : undefined, hazard,
  };
}
