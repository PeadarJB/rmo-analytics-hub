export type KPIKey = 'iri' | 'rut' | 'psci' | 'csc' | 'mpd' | 'lpv3';

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
    veryGood: 3,     // < 3 = Very Good
    good: 4,         // 3-4 = Good
    fair: 5,         // 4-5 = Fair
    poor: 7          // 5-7 = Poor, > 7 = Very Poor
  },
  // Rut Depth (mm) - lower values are better
  rut: {
    veryGood: 6,     // < 6 = Very Good
    good: 9,         // 6-9 = Good
    fair: 15,        // 9-15 = Fair
    poor: 20         // 15-20 = Poor, > 20 = Very Poor
  },
  // Characteristic SCRIM Coefficient - higher values are better (inverted)
  csc: {
    veryPoor: 0.35,  // ≤ 0.35 = Very Poor
    poor: 0.40,      // 0.35-0.40 = Poor
    fair: 0.45,      // 0.40-0.45 = Fair
    good: 0.50       // 0.45-0.50 = Good, > 0.50 = Very Good
  },
  // Longitudinal Profile Variance (3m) - lower values are better
  lpv3: {
    veryGood: 2,     // < 2 = Very Good
    good: 4,         // 2-4 = Good
    fair: 7,         // 4-7 = Fair
    poor: 10         // 7-10 = Poor, > 10 = Very Poor
  },
  // Pavement Surface Condition Index (1-10 scale) - higher values are better
  psci: {
    veryPoor: 2,     // 1-2 = Reconstruction
    poor: 4,         // 3-4 = Structural Rehabilitation
    fair: 6,         // 5-6 = Surface Restoration
    good: 8          // 7-8 = Skid Resistance, 9-10 = Routine Maintenance
  },
  // Mean Profile Depth (mm) - specific thresholds for skid resistance
  mpd: {
    poor: 0.6,       // < 0.6 = Poor skid resistance
    good: 0.7,       // > 0.7 = Good skid resistance
    fair: 0.65       // Implied midpoint for fair condition
  }
};

// Map of subgroup codes to their boolean field names in the dataset
export const SUBGROUP_FIELD_MAP = {
  'Roads_Joined_IsFormerNa': 10,   // Former National roads
  'Roads_Joined_IsDublin': 20,     // Dublin roads
  'Roads_Joined_IsCityTown': 30,   // City/Town roads
  'Roads_Joined_IsPeat': 40,       // Peat roads
  'Rural': 50                      // Rural roads (special case: all flags = 0)
};

// Reverse mapping for convenient lookups
export const SUBGROUP_CODE_TO_FIELD: Record<number, string> = {
  10: 'Roads_Joined_IsFormerNa',
  20: 'Roads_Joined_IsDublin',
  30: 'Roads_Joined_IsCityTown',
  40: 'Roads_Joined_IsPeat',
  50: 'Rural'
};

// Renderer configuration
export const RENDERER_CONFIG = {
  // Enable 5-class renderers for specific KPIs (Very Good, Good, Fair, Poor, Very Poor)
  // When false, uses simplified 3-class system (Good, Fair, Poor)
  use5ClassRenderers: false,
  
  // Color schemes for condition classes
  colors: {
    // 5-class color scheme
    fiveClass: {
      veryGood: [0, 128, 0, 0.8],    // Dark green
      good: [144, 238, 144, 0.8],    // Light green
      fair: [255, 255, 0, 0.8],      // Yellow
      poor: [255, 165, 0, 0.8],      // Orange
      veryPoor: [255, 0, 0, 0.8]     // Red
    },
    // Simplified 3-class color scheme
    threeClass: {
      good: [76, 175, 80, 0.9],      // Green
      fair: [255, 193, 7, 0.9],      // Amber
      poor: [244, 67, 54, 0.9]       // Red
    }
  },
  
  // Default line width for road segments
  lineWidth: 4
};

