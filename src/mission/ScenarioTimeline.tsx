import type { Environment } from './data';
import { historicalAt, lmstLabel } from './conditions';

export default function ScenarioTimeline({environment,hour,playing,onHour,onToggle}:{environment:Environment;hour:number;playing:boolean;onHour:(hour:number)=>void;onToggle:()=>void}) {
  const current=historicalAt(environment,hour);
  return <section className="scenario-timeline" aria-label="Historical conditions timeline">
    <header><div><span className="eyebrow">HISTORICAL REPLAY / SOL {environment.sol}</span><h3 data-testid="scenario-time">{lmstLabel(hour)}</h3></div><button className="secondary" onClick={onToggle}>{playing?'Pause timelapse':'Play timelapse'}</button></header>
    <div className="temperature-bars" aria-label="24 hourly REMS air temperature medians">
      {Array.from({length:24},(_,h)=>{const w=historicalAt(environment,h);return <button key={h} aria-label={`${String(h).padStart(2,'0')}:00, ${w?.temperatureK?.toFixed(1)??'unknown'} K`} aria-pressed={Math.floor(hour)===h} onClick={()=>onHour(h)} title={w?.timeLabel??'No observation'}><span style={{height:`${w?.temperatureK==null?3:Math.max(8,(w.temperatureK-170)/100*100)}%`}}/></button>;})}
    </div>
    <input aria-label="Historical timeline" type="range" min="0" max="23.99" step="0.01" value={hour} onChange={e=>onHour(Number(e.target.value))}/>
    <div className="timeline-labels"><span>00:00</span><span>06:00</span><span>12:00</span><span>18:00</span><span>24:00</span></div>
    <div className="timeline-reading"><strong>{current?.temperatureK?.toFixed(1)??'—'} K <small>REMS air temperature</small></strong><span>{current?.pressurePa?.toFixed(1)??'—'} Pa · {current?.windMps==null?'Wind unavailable':`${current.windMps} m/s wind`}</span></div>
    <p className="caption">{environment.earthDate??'2012'} · hourly site {environment.aggregation??'medians'}, held within each bin. Replay: 30 LMST min/s. Scrubbing resets the plan. Playback stops at the end of Sol {environment.sol}. No forecast.</p>
  </section>;
}
