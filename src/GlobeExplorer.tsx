import { useEffect, useRef, useState } from 'react';
import { parseDataset, type DatasetDefinition } from './datasets/definition';
import { GlobeController } from './globe/controller';
import type { TerrainData, Route } from './mission/data';

type Loader = () => Promise<unknown>;

export default function GlobeExplorer({data,route,onExplore}:{data?:TerrainData;route?:Route;onExplore:()=>void}) {
  const container = useRef<HTMLDivElement>(null);
  const controller = useRef<GlobeController | null>(null);
  const sequence = useRef(0);
  const retry = useRef<Loader | null>(null);
  const [dataset, setDataset] = useState<DatasetDefinition | null>(null);
  const [visible, setVisible] = useState(true);
  const [opacity, setOpacity] = useState(1);
  const [pending, setPending] = useState(false);
  const [tilesLoading, setTilesLoading] = useState(false);
  const [error, setError] = useState('');
  const [fatal, setFatal] = useState(false);
  const [localSlope,setLocalSlope]=useState(false);

  async function load(loader: Loader) {
    const request = ++sequence.current;
    controller.current?.invalidatePending();
    retry.current = loader;
    setPending(true);
    setError('');
    try {
      const definition = parseDataset(await loader());
      if (request !== sequence.current || !controller.current) return;
      const committed = await controller.current.replaceDataset(definition);
      if (committed && request === sequence.current) setDataset(definition);
    } catch (reason) {
      if (request === sequence.current) setError(reason instanceof Error ? reason.message : 'Could not load this dataset.');
    } finally {
      if (request === sequence.current) setPending(false);
    }
  }

  useEffect(() => {
    try {
      controller.current = new GlobeController(container.current!, (status) => {
        setTilesLoading(status.loading);
        if (status.error) setError(status.error);
      });
      void load(async () => {
        const response = await fetch(`${import.meta.env.BASE_URL}datasets/mola.json`);
        if (!response.ok) throw new Error('The initial dataset manifest could not load.');
        return response.json();
      });
    } catch {
      setFatal(true);
      setError('The globe could not start. Use a browser with WebGL enabled and reload this page.');
    }
    return () => {
      sequence.current++;
      controller.current?.dispose();
      controller.current = null;
    };
  }, []);
  useEffect(()=>{if(data&&controller.current)void controller.current.setLocalData(data).catch(()=>setError('Local terrain overlay could not load. Reload to retry.'));},[data]);
  useEffect(()=>{controller.current?.setRoute(route);},[route,data]);

  const loading = pending || tilesLoading;

  return <main className="explorer">
    <aside className="sidebar" aria-label="Dataset controls">
      <header className="brand"><span className="brand-mark" aria-hidden="true">◉</span><div>MARTIAN MAP<span>SURFACE EXPLORER</span></div><span className="version">MVP / 01</span></header>
      <section className="intro"><div className="eyebrow">A PLANET OF POSSIBILITIES</div><h1>Explore the <br />surface.</h1><p>One globe. A new perspective with every dataset.</p></section>
      <section className="gale-entry"><div className="section-label">PREPARED EXCURSION / GALE</div><p>Real terrain. A route to follow.</p><div className="button-row"><button className="secondary" disabled={!data} onClick={()=>controller.current?.focusGale()}>Fly to Gale ↗</button><button className="primary" disabled={!data} onClick={onExplore}>Plan excursion →</button></div><label className="check"><input type="checkbox" checked={localSlope} onChange={e=>{setLocalSlope(e.target.checked);controller.current?.setLocalSlope(e.target.checked);}}/> Local slope overlay</label></section>
      <section className="dataset-section">
        <div className="section-label"><span>01 / ACTIVE DATASET</span><span className="tag">RASTER</span></div>
        <h2>{dataset?.name ?? 'Preparing the globe'}</h2>
        <p className="description">{dataset?.description ?? 'Loading the initial surface layer…'}</p>
        <div className="status" role="status" aria-label="Layer status"><span className={`status-dot ${error ? 'warning' : loading ? 'busy' : ''}`} />{error ? 'Needs attention' : loading ? 'Loading surface tiles' : visible ? 'Layer active' : 'Layer hidden'}</div>
        <div className="layer-controls">
          <label className="visibility"><span>Show layer</span><input type="checkbox" role="switch" checked={visible} disabled={fatal} onChange={(event) => { setVisible(event.target.checked); controller.current?.setVisible(event.target.checked); }} /></label>
          <label className="opacity"><span>Opacity <output>{Math.round(opacity * 100)}%</output></span><input type="range" min="0" max="100" value={opacity * 100} disabled={fatal} onChange={(event) => { const value = Number(event.target.value) / 100; setOpacity(value); controller.current?.setOpacity(value); }} /></label>
        </div>
        {error && <div className="error" role="alert"><p>{error}</p>{!fatal && <button onClick={() => { if (retry.current) void load(retry.current); }}>Retry loading <span aria-hidden="true">↻</span></button>}</div>}
        <label className={`import-button ${fatal ? 'disabled' : ''}`}><span aria-hidden="true">＋</span> Load dataset JSON<input aria-label="Load dataset JSON" type="file" accept=".json,application/json" disabled={fatal} onChange={(event) => { const file = event.target.files?.[0]; if (file) void load(async () => { try { return JSON.parse(await file.text()); } catch { throw new Error('Could not read this manifest. Choose a valid JSON dataset file.'); } }); event.target.value = ''; }} /></label>
        <div className="import-note">Replace the active layer without leaving the globe. <a href={`${import.meta.env.BASE_URL}datasets/mola.json`} download="dataset-example.json">Get the example manifest ↗</a></div>
      </section>
      {dataset && <section className="details"><div className="section-label">02 / DATA NOTES</div><dl><dt>Source</dt><dd><a href={dataset.sourceUrl} target="_blank" rel="noreferrer">{dataset.source} ↗</a></dd><dt>Resolution</dt><dd>{dataset.resolution}</dd><dt>Coordinates</dt><dd>Mars · east-positive longitude<br />{dataset.reference}</dd></dl>{dataset.legend && <p className="legend-note">{dataset.legend}</p>}</section>}
      <footer className="sidebar-footer"><span className="small-orbit" aria-hidden="true">◌</span><span>REAL DATA. ROOM TO EXPLORE.</span></footer>
    </aside>
    <section className="map-panel" aria-label="Interactive Mars globe">
      <div ref={container} className="globe" />
      <div className="map-header"><span className="map-caption"><span className="crosshair" aria-hidden="true">＋</span> MARS <span>/</span> GLOBAL VIEW</span><button className="home-button" onClick={() => controller.current?.home()} disabled={fatal} aria-label="Reset globe view">Reset view ↗</button></div>
      <div className="map-guide"><span>DRAG TO ROTATE</span><i /> <span>SCROLL TO ZOOM</span><i /><span>CTRL + DRAG TO TILT</span></div>
      <div className="map-footnote">Global context is a sphere.<br />Gale relief is relative to the patch minimum.</div>
    </section>
  </main>;
}
