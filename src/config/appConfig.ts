// rmo-analytics-hub/src/config/appConfig.ts

import { getConditionColors } from '@/utils/themeHelpers';

export type KPIKey = 'iri' | 'rut' | 'psci' | 'csc' | 'mpd' | 'lpv3';

// Road segment constants
// Each road segment in the RMO network is fixed at 100 meters length
export const SEGMENT_LENGTH_METERS = 100;
export const SEGMENT_LENGTH_KM = 0.1; // 100m = 0.1km

// KPI Labels - MOVED BEFORE SWIPE_LAYER_CONFIG
export const KPI_LABELS: Record<KPIKey, string> = {
  iri: 'IRI',
  rut: 'Rut Depth',
  psci: 'PSCI',
  csc: 'CSC',
  mpd: 'MPD',
  lpv3: 'LPV'
};

// LA Layer configuration - MOVED BEFORE SWIPE_LAYER_CONFIG
export const LA_LAYER_CONFIG = {
  // Primary pattern for finding LA layers
  layerTitlePattern: (kpi: string, year: number) => {
    // Map KPI keys to the exact names used in the layers
    const kpiNameMap: Record<string, string> = {
      'iri': 'IRI',
      'rut': 'RUT',
      'psci': 'PSCI',
      'csc': 'CSC',
      'mpd': 'MPD',
      'lpv3': 'LPV'  // Note: lpv3 maps to LPV
    };
    
    const displayKpi = kpiNameMap[kpi.toLowerCase()] || kpi.toUpperCase();
    return `Average ${displayKpi} ${year}`;
  },
  // Alternative patterns to try if primary fails
  alternativePatterns: [
    (kpi: string, year: number) => `${year} Average ${kpi.toUpperCase()}`,
    (kpi: string, year: number) => `Average ${kpi.toUpperCase()} ${year}`,
  ]
};

// Consolidated KPI thresholds from RendererService and StatisticsService
// Based on the 2018 Regional Report condition class definitions
export const KPI_THRESHOLDS: Record<KPIKey, {
  veryGood?: number;
  good: number;
  fair: number;
  poor?: number;
  veryPoor?: number;
}> = {
  // International Roughness Index (mm/m) - lower values are better
  iri: {
    veryGood: 3,
    good: 4,
    fair: 5,
    poor: 7
  },
  // Rut Depth (mm) - lower values are better
  rut: {
    veryGood: 6,
    good: 9,
    fair: 15,
    poor: 20
  },
  // Characteristic SCRIM Coefficient - higher values are better (inverted)
  csc: {
    veryPoor: 0.35,
    poor: 0.40,
    fair: 0.45,
    good: 0.50
  },
  // Longitudinal Profile Variance (3m) - lower values are better
  lpv3: {
    veryGood: 2,
    good: 4,
    fair: 7,
    poor: 10
  },
  // Pavement Surface Condition Index (1-10 scale) - higher is better
  psci: {
    veryPoor: 2,
    poor: 4,
    fair: 6,
    good: 8
  },
  // Mean Profile Depth (mm) - specific thresholds for skid resistance
  mpd: {
    poor: 0.6,
    good: 0.7,
    fair: 0.65
  }
};

// Map of subgroup codes to their boolean field names in the dataset
export const SUBGROUP_FIELD_MAP = {
  'Roads_Joined_IsFormerNa': 10,
  'Roads_Joined_IsDublin': 20,
  'Roads_Joined_IsCityTown': 30,
  'Roads_Joined_IsPeat': 40,
  'Rural': 50
};

// Update subgroup mapping - UPDATED FIELD NAMES
export const SUBGROUP_CODE_TO_FIELD: Record<number, string> = {
  10: 'IsFormerNa',           // was: 'Roads_Joined_IsFormerNa'
  20: 'IsDublin',             // was: 'Roads_Joined_IsDublin'
  30: 'IsCityTown',           // was: 'Roads_Joined_IsCityTown'
  40: 'IsPeat',               // was: 'Roads_Joined_IsPeat'
  50: 'Rural'
};

// NEW: LA metric type
export type LAMetricType = 'average' | 'fairOrBetter';

