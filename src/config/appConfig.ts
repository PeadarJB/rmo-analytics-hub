// rmo-analytics-hub/src/config/appConfig.ts

export type KPIKey = 'iri' | 'rut' | 'psci' | 'csc' | 'mpd' | 'lpv3';

// Road segment constants
// Each road segment in the RMO network is fixed at 100 meters length
export const SEGMENT_LENGTH_METERS = 100;
export const SEGMENT_LENGTH_KM = 0.1; // 100m = 0.1km

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

export const SUBGROUP_CODE_TO_FIELD: Record<number, string> = {
  10: 'Roads_Joined_IsFormerNa',
  20: 'Roads_Joined_IsDublin',
  30: 'Roads_Joined_IsCityTown',
  40: 'Roads_Joined_IsPeat',
  50: 'Rural'
};

// Renderer configuration
export const RENDERER_CONFIG = {
  use5ClassRenderers: true,
  colors: {
    fiveClass: {
      veryGood: [0, 128, 0, 0.8],
      good: [144, 238, 144, 0.8],
      fair: [255, 255, 0, 0.8],
      poor: [255, 165, 0, 0.8],
      veryPoor: [255, 0, 0, 0.8]
    },
    threeClass: {
      good: [76, 175, 80, 0.9],
      fair: [255, 193, 7, 0.9],
      poor: [244, 67, 54, 0.9]
    }
  },
  lineWidth: 4
};

// --- START: New Code to Add ---

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

// --- END: New Code to Add ---

export const CONFIG = {
  title: 'RMO Pavement Analytics',
  webMapId: '9aff0a681f67430cad396dc9cac99e05',
  roadNetworkLayerTitle: 'RMO NM 2025',
  roadNetworkLayerSwipeTitle: 'RMO NM 2025',
  fields: {
    iri: 'roads_csv_iri',
    rut: 'roads_csv_rut',
    psci: 'roads_csv_psci',
    csc: 'roads_csv_csc',
    mpd: 'roads_csv_mpd',
    lpv3: 'roads_csv_lpv',
    route: 'Roads_Joined_Route',
    year: 'SurveyYear',
    la: 'Roads_Joined_LA',
    subgroupPlaceholder: 'RoadGroupCode',
  },
  filters: {
    localAuthority: { id: 'localAuthority', label: 'Local Authority', field: 'Roads_Joined_LA', type: 'multi-select' as const },
    subgroup: {
      id: 'subgroup',
      label: 'Road Subgroup',
      field: 'subgroup',
      type: 'multi-select' as const,
      options: [
        { label: 'Former National', value: 'Roads_Joined_IsFormerNa', code: 10 },
        { label: 'Dublin', value: 'Roads_Joined_IsDublin', code: 20 },
        { label: 'City/Town', value: 'Roads_Joined_IsCityTown', code: 30 },
        { label: 'Peat', value: 'Roads_Joined_IsPeat', code: 40 },
        { label: 'Rural', value: 'Rural', code: 50 }
      ]
    },
    route: { id: 'route', label: 'Route', field: 'Roads_Joined_Route', type: 'multi-select' as const },
    year: {
      id: 'year', label: 'Survey Year', field: 'SurveyYear', type: 'multi-select' as const,
      options: [{ label: '2011', value: 2011 }, { label: '2018', value: 2018 }, { label: '2025', value: 2025 }]
    }
  },
  defaultKPI: 'iri' as KPIKey,
  defaultYears: [2025],
  defaultGroupBy: 'Roads_Joined_LA',
  map: { center: [-8.0, 53.3] as [number, number], zoom: 7 }
} as const;

export const KPI_LABELS: Record<KPIKey, string> = {
  iri: 'IRI',
  rut: 'Rut Depth',
  psci: 'PSCI',
  csc: 'CSC',
  mpd: 'MPD',
  lpv3: 'LPV'
};

export const LA_LAYER_CONFIG = {
  // Primary pattern for finding LA layers
  layerTitlePattern: (kpi: string, year: number) => {
    const kpiUpper = kpi.toUpperCase();
    const displayKpi = kpiUpper === 'LPV3' ? 'LPV' : kpiUpper;
    return `Average ${displayKpi} ${year}`;
  },
  // Alternative patterns to try if primary fails
  alternativePatterns: [
    (kpi: string, year: number) => `${year} Average ${kpi.toUpperCase()}`,
    (kpi: string, year: number) => `LA ${kpi.toUpperCase()} ${year}`,
    (kpi: string, year: number) => `${kpi.toUpperCase()} ${year} Average`
  ]
};

// Helper function to get KPI field name for a specific year
export function getKPIFieldName(kpi: KPIKey, year: number): string {
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
export type YearOption = typeof CONFIG.filters.year.options[number];
