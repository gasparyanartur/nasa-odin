import type { TerrainData } from './mission/data';
import { OVERLAYS, type OverlayId, type OverlaySettings } from './datasets/catalog';
import InfoMark from './design/InfoMark';
import { Icon } from './design/icons';

export default function RegionalLayers({settings,onChange,prefix='',data}:{data?:TerrainData;settings:OverlaySettings;onChange:(id:OverlayId,patch:Partial<OverlaySettings[OverlayId]>)=>void;prefix?:string}) {
  return <div className="regional-layers">
    {OVERLAYS.map(layer=><div className="regional-layer" key={layer.id}>
      <div className="setting-row"><label className="check"><input aria-label={`${prefix}${layer.name}`} type="checkbox" checked={settings[layer.id].visible} onChange={e=>onChange(layer.id,{visible:e.target.checked})}/><Icon name={layer.id==='imagery'?'photo':layer.id==='elevation'?'height':'ground'}/>{layer.name}</label><InfoMark title={layer.name} does={`Drapes the ${layer.name.toLowerCase()} layer over the globe, inside the prepared Gale footprint only. Display only.`} source={data?.meta.detail?(layer.id==='imagery'?'HiRISE processed colour/grey imagery · 0.25 m/pixel core':layer.id==='slope'?data.meta.slopeDefinition:`Teal low → rust high · ${data.meta.minElevationM.toFixed(1)} to ${data.meta.maxElevationM.toFixed(1)} m source elevations`):layer.legend} coverage={data?.meta.resolutionNote}/></div>
      {settings[layer.id].visible&&<><label className="overlay-opacity">Opacity <output>{Math.round(settings[layer.id].opacity*100)}%</output><input aria-label={`${prefix}${layer.name} opacity`} type="range" min="0" max="100" value={settings[layer.id].opacity*100} onChange={e=>onChange(layer.id,{opacity:Number(e.target.value)/100})}/></label><p className="layer-legend">{data?.meta.detail?(layer.id==='imagery'?'HiRISE processed colour/grey imagery · 0.25 m/pixel core':layer.id==='slope'?data.meta.slopeDefinition:`Teal low → rust high · ${data.meta.minElevationM.toFixed(1)} to ${data.meta.maxElevationM.toFixed(1)} m source elevations`):layer.legend}</p></>}
    </div>)}
  </div>;
}