// NEW: LA field pattern generators
export const LA_FIELD_PATTERNS = {
  average: (kpi: KPIKey, year: number): string => {
    const kpiMap: Record<KPIKey, string> = {
      'iri': 'iri',
      'rut': 'rut',
      'csc': 'csc',
      'mpd': 'mpd',
      'psci': 'psci',
      'lpv3': 'lpv'  // Note: lpv3 → lpv in LA fields
    };
    return `avg_${kpiMap[kpi]}_${year}`;
  },
  
  fairOrBetter: (kpi: KPIKey, year: number): string => {
    const kpiMap: Record<KPIKey, string> = {
      'iri': 'IRI',
      'rut': 'RUT',
      'csc': 'CSC',
      'mpd': 'MPD',
      'psci': 'PSCI',
      'lpv3': 'LPV'
    };
    return `${kpiMap[kpi]}_FB_${year}`;
  }
};

// NEW: LA layer color gradients (KPI-specific colors)
export const LA_COLOR_GRADIENTS: Record<KPIKey, Record<string, [number, number, number]>> = {
  iri: {
    veryPoor: [100, 70, 110],
    poor: [120, 90, 130],
    fair: [145, 115, 155],
    good: [180, 150, 190],
    veryGood: [210, 185, 215]
  },
  rut: {
    veryPoor: [235, 140, 120],
    poor: [240, 155, 135],
    fair: [245, 170, 150],
    good: [250, 185, 165],
    veryGood: [255, 215, 200]
  },
  psci: {
    veryPoor: [180, 100, 50],
    poor: [210, 120, 60],
    fair: [230, 140, 75],
    good: [245, 180, 115],
    veryGood: [250, 200, 145]
  },
  csc: {
    veryPoor: [180, 175, 110],
    poor: [200, 195, 140],
    fair: [225, 220, 175],
    good: [240, 235, 200],
    veryGood: [250, 245, 225]
  },
  mpd: {
    poor: [65, 120, 130],      // Only 3 classes for MPD
    fair: [110, 170, 180],
    good: [180, 220, 225],
    veryPoor: [65, 120, 130],  // Duplicate for consistency
    veryGood: [180, 220, 225]  // Duplicate for consistency
  },
  lpv3: {
    veryPoor: [100, 70, 110],
    poor: [120, 90, 130],
    fair: [145, 115, 155],
    good: [180, 150, 190],
    veryGood: [210, 185, 215]
  }
};

// NEW: LA layer percentage ranges (for Fair or Better mode)
export const LA_PERCENTAGE_RANGES: Record<KPIKey, { min: number; max: number }> = {
  iri: { min: 60, max: 90 },
  rut: { min: 70, max: 100 },
  psci: { min: 80, max: 100 },
  csc: { min: 40, max: 100 },
  mpd: { min: 0, max: 10 },      // Note: shows % POOR (inverse)
  lpv3: { min: 50, max: 90 }
};