export const CONFIG = {
  // Application title shown in the header
  title: 'RMO Pavement Analytics',
  
  // Set to the actual web map ID published on ArcGIS Online for the RMO analytics hub
  webMapId: '9aff0a681f67430cad396dc9cac99e05',
  
  // The title of the feature layer representing the road network in the web map.
  // This must exactly match the layer name in the AGOL item otherwise the layer lookup will fail.
  roadNetworkLayerTitle: 'RMO NM 2025',
  
  // Title of the swipe layer shown when the swipe panel is activated.
  // Use the same underlying layer so that a cloned layer can be used for side‑by‑side year comparison.
  roadNetworkLayerSwipeTitle: 'RMO NM 2025',
  
  /**
   * Field names used throughout the app. These keys map logical KPI names to the
   * corresponding attribute field names in the underlying feature service.
   *
   * Note: the RMO road network contains separate fields for each year (e.g.
   * `roads_csv_iri_2011`, `roads_csv_iri_2018`, `roads_csv_iri_2025`). When constructing
   * renderers or statistics queries you should append the selected year to these base names
   * (see `StatisticsService` for an example). For example, selecting the 2025 survey year and the
   * IRI KPI would map to `roads_csv_iri_2025`.
   */
  fields: {
    // Base field name for International Roughness Index. Append `_2011`, `_2018` or `_2025` as needed.
    iri: 'roads_csv_iri',
    // Base field name for Rut Depth
    rut: 'roads_csv_rut',
    // Base field name for Pavement Surface Condition Index
    psci: 'roads_csv_psci',
    // Base field name for Condition Surveyed Cracking
    csc: 'roads_csv_csc',
    // Base field name for Mean Profile Depth
    mpd: 'roads_csv_mpd',
    // Base field name for Lane Position Variance (LPV). The RMO schema does not include a
    // "lpv3" field, so point to the LPV fields provided by the CSV.
    lpv3: 'roads_csv_lpv',
    // Route identifier. Prefer the joined route value over the CSV version so filters work across
    // the entire dataset.
    route: 'Roads_Joined_Route',
    // There is no explicit SurveyYear field on the network; the year is encoded in the KPI fields.
    // This key remains for UI purposes and should map to a synthetic 'year' property in queries.
    year: 'SurveyYear',
    // Local authority name as stored on the joined feature layer.
    la: 'Roads_Joined_LA',
    // Note: Subgroup is handled via boolean fields, not a single field
    // The dataset stores individual boolean flags (IsFormerNa, IsDublin, etc.)
    subgroupPlaceholder: 'RoadGroupCode', // Placeholder for UI consistency
    // Polyline length in metres; use to compute total kilometres by dividing by 1000.
    lengthKm: 'Shape_Length'
  },
  
  filters: {
    localAuthority: { 
      id: 'localAuthority', 
      label: 'Local Authority', 
      field: 'Roads_Joined_LA', 
      type: 'multi-select' as const 
    },
    subgroup: { 
      id: 'subgroup', 
      label: 'Road Subgroup', 
      field: 'subgroup', // Virtual field for UI
      type: 'multi-select' as const, 
      // Updated to use field names as values instead of numeric codes
      options: [
        { label: 'Former National', value: 'Roads_Joined_IsFormerNa', code: 10 },
        { label: 'Dublin', value: 'Roads_Joined_IsDublin', code: 20 },
        { label: 'City/Town', value: 'Roads_Joined_IsCityTown', code: 30 },
        { label: 'Peat', value: 'Roads_Joined_IsPeat', code: 40 },
        { label: 'Rural', value: 'Rural', code: 50 } // Special case handled in query logic
      ] 
    },
    route: { 
      id: 'route', 
      label: 'Route', 
      field: 'Roads_Joined_Route', 
      type: 'multi-select' as const 
    },
    year: { 
      id: 'year', 
      label: 'Survey Year', 
      field: 'SurveyYear', // Synthetic field for UI
      type: 'multi-select' as const, 
      options: [
        { label: '2011', value: 2011 },
        { label: '2018', value: 2018 },
        { label: '2025', value: 2025 }
      ] 
    }
  },
  
  defaultKPI: 'psci' as KPIKey,
  defaultYears: [2025],
  defaultGroupBy: 'Roads_Joined_LA',
  
  map: {
    center: [-8.0, 53.3] as [number, number], // Center of Ireland
    zoom: 7
  }
} as const;

export const KPI_LABELS: Record<KPIKey, string> = {
  iri: 'IRI',
  rut: 'Rut Depth',
  psci: 'PSCI',
  csc: 'CSC',
  mpd: 'MPD',
  lpv3: 'LPV'
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
  
  // KPIs where lower values are better
  if (kpi === 'iri' || kpi === 'rut' || kpi === 'lpv3') {
    if (use5Classes && thresholds.veryGood !== undefined && value < thresholds.veryGood) {
      return 'veryGood';
    }
    if (value < thresholds.good) return 'good';
    if (value < thresholds.fair) return 'fair';
    if (use5Classes && thresholds.poor !== undefined) {
      if (value < thresholds.poor) return 'poor';
      return 'veryPoor';
    }
    return 'poor';
  } 
  // CSC: higher values are better (inverted)
  else if (kpi === 'csc') {
    if (use5Classes && thresholds.good !== undefined && value > thresholds.good) {
      return 'veryGood';
    }
    if (value >= thresholds.fair) return 'good';
    if (value >= thresholds.poor! && thresholds.poor !== undefined) return 'fair';
    if (use5Classes && thresholds.veryPoor !== undefined) {
      if (value >= thresholds.veryPoor) return 'poor';
      return 'veryPoor';
    }
    return 'poor';
  } 
  // PSCI: 1-10 scale, higher is better
  else if (kpi === 'psci') {
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
  } 
  // MPD: specific thresholds for skid resistance
  else if (kpi === 'mpd') {
    if (value >= thresholds.good) return 'good';
    if (value >= thresholds.fair) return 'fair';
    return 'poor';
  }
  
  return null;
}

// Helper to get simplified 3-class condition (for statistics and general use)
export function getSimplifiedConditionClass(
  kpi: KPIKey, 
  value: number
): 'good' | 'fair' | 'poor' | null {
  const detailed = getConditionClass(kpi, value, true);
  if (!detailed) return null;
  
  // Map 5-class to 3-class
  if (detailed === 'veryGood' || detailed === 'good') return 'good';
  if (detailed === 'fair') return 'fair';
  return 'poor';
}

// Export types for use in other files
export type SubgroupOption = typeof CONFIG.filters.subgroup.options[number];
export type YearOption = typeof CONFIG.filters.year.options[number];