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

// ============================================================================
// 🆕 PHASE 1: DIRECT FEATURE LAYER URLs
// ============================================================================
/**
 * Direct Feature Layer URLs for improved performance and reliability.
 *
 * These URLs allow the application to connect directly to hosted feature layers,
 * bypassing WebMap initialization. This provides:
 * - Faster data loading (no WebMap overhead)
 * - More reliable queries (no layer title matching)
 * - Independent operation of map and report components
 *
 * @see Documentation: docs/LAYER_ARCHITECTURE.md
 *
 * 🔧 HOW TO OBTAIN THESE URLs:
 * 1. Log into ArcGIS Online: https://www.arcgis.com/
 * 2. Navigate to Content > My Content (or your organization's content)
 * 3. Find each layer and click on it
 * 4. Click "View" to open the item details page
 * 5. On the right side, find the "URL" field
 * 6. Copy the complete URL including the layer index (e.g., /FeatureServer/0)
 *
 * ⚠️ IMPORTANT NOTES:
 * - URLs must include the full path including /FeatureServer/[layer_index]
 * - The layer index (0, 1, 2, etc.) identifies which layer in the service
 * - Titles should match the existing layer titles in the WebMap for compatibility
 * - These URLs should point to the SAME layers as those in the WebMap
 */
export const FEATURE_LAYER_URLS = {
  /**
   * Road Network Layer
   * Primary data source containing road segments with condition metrics
   *
   * 📍 TO UPDATE: Replace placeholder URL with your actual feature service URL
   * Example format: 'https://services.arcgis.com/{org-id}/arcgis/rest/services/{service-name}/FeatureServer/0'
   */
  roadNetwork: {
    url: 'https://services-eu1.arcgis.com/yKemAZ93UMQ59Hq1/arcgis/rest/services/RegionalRoadSurvey_latest_gdb/FeatureServer/1', // 🔴 REPLACE WITH ACTUAL URL
    title: 'RoadNetwork Temporal 2011 2025', // Match WebMap layer title
    description: 'Line features representing regional road network segments (100m each)',
  },

  /**
   * Road Network Swipe Layer
   * Duplicate layer used for temporal comparison in swipe widget
   * This may be the same URL as roadNetwork if using a single layer
   *
   * 📍 TO UPDATE: Replace placeholder URL with your actual feature service URL
   */
  roadNetworkSwipe: {
    url: 'https://services-eu1.arcgis.com/yKemAZ93UMQ59Hq1/arcgis/rest/services/RegionalRoadSurvey_latest_gdb/FeatureServer/1', // 🔴 REPLACE WITH ACTUAL URL
    title: 'RoadNetwork Temporal 2011 2025', // Match WebMap layer title
    description: 'Duplicate road network layer for swipe comparison',
  },

  /**
   * Local Authority Polygon Layer
   * Contains pre-aggregated statistics at LA (county) level
   *
   * 📍 TO UPDATE: Replace placeholder URL with your actual feature service URL
   */
  laPolygon: {
    url: 'https://services-eu1.arcgis.com/yKemAZ93UMQ59Hq1/arcgis/rest/services/RegionalRoadSurvey_latest_gdb/FeatureServer/0', // 🔴 REPLACE WITH ACTUAL URL
    title: 'RMO LA data', // Match WebMap layer title
    description: 'Polygon features for Local Authority boundaries with aggregated metrics',
  },
} as const;

/**
 * Layer Loading Strategy Configuration
 *
 * Controls how layers are loaded in the application:
 * - 'direct': Load layers directly from FEATURE_LAYER_URLS (fastest, requires valid URLs)
 * - 'webmap': Load layers from WebMap configuration (legacy method, slower)
 * - 'hybrid': Try direct loading first, fall back to WebMap if it fails (recommended)
 *
 * Can be overridden via URL parameter: ?layerStrategy=direct|webmap|hybrid
 */
export const LAYER_LOADING_CONFIG = {
  /**
   * Default strategy for loading layers
   * 'hybrid' is recommended for production (tries direct, falls back to webmap)
   */
  defaultStrategy: 'hybrid' as 'direct' | 'webmap' | 'hybrid',

  /**
   * Timeout for direct layer loading attempts (milliseconds)
   * If direct loading takes longer than this, fall back to WebMap in hybrid mode
   */
  directLoadTimeout: 5000,

  /**
   * Enable fallback to WebMap in hybrid mode
   * Set to false to force direct-only loading
   */
  enableFallback: true,

  /**
   * Log loading strategy performance metrics to console
   * Useful for debugging and optimization
   */
  enablePerformanceLogging: true,
} as const;

// ============================================================================
// END PHASE 1 ADDITIONS
// ============================================================================


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