// Renderer configuration
export const RENDERER_CONFIG = {
  use5ClassRenderers: true,
  /**
   * Gets theme-aware condition colors for map renderers.
   * This function now delegates to `getConditionColors` from `themeHelpers`,
   * which reads the values directly from CSS custom properties.
   * This ensures the map symbology stays in sync with the application theme.
   * @returns A record of condition names to RGBA color arrays.
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
 * This defines the default layers available for comparison between different years.
 * The structure is adapted from the TII project for consistency.
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
  title: 'RMO Pavement Analytics',
  webMapId: '3caed4039c514e20b4e50039b92cd27b',  // ✅ UPDATED
  roadNetworkLayerTitle: 'RoadNetwork Temporal 2011 2025',  // ✅ UPDATED
  roadNetworkLayerSwipeTitle: 'RoadNetwork Temporal 2011 2025',  // ✅ UPDATED
  laPolygonLayerTitle: 'RMO_LA_data',  // Keep for future reference
  
  fields: {
    // Raw value fields - UPDATED NAMES
    iri: 'AIRI',              // was: 'roads_csv_iri'
    rut: 'LRUT',              // was: 'roads_csv_rut'
    psci: 'ModeRating',       // was: 'roads_csv_psci'
    csc: 'CSC',               // unchanged
    mpd: 'MPD',               // unchanged
    lpv3: 'LPV3',             // was: 'roads_csv_lpv'
    
    // NEW: Pre-calculated class fields
    iriClass: 'IRI_Class',
    rutClass: 'Rut_Class',
    cscClass: 'CSC_Class',
    psciClass: 'PSCI_Class',
    mpdClass: 'MPD_Class',
    lpvClass: 'LPV_Class',
    
    // Other fields - UPDATED NAMES
    route: 'Route',           // was: 'Roads_Joined_Route'
    la: 'LA',                 // was: 'Roads_Joined_LA'
    // NOTE: Year removed - it's embedded in field names (e.g., AIRI_2025)
    subgroupPlaceholder: 'RoadGroupCode',
    
    // NEW: LA layer fields
    laCounty: 'OSICB_Boundary_1_COUNTY',
  },
  filters: {
    localAuthority: { 
      id: 'localAuthority', 
      label: 'Local Authority', 
      field: 'LA',            // was: 'Roads_Joined_LA'
      type: 'multi-select' as const 
    },
    subgroup: {
      id: 'subgroup',
      label: 'Road Subgroup',
      field: 'subgroup',
      type: 'multi-select' as const,
      options: [
        { label: 'Former National', value: 'IsFormerNa', code: 10 },     // was: 'Roads_Joined_IsFormerNa'
        { label: 'Dublin', value: 'IsDublin', code: 20 },                // was: 'Roads_Joined_IsDublin'
        { label: 'City/Town', value: 'IsCityTown', code: 30 },           // was: 'Roads_Joined_IsCityTown'
        { label: 'Peat', value: 'IsPeat', code: 40 },                    // was: 'Roads_Joined_IsPeat'
        { label: 'Rural', value: 'Rural', code: 50 }
      ]
    },
    route: { 
      id: 'route', 
      label: 'Route', 
      field: 'Route',         // was: 'Roads_Joined_Route'
      type: 'multi-select' as const 
    }
    // NOTE: Year filter removed - year is now a display mode selector, not a data filter
  },
  defaultKPI: 'iri' as KPIKey,
  defaultYear: 2025,          // ✅ Changed from array to single value
  defaultGroupBy: 'LA',       // was: 'Roads_Joined_LA'
  map: { center: [-8.0, 53.3] as [number, number], zoom: 7 }
} as const;

// UPDATED: Helper function to get KPI field name for a specific year
export function getKPIFieldName(kpi: KPIKey, year: number, useClass: boolean = false): string {
  if (useClass) {
    const classFieldMap: Record<KPIKey, string> = {
      'iri': 'IRI_Class',
      'rut': 'Rut_Class',
      'csc': 'CSC_Class',
      'mpd': 'MPD_Class',
      'psci': 'PSCI_Class',
      'lpv3': 'LPV_Class'
    };
    return `${classFieldMap[kpi]}_${year}`;
  }
  
  const baseField = CONFIG.fields[kpi];
  return `${baseField}_${year}`;
}

// Helper function to determine condition class based on KPI value and thresholds
export function getConditionClass(
  kpi: KPIKey,
  value: number,
  use5Classes: boolean = RENDERER_CONFIG.use5ClassRenderers
): 'veryGood' | 'good' | 'fair' | 'poor' | 'veryPoor' | null {
  if (value === null || value === undefined || isNaN(value)) return null;
  const thresholds = KPI_THRESHOLDS[kpi];

  if (kpi === 'iri' || kpi === 'rut' || kpi === 'lpv3') {
    if (use5Classes && thresholds.veryGood !== undefined && value < thresholds.veryGood) return 'veryGood';
    if (value < thresholds.good) return 'good';
    if (value < thresholds.fair) return 'fair';
    if (use5Classes && thresholds.poor !== undefined) {
      if (value < thresholds.poor) return 'poor';
      return 'veryPoor';
    }
    return 'poor';
  } else if (kpi === 'csc') {
    if (use5Classes && thresholds.good !== undefined && value > thresholds.good) return 'veryGood';
    if (value >= thresholds.fair) return 'good';
    if (value >= thresholds.poor! && thresholds.poor !== undefined) return 'fair';
    if (use5Classes && thresholds.veryPoor !== undefined) {
      if (value >= thresholds.veryPoor) return 'poor';
      return 'veryPoor';
    }
    return 'poor';
  } else if (kpi === 'psci') {
    if (use5Classes) {
      if (value > 8) return 'veryGood';
      if (value > thresholds.good) return 'good';
      if (value > thresholds.fair) return 'fair';
      if (value > thresholds.poor!) return 'poor';
      return 'veryPoor';
    }
    if (value > thresholds.fair) return 'good';
    if (value > thresholds.poor!) return 'fair';
    return 'poor';
  } else if (kpi === 'mpd') {
    if (value >= thresholds.good) return 'good';
    if (value >= thresholds.fair) return 'fair';
    return 'poor';
  }
  return null;
}

export function getSimplifiedConditionClass(
  kpi: KPIKey,
  value: number
): 'good' | 'fair' | 'poor' | null {
  const detailed = getConditionClass(kpi, value, true);
  if (!detailed) return null;
  if (detailed === 'veryGood' || detailed === 'good') return 'good';
  if (detailed === 'fair') return 'fair';
  return 'poor';
}

export type SubgroupOption = typeof CONFIG.filters.subgroup.options[number];