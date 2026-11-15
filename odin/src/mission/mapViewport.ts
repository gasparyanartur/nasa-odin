export interface MapViewport { zoom:number; x:number; y:number }
export const FULL_MAP:MapViewport={zoom:1,x:0,y:0};
export function boundViewport(v:MapViewport):MapViewport {
  const zoom=Math.max(1,Math.min(8,v.zoom));
  return {zoom,x:Math.max(1-zoom,Math.min(0,v.x)),y:Math.max(1-zoom,Math.min(0,v.y))};
}
export function zoomViewport(v:MapViewport,zoom:number,anchor={x:.5,y:.5}):MapViewport {
  const next=Math.max(1,Math.min(8,zoom)),ratio=next/v.zoom;
  return boundViewport({zoom:next,x:anchor.x-(anchor.x-v.x)*ratio,y:anchor.y-(anchor.y-v.y)*ratio});
}
export function mapPoint(v:MapViewport,p:{x:number;y:number},extent:number) {
  return {x:((p.x-v.x)/v.zoom-.5)*extent,y:(.5-(p.y-v.y)/v.zoom)*extent};
}
