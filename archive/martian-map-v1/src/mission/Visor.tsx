import type { Point, Pose } from './data';
export default function Visor({pose,target,waypoints}:{pose:Pose;target?:Point;waypoints:boolean}) {
  const heading=(pose.heading*180/Math.PI+360)%360;
  const bearing=target?(Math.atan2(target.x-pose.x,target.y-pose.y)*180/Math.PI+360)%360:heading;
  const delta=((bearing-heading+540)%360)-180;
  return <div className="visor-frame" aria-label="Visor navigation overlay">
    <div className="visor-compass"><span className="eyebrow">HEADING / TRUE NORTH</span><div className="compass-track">{Array.from({length:24},(_,i)=>i*15).map(deg=>{const offset=((deg-heading+540)%360)-180;return Math.abs(offset)<=60?<span key={deg} style={{left:`${50+offset/1.2}%`}}>{deg%90===0?['N','E','S','W'][deg/90]:deg}<i/></span>:null;})}</div><b>▾ {heading.toFixed(0)}°</b></div>
    {waypoints&&target&&<div className="visor-waypoint"><span>{Math.abs(delta)<8?'◇':delta<0?'←':'→'}</span><strong>NEXT / DIRECTION</strong><small>{Math.round(Math.hypot(target.x-pose.x,target.y-pose.y))} m · {bearing.toFixed(0)}° bearing</small></div>}
    <span className="visor-label">NAV / DEMONSTRATION</span>
  </div>;
}
