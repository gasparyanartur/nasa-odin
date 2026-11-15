import type { Point, Pose } from './data';
import { Icon } from '../design/icons';

// The helmet-shaped visor opening of design board 14, drawn as a thin line only: nothing fills or tints the view.
const RIM='M500 0C800 0 930 20 970 90C995 140 1000 200 1000 250C1000 300 995 360 970 410C930 480 800 500 500 500C200 500 70 480 30 410C5 360 0 300 0 250C0 200 5 140 30 90C70 20 200 0 500 0Z';

export default function Visor({pose,target,waypoints}:{pose:Pose;target?:Point;waypoints:boolean}) {
  const heading=(pose.heading*180/Math.PI+360)%360;
  const bearing=target?(Math.atan2(target.x-pose.x,target.y-pose.y)*180/Math.PI+360)%360:heading;
  const delta=((bearing-heading+540)%360)-180;
  return <div className="visor-frame" aria-label="Visor navigation overlay">
    <svg className="visor-rim" viewBox="0 0 1000 500" preserveAspectRatio="none" aria-hidden="true"><path className="visor-rim__o" d={RIM}/><path className="visor-rim__i" d={RIM}/></svg>
    <div className="visor-compass"><span className="eyebrow">HEADING / TRUE NORTH</span><div className="compass-track">{Array.from({length:24},(_,i)=>i*15).map(deg=>{const offset=((deg-heading+540)%360)-180;return Math.abs(offset)<=60?<span key={deg} className={deg%90===0?'cardinal':undefined} style={{left:`${50+offset/1.2}%`}}>{deg%90===0?['N','E','S','W'][deg/90]:deg%45===0?deg:''}<i/></span>:null;})}{waypoints&&target&&Math.abs(delta)<=60&&<em className="compass-target" style={{left:`${50+delta/1.2}%`}} aria-hidden="true"/>}</div><b>{heading.toFixed(0)}°</b></div>
    {waypoints&&target&&<div className="visor-waypoint"><span><Icon name={Math.abs(delta)<8?'ahead':delta<0?'bear-left':'bear-right'}/></span><strong className="sr-only">NEXT / DIRECTION</strong><small>{Math.round(Math.hypot(target.x-pose.x,target.y-pose.y))} m · {bearing.toFixed(0)}°</small></div>}
    <span className="visor-label">NAV / DEMONSTRATION</span>
  </div>;
}
