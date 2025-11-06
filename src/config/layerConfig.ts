// src/config/layerConfig.ts

import type { KPIKey } from './kpiConfig';
import { LA_COLOR_GRADIENTS, LA_PERCENTAGE_RANGES } from './rendererConfig';

/**
 * ============================================================================
 * LA (LOCAL AUTHORITY) LAYER CONFIGURATION
 * ============================================================================
 */

/**
 * LA Layer Configuration
 * Defines patterns for finding and identifying Local Authority polygon layers
 */
export const LA_LAYER_CONFIG = {
  /**
   * Primary pattern for finding LA layers by KPI and year
   * @param kpi - The KPI key (lowercase)
   * @param year - The survey year
   * @returns The expected layer title
   */
  layerTitlePattern: (kpi: string, year: number): string => {
    // Map KPI keys to the exact names used in the layers
    const kpiNameMap: Record<string, string> = {
      'iri': 'IRI',
      'rut': 'RUT',
      'psci': 'PSCI',
      'csc': 'CSC',
      'mpd': 'MPD',
      'lpv3': 'LPV'  // Note: lpv3 maps to LPV in layer names
    };
    
    const displayKpi = kpiNameMap[kpi.toLowerCase()] || kpi.toUpperCase();
    return `Average ${displayKpi} ${year}`;
  },
  
  /**
   * Alternative patterns to try if primary pattern fails
   */
  alternativePatterns: [
    (kpi: string, year: number) => `${year} Average ${kpi.toUpperCase()}`,
    (kpi: string, year: number) => `Average ${kpi.toUpperCase()} ${year}`,
  ]
};

/**
 * LA Metric Types
 * Defines the types of metrics that can be displayed on LA polygon layers
 */
export type LAMetricType = 'average' | 'fairOrBetter';

/**
 * LA Field Pattern Generators
 * Generate field names for different metric types on LA layers
 */
