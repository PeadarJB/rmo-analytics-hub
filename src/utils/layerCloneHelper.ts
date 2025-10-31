import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import type { KPIKey } from '@/config/kpiConfig';
import type { LAMetricType } from '@/config/appConfig';
import LARendererService from '@/services/LARendererService';

export function cloneLALayer(
  sourceLayer: FeatureLayer,
  kpi: KPIKey,
  year: number,
  metricType: LAMetricType,
  themeMode: 'light' | 'dark',
  title?: string
): FeatureLayer {
  const renderer = LARendererService.createLARenderer(kpi, year, metricType, themeMode);

  const clonedLayer = new FeatureLayer({
    url: sourceLayer.url,
    title: title || `${sourceLayer.title} - ${kpi.toUpperCase()} ${year}`,
    renderer: renderer,
    opacity: 1.0,
    visible: true,
    popupEnabled: sourceLayer.popupEnabled,
    popupTemplate: sourceLayer.popupTemplate
  });

  console.log(`[Clone] Created: ${clonedLayer.title}`);
  return clonedLayer;
}

export function removeClonedLayer(map: __esri.WebMap, layer: FeatureLayer): void {
  if (!map || !layer) return;

  try {
    map.layers.remove(layer);
    layer.destroy();
    console.log(`[Clone] Removed: ${layer.title}`);
  } catch (error) {
    console.error('[Clone] Error removing:', error);
  }
}
