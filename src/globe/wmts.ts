import { Credit, Ellipsoid, GeographicTilingScheme, ImageryLayer, Rectangle, Viewer, WebMapTileServiceImageryProvider } from 'cesium';
import type { DatasetDefinition } from '../datasets/definition';
import type { LayerHandle } from '../datasets/layer-slot';

export function attachWmts(viewer: Viewer, definition: DatasetDefinition, onError: () => void): LayerHandle {
  const p = definition.provider;
  const provider = new WebMapTileServiceImageryProvider({
    ...p,
    tileMatrixLabels: [...p.tileMatrixLabels],
    tilingScheme: new GeographicTilingScheme({ ellipsoid: Ellipsoid.MARS }),
    rectangle: Rectangle.fromDegrees(...definition.bounds),
    maximumLevel: p.tileMatrixLabels.length - 1,
    credit: new Credit(definition.attribution),
  });
  const layer = new ImageryLayer(provider, { show: false });
  const removeError = provider.errorEvent.addEventListener(onError);
  viewer.imageryLayers.add(layer);
  return {
    setVisible: (visible) => { layer.show = visible; viewer.scene.requestRender(); },
    setOpacity: (opacity) => { layer.alpha = opacity; viewer.scene.requestRender(); },
    dispose: () => { removeError(); if (!viewer.isDestroyed()) viewer.imageryLayers.remove(layer, true); },
  };
}