export const LA_FIELD_PATTERNS = {
  /**
   * Generate field name for average KPI values
   * Format: avg_{kpi}_{year}
   */
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
  
  /**
   * Generate field name for "Fair or Better" percentage values
   * Format: {KPI}_FB_{year}
   */
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

/**
 * ============================================================================
 * ROAD NETWORK LAYER CONFIGURATION
 * ============================================================================
 */

/**
 * Road Network Field Mappings
 * Maps logical field names to actual field names in the road network feature layer
 */
export const ROAD_FIELDS = {
  // Core KPI fields (base names, year suffix added dynamically)
  iri: 'AIRI',              // International Roughness Index
  rut: 'LRUT',              // Rut Depth
  psci: 'ModeRating',       // Pavement Surface Condition Index
  csc: 'CSC',               // Characteristic SCRIM Coefficient
  mpd: 'MPD',               // Mean Profile Depth
  lpv3: 'LPV3',             // Longitudinal Profile Variance (3m)
  
  // Pre-calculated condition class fields (base names, year suffix added dynamically)
  iriClass: 'IRI_Class',
  rutClass: 'Rut_Class',
  cscClass: 'CSC_Class',
  psciClass: 'PSCI_Class',
  mpdClass: 'MPD_Class',
  lpvClass: 'LPV_Class',
  
  // Attribute fields
  route: 'Route',           // Route identifier
  la: 'LA',                 // Local Authority
  
  // Subgroup boolean fields
  isFormerNa: 'IsFormerNa',
  isDublin: 'IsDublin',
  isCityTown: 'IsCityTown',
  isPeat: 'IsPeat',
  
  // LA layer join field
  laCounty: 'OSICB_Boundary_1_COUNTY'
} as const;


/**
 * ============================================================================
 * SUBGROUP CONFIGURATION
 * ============================================================================
 */

/**
 * Subgroup Code to Field Name Mapping
 * Maps subgroup codes (used in filters) to their boolean field names in the dataset
 */
export const SUBGROUP_CODE_TO_FIELD: Record<number, string> = {
  10: ROAD_FIELDS.isFormerNa,
  20: ROAD_FIELDS.isDublin,
  30: ROAD_FIELDS.isCityTown,
  40: ROAD_FIELDS.isPeat,
  50: 'Rural' // 'Rural' is a virtual category, not a field
};

/**
 * Subgroup Field to Code Mapping (inverse of SUBGROUP_CODE_TO_FIELD)
 * Useful for reverse lookups when processing data
 */
export const SUBGROUP_FIELD_TO_CODE: Record<string, number> = {
  [ROAD_FIELDS.isFormerNa]: 10,
  [ROAD_FIELDS.isDublin]: 20,
  [ROAD_FIELDS.isCityTown]: 30,
  [ROAD_FIELDS.isPeat]: 40,
  'Rural': 50
};


/**
 * Subgroup Options Configuration
 * Defines the available subgroup filter options with labels and codes
 */
export interface SubgroupOption {
  label: string;
  value: string;  // Field name or 'Rural'
  code: number;   // Numeric code
}

export const SUBGROUP_OPTIONS: SubgroupOption[] = [
  { label: 'Former National', value: ROAD_FIELDS.isFormerNa, code: 10 },
  { label: 'Dublin', value: ROAD_FIELDS.isDublin, code: 20 },
  { label: 'City/Town', value: ROAD_FIELDS.isCityTown, code: 30 },
  { label: 'Peat', value: ROAD_FIELDS.isPeat, code: 40 },
  { label: 'Rural', value: 'Rural', code: 50 }
];


/**
 * ============================================================================
 * HELPER FUNCTIONS
 * ============================================================================
 */

/**
 * Helper function to get KPI field name for a specific year
 * @param kpi - The KPI key
 * @param year - The survey year
 * @param useClass - Whether to get the pre-calculated class field or raw value field
 * @returns The complete field name (e.g., "AIRI_2025" or "IRI_Class_2025")
 */
export function getKPIFieldName(kpi: KPIKey, year: number, useClass: boolean = false): string {
  if (useClass) {
    const classFieldMap: Record<KPIKey, string> = {
      'iri': ROAD_FIELDS.iriClass,
      'rut': ROAD_FIELDS.rutClass,
      'csc': ROAD_FIELDS.cscClass,
      'mpd': ROAD_FIELDS.mpdClass,
      'psci': ROAD_FIELDS.psciClass,
      'lpv3': ROAD_FIELDS.lpvClass
    };
    return `${classFieldMap[kpi]}_${year}`;
  }
  
  const baseField = ROAD_FIELDS[kpi];
  return `${baseField}_${year}`;
}

/**
 * Helper function to get LA field name for a specific metric type
 * @param kpi - The KPI key
 * @param year - The survey year
 * @param metricType - The type of metric ('average' or 'fairOrBetter')
 * @returns The complete LA field name
 */
export function getLAFieldName(kpi: KPIKey, year: number, metricType: LAMetricType): string {
  return LA_FIELD_PATTERNS[metricType](kpi, year);
}

/**
 * Helper function to build a WHERE clause for a specific subgroup
 * @param subgroupCode - The subgroup code (10, 20, 30, 40, or 50)
 * @returns SQL WHERE clause fragment
 */
export function buildSubgroupWhereClause(subgroupCode: number): string {
  const fieldName = SUBGROUP_CODE_TO_FIELD[subgroupCode];
  
  if (!fieldName) {
    console.warn(`Unknown subgroup code: ${subgroupCode}`);
    return '1=1'; // Return neutral clause if code not found
  }
  
  // Rural is the default (all roads that are NOT in other categories)
  if (subgroupCode === 50) {
    const otherSubgroups = [10, 20, 30, 40];
    const conditions = otherSubgroups.map(code => `${SUBGROUP_CODE_TO_FIELD[code]} = 0`);
    return conditions.join(' AND ');
  }
  
  // For specific subgroups, check that their boolean field is 1
  return `${fieldName} = 1`;
}

/**
 * Helper function to get subgroup label from code
 * @param code - The subgroup code
 * @returns Human-readable label
 */
export function getSubgroupLabel(code: number): string {
  const option = SUBGROUP_OPTIONS.find(opt => opt.code === code);
  return option?.label || 'Unknown';
}

/**
 * Helper function to get subgroup code from field name
 * @param fieldName - The field name
 * @returns Subgroup code or null if not found
 */
export function getSubgroupCode(fieldName: string): number | null {
  return SUBGROUP_FIELD_TO_CODE[fieldName] || null;
}

/**
 * ============================================================================
 * RE-EXPORT RENDERER CONFIGS
 * ============================================================================
 * Re-export renderer-specific configs from rendererConfig
 * so they are co-located with layer definitions.
 */
export { LA_COLOR_GRADIENTS, LA_PERCENTAGE_RANGES } from './rendererConfig';