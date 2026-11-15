// Cesium's shared error counter can reset when a different tile succeeds.
// Count each tile separately so concurrent successes cannot create endless retries.
export function tileRetryBudget(limit=2) {
  const attempts=new Map<string,number>();
  return (tile:{level?:number;x?:number;y?:number})=>{
    const key=`${tile.level}/${tile.x}/${tile.y}`,count=attempts.get(key)??0;
    attempts.set(key,count+1);return count<limit;
  };
}
