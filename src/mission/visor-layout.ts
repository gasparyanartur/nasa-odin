import type {Point} from './data';
/** Match the visor's CSS asymmetric rounded border, in surface-local pixels. */
export function insideVisor(p:Point,width:number,height:number,padding=8){
  const left=26+padding,top=14+padding,right=width-26-padding,bottom=height-14-padding;
  if(p.x<left||p.x>right||p.y<top||p.y>bottom)return false;
  const w=width-52,h=height-28;
  for(const [cx,cy,rx,ry,sx,sy] of [
    [26+w*.28,14+h*.14,w*.28-padding,h*.14-padding,-1,-1],
    [width-26-w*.28,14+h*.14,w*.28-padding,h*.14-padding,1,-1],
    [26+w*.32,height-14-h*.22,w*.32-padding,h*.22-padding,-1,1],
    [width-26-w*.32,height-14-h*.22,w*.32-padding,h*.22-padding,1,1],
  ]){if((p.x-cx)*sx>0&&(p.y-cy)*sy>0&&((p.x-cx)/rx)**2+((p.y-cy)/ry)**2>1)return false;}
  return true;
}
export function rectInsideVisor(r:{x:number;y:number;width:number;height:number},w:number,h:number,padding=8){
  return [r.x,r.x+r.width].every(x=>[r.y,r.y+r.height].every(y=>insideVisor({x,y},w,h,padding)));
}
export function captionBounds(width:number,height:number){
  return {left:Math.max(110,width*.15+77),right:width-Math.max(110,width*.15+77),top:Math.max(110,height*.18),bottom:Math.max(110,height-250)};
}
