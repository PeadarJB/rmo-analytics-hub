// src/utils/layerCloneHelper.ts
// MODIFIED VERSION - Updated to work with async renderer creation

import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import type { KPIKey } from '@/config/kpiConfig';
import type { LAMetricType } from '@/config/appConfig';
import LARendererService from '@/services/LARendererService';

/**
 * Clone an LA layer with a specific renderer for swipe comparison
 * MODIFIED: Now async to support dynamic max value queries
 *
 * @param sourceLayer - The original LA FeatureLayer to clone
 * @param kpi - The KPI to visualize
 * @param year - The survey year
 * @param metricType - Visualization mode ('average' or 'fairOrBetter')
 * @param themeMode - Current theme for styling
 * @param title - Optional custom title for the cloned layer
 * @returns Promise resolving to the cloned FeatureLayer with continuous gradient renderer
 */
export async function cloneLALayer(
  sourceLayer: FeatureLayer,
  kpi: KPIKey,
  year: number,
  metricType: LAMetricType,
  themeMode: 'light' | 'dark',
  title?: string
): Promise<FeatureLayer> {
  // Create renderer with continuous gradient
  // Now passes the layer to enable max value queries
  const renderer = await LARendererService.createLARenderer(
    kpi,
    year,
    metricType,
    themeMode,
    sourceLayer  // Pass the source layer for querying max values
  );

  const clonedLayer = new FeatureLayer({
    url: sourceLayer.url,
    title: title || `${sourceLayer.title} - ${kpi.toUpperCase()} ${year}`,
    renderer: renderer,
    opacity: 1.0,  // Full opacity for clearer visualization
    visible: true,
    popupEnabled: sourceLayer.popupEnabled,
    popupTemplate: sourceLayer.popupTemplate
  });

  console.log(`[Clone] Created with continuous gradient: ${clonedLayer.title}`);
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
