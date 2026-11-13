import { OVERLAYS, type OverlayId, type OverlaySettings } from './datasets/catalog';

export default function RegionalLayers({settings,onChange,prefix=''}:{settings:OverlaySettings;onChange:(id:OverlayId,patch:Partial<OverlaySettings[OverlayId]>)=>void;prefix?:string}) {
  return <div className="regional-layers">
    {OVERLAYS.map(layer=><div className="regional-layer" key={layer.id}>
      <label className="check"><input aria-label={`${prefix}${layer.name}`} type="checkbox" checked={settings[layer.id].visible} onChange={e=>onChange(layer.id,{visible:e.target.checked})}/>{layer.name}</label>
      {settings[layer.id].visible&&<><label className="overlay-opacity">Opacity <output>{Math.round(settings[layer.id].opacity*100)}%</output><input aria-label={`${prefix}${layer.name} opacity`} type="range" min="0" max="100" value={settings[layer.id].opacity*100} onChange={e=>onChange(layer.id,{opacity:Number(e.target.value)/100})}/></label><p className="layer-legend">{layer.legend}</p></>}
    </div>)}
  </div>;
}
