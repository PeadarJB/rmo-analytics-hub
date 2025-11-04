// rmo-analytics-hub/src/config/appConfig.ts

import { getConditionColors } from '@/utils/themeHelpers';
import { KPIKey, KPI_LABELS } from './kpiConfig';

// IMPORT from the single source of truth
import {
  ROAD_FIELDS,
  SUBGROUP_OPTIONS,
  getKPIFieldName,
  LA_LAYER_CONFIG,
  LAMetricType,
  LA_FIELD_PATTERNS,
  LA_COLOR_GRADIENTS,
  LA_PERCENTAGE_RANGES,
  SubgroupOption
} from './layerConfig';

// Road segment constants
export const SEGMENT_LENGTH_METERS = 100;
export const SEGMENT_LENGTH_KM = 0.1; // 100m = 0.1km

// Renderer configuration
export const RENDERER_CONFIG = {
  use5ClassRenderers: true,
  /**
   * Gets theme-aware condition colors for map renderers.
   * This function now delegates to `getConditionColors` from `themeHelpers`,
   * which reads the values directly from CSS custom properties.
   */
  getThemeAwareColors: () => getConditionColors(),
  lineWidth: 4
};


/**
 * Defines the structure for a selectable layer in the swipe panel.
 */
interface SwipeLayerOption {
  title: string;
  label: string;
  kpi: KPIKey;
  year: number;
}

/**
 * Configuration for the Swipe Panel.
 */
export const SWIPE_LAYER_CONFIG: {
  leftPanel: { label: string; layers: ReadonlyArray<SwipeLayerOption> };
  rightPanel: { label: string; layers: ReadonlyArray<SwipeLayerOption> };
} = {
  // Corresponds to the 'leadingLayers' in the swipe widget
  leftPanel: {
    label: 'Left/Top Layer (2018)',
    layers: Object.keys(KPI_LABELS).map(key => {
      const kpi = key as KPIKey;
      return {
        title: LA_LAYER_CONFIG.layerTitlePattern(kpi, 2018),
        label: `${KPI_LABELS[kpi]} (2018)`,
        kpi: kpi,
        year: 2018,
      };
    })
  },
  // Corresponds to the 'trailingLayers' in the swipe widget
  rightPanel: {
    label: 'Right/Bottom Layer (2025)',
    layers: Object.keys(KPI_LABELS).map(key => {
      const kpi = key as KPIKey;
      return {
        title: LA_LAYER_CONFIG.layerTitlePattern(kpi, 2025),
        label: `${KPI_LABELS[kpi]} (2025)`,
        kpi: kpi,
        year: 2025,
      };
    })
  }
};

export const CONFIG = {
  title: 'PMS Regional Road Survey 2025',
  webMapId: '3caed4039c514e20b4e50039b92cd27b',
  roadNetworkLayerTitle: 'RoadNetwork Temporal 2011 2025',
  roadNetworkLayerSwipeTitle: 'RoadNetwork Temporal 2011 2025',
  laPolygonLayerTitle: 'RMO LA data',
  
  // USE IMPORTS
  fields: ROAD_FIELDS, // Use imported object
  
  filters: {
    localAuthority: { 
      id: 'localAuthority', 
      label: 'Local Authority', 
      field: ROAD_FIELDS.la, // Use field from imported object
      type: 'multi-select' as const 
    },
    subgroup: {
      id: 'subgroup',
      label: 'Road Subgroup',
      field: 'subgroup',
      type: 'multi-select' as const,
      options: SUBGROUP_OPTIONS // Use imported array
    },
    route: { 
      id: 'route', 
      label: 'Route', 
      field: ROAD_FIELDS.route, // Use field from imported object
      type: 'multi-select' as const 
    }
  },
  defaultKPI: 'iri' as KPIKey,
  defaultYear: 2025,
  defaultGroupBy: ROAD_FIELDS.la, // Use field from imported object
  map: { center: [-8.0, 53.3] as [number, number], zoom: 7 }
} as const;

// Re-export key types and functions that were previously here
export {
  getKPIFieldName,
  LA_LAYER_CONFIG,
  LA_FIELD_PATTERNS,
  LA_COLOR_GRADIENTS,
  LA_PERCENTAGE_RANGES,
};

// Separate type exports are required when 'isolatedModules' is enabled
export type { LAMetricType, SubgroupOption };