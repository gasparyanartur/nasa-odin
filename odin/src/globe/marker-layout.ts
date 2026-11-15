// Labels can separate close sites without moving the geographic anchor shown on the globe.
export function layoutMarkers<T extends {x:number;y:number}>(markers:T[],width:number,height:number){
  // A hidden globe measures 0 x 0; clamping into that box would pin every label to the top left corner.
  if(!(width>0&&height>0))return [];
  const placed:{left:number;top:number}[]=[];
  return markers.map(marker=>{
    const left=Math.max(8,Math.min(width-190,marker.x));let top=Math.max(24,Math.min(height-24,marker.y));
    for(const offset of [0,50,-50,100,-100,150,-150]){
      const candidate=Math.max(24,Math.min(height-24,marker.y+offset));
      if(!placed.some(other=>Math.abs(other.left-left)<190&&Math.abs(other.top-candidate)<44)){top=candidate;break;}
    }
    placed.push({left,top});return {...marker,left,top};
  });
}
