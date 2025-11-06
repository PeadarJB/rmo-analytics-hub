// src/config/rendererConfig.ts

import type { KPIKey } from './kpiConfig';
import { getConditionColors } from '@/utils/themeHelpers';

/**
 * ============================================================================
 * RENDERER CONFIGURATION
 * ============================================================================
 */

/**
 * Global renderer configuration settings
 * Controls visual styling and classification behavior for map layers
 */
export const RENDERER_CONFIG = {
  /**
   * Use 5-class condition classification system
   * true = Very Good, Good, Fair, Poor, Very Poor (5 classes)
   * false = Good, Fair, Poor (3 classes)
   */
  use5ClassRenderers: true,
  
  /**
   * Default line width for road segments (pixels)
   */
  lineWidth: 4,
  
  /**
   * Line width for highlighted/selected segments (pixels)
   */
  highlightedLineWidth: 6,
  
  /**
   * Outline width for road segments (pixels)
   */
  outlineWidth: 0.5,
  
  /**
   * Gets theme-aware condition colors for map renderers.
   * This function delegates to getConditionColors() from themeHelpers,
   * which reads values directly from CSS custom properties.
   * This ensures map symbology stays in sync with the application theme.
   * @returns A record of condition names to RGBA color arrays
   */
  getThemeAwareColors: () => getConditionColors(),
  
  /**
   * Enable renderer caching for performance
   * Cached renderers are reused instead of being recreated
   */
  enableCache: true,
  
  /**
   * Maximum number of renderers to cache
   * Typically: 6 KPIs × 3 years × 2 themes = 36 renderers
   */
  cacheSize: 36
} as const;

/**
 * ============================================================================
 * STANDARD CONDITION COLORS
 * ============================================================================
 * 
 * These are the primary colors used for road network visualization.
 * They follow a standard traffic-light metaphor (green = good, red = poor).
 * 
 * These colors are defined as CSS custom properties in tokens.css and adapt
 * to light/dark mode. The actual RGB values are retrieved dynamically via
 * getConditionColors() from themeHelpers.
 * 
 * CSS Variable Reference:
 * - --color-condition-veryGood (Dark Green #22c55e)
 * - --color-condition-good (Light Green #84cc16)
 * - --color-condition-fair (Yellow #eab308)
 * - --color-condition-poor (Orange #f97316)
 * - --color-condition-veryPoor (Red #ef4444)
 * - --color-fg-muted (Gray #94a3b8) for No Data
 */

/**
 * Type definition for condition color names
 */
export type ConditionColor = 'veryGood' | 'good' | 'fair' | 'poor' | 'veryPoor';

/**
 * ============================================================================
 * LA POLYGON LAYER COLOR GRADIENTS
 * ============================================================================
 * 
 * Custom color gradients for Local Authority polygon layers.
 * Each KPI has a unique gradient based on the 2018 Regional Report maps.
 * 
 * These colors are used for choropleth visualization of county-level statistics.
 * They differ from standard condition colors to match historical report styling.
 * 
 * Color Philosophy:
 * - Darker shades = Worse condition (lower percentages)
 * - Lighter shades = Better condition (higher percentages)
 */

/**
 * LA Color Gradient type definition
 * RGB color values without alpha channel
 */
export type LAColorGradient = {
  veryPoor: [number, number, number];
  poor: [number, number, number];
  fair: [number, number, number];
  good: [number, number, number];
  veryGood: [number, number, number];
};

/**
 * KPI-specific color gradients for LA polygon layers
 * Source: 2018 Regional Final Report choropleth maps
 */
export const LA_COLOR_GRADIENTS: Record<KPIKey, LAColorGradient> = {
  /**
   * IRI (International Roughness Index) - Purple Gradient
   * Range: Dark purple (poor) → Light purple/pink (good)
   * Used for: % Fair or Better (≤ 5 mm/m) visualization
   */
  iri: {
    veryPoor: [100, 70, 110],   // Dark purple - 60-65% range
    poor: [120, 90, 130],        // Medium purple - 65-70% range
    fair: [145, 115, 155],       // Purple - 70-75% range
    good: [180, 150, 190],       // Light purple - 75-85% range
    veryGood: [210, 185, 215]    // Very light purple/pink - 85-90% range
  },
  
  /**
   * Rut Depth - Orange/Coral Gradient
   * Range: Dark orange (poor) → Light coral/pink (good)
   * Used for: % Fair or Better (≤ 15 mm) visualization
   */
  rut: {
    veryPoor: [235, 140, 120],   // Dark orange - 70-75% range
    poor: [240, 155, 135],        // Medium orange - 75-80% range
    fair: [245, 170, 150],        // Light orange - 80-85% range
    good: [250, 185, 165],        // Coral - 85-95% range
    veryGood: [255, 215, 200]     // Light coral/pink - 95-100% range
  },
  
  /**
   * PSCI (Pavement Surface Condition Index) - Brown/Tan Gradient
   * Range: Dark brown (poor) → Light tan/beige (good)
   * Used for: % Fair or Better (Mode Rating > 6) visualization
   */
  psci: {
    veryPoor: [180, 100, 50],    // Dark brown - 80-85% range
    poor: [210, 120, 60],         // Medium brown - 85-90% range
    fair: [230, 140, 75],         // Brown - 90-92% range
    good: [245, 180, 115],        // Light brown - 92-96% range
    veryGood: [250, 200, 145]     // Tan/beige - 96-100% range
  },
  
  /**
   * CSC (Characteristic SCRIM Coefficient) - Yellow/Olive Gradient
   * Range: Dark olive (poor) → Light yellow (good)
   * Used for: Average CSC value visualization
   * Note: Lower values indicate worse skid resistance
   */
  csc: {
    veryPoor: [180, 175, 110],   // Dark olive - 0.40-0.45 range
    poor: [200, 195, 140],        // Olive - 0.45-0.48 range
    fair: [225, 220, 175],        // Light olive - 0.48-0.52 range
    good: [240, 235, 200],        // Pale yellow - 0.52-0.55 range
    veryGood: [250, 245, 225]     // Very light yellow - 0.55-0.60 range
  },
  
  /**
   * MPD (Mean Profile Depth) - Teal/Cyan Gradient
   * Range: Dark teal (poor) → Light cyan (good)
   * Used for: % Fair or Better (≥ 0.6 mm) visualization
   * Note: Only uses 3 classes (poor, fair, good)
   */
  mpd: {
    veryPoor: [65, 120, 130],    // Dark teal (duplicate of poor for consistency)
    poor: [65, 120, 130],         // Dark teal - 0-3% range (% POOR, inverted)
    fair: [110, 170, 180],        // Medium teal - 3-6% range
    good: [180, 220, 225],        // Light cyan - 6-10% range
    veryGood: [180, 220, 225]     // Light cyan (duplicate of good for consistency)
  },
  
  /**
   * LPV3 (Longitudinal Profile Variance 3m) - Purple Gradient
   * Range: Dark purple (poor) → Light purple/pink (good)
   * Same gradient as IRI (consistent visual language for roughness-related metrics)
   * Used for: % Fair or Better (≤ 7 mm) visualization
   */
  lpv3: {
    veryPoor: [100, 70, 110],    // Dark purple - 50-60% range
    poor: [120, 90, 130],         // Medium purple - 60-70% range
    fair: [145, 115, 155],        // Purple - 70-75% range
    good: [180, 150, 190],        // Light purple - 75-85% range
    veryGood: [210, 185, 215]     // Very light purple/pink - 85-90% range
  }
};

/**
 * ============================================================================
 * LA PERCENTAGE RANGES
 * ============================================================================
 * 
 * Defines the percentage ranges for "Fair or Better" visualization mode.
 * These ranges are used for continuous gradient rendering on LA polygon layers.
 * 
 * Each KPI has different typical ranges based on network-wide performance:
 * - IRI: 60-90% (moderate variation)
 * - Rut: 70-100% (generally good performance)
 * - PSCI: 80-100% (high baseline performance)
 * - CSC: 40-100% (wide variation, safety-critical)
 * - MPD: 0-10% (shows % POOR, inverted - lower is better)
 * - LPV3: 50-90% (moderate variation)
 */
export const LA_PERCENTAGE_RANGES: Record<KPIKey, { min: number; max: number }> = {
  iri: { 
    min: 60,   // Minimum expected % Fair or Better
    max: 90    // Maximum expected % Fair or Better
  },
  rut: { 
    min: 70,   // Minimum expected % Fair or Better
    max: 100   // Maximum expected % Fair or Better
  },
  psci: { 
    min: 80,   // Minimum expected % Fair or Better
    max: 100   // Maximum expected % Fair or Better
  },
  csc: { 
    min: 40,   // Minimum expected % Fair or Better
    max: 100   // Maximum expected % Fair or Better
  },
  mpd: { 
    min: 0,    // Minimum expected % POOR (inverted metric)
    max: 10    // Maximum expected % POOR (inverted metric)
    // Note: MPD shows percentage of road network with POOR depth (<0.6mm)
    // Lower percentages indicate better overall network texture depth
  },
  lpv3: { 
    min: 50,   // Minimum expected % Fair or Better
    max: 90    // Maximum expected % Fair or Better
  }
};

/**
 * ============================================================================
 * RENDERER CLASS CONFIGURATION
 * ============================================================================
 */

/**
 * Configuration for class field renderers
 * Pre-calculated class fields use integer values 1-5:
 * 1 = Very Good, 2 = Good, 3 = Fair, 4 = Poor, 5 = Very Poor
 */
export const CLASS_FIELD_VALUES = {
  veryGood: 1,
  good: 2,
  fair: 3,
  poor: 4,
  veryPoor: 5
} as const;

/**
 * Labels for condition classes
 * Used in map legends and class break info
 */
export const CLASS_LABELS: Record<ConditionColor, string> = {
  veryGood: 'Very Good',
  good: 'Good',
  fair: 'Fair',
  poor: 'Poor',
  veryPoor: 'Very Poor'
};

/**
 * Simplified class labels (3-class system)
 * Used when use5ClassRenderers is false
 */
export const SIMPLIFIED_CLASS_LABELS = {
  good: 'Good',
  fair: 'Fair',
  poor: 'Poor'
} as const;

/**
 * ============================================================================
 * FILL SYMBOL CONFIGURATION (LA LAYERS)
 * ============================================================================
 */

/**
 * Fill symbol configuration for LA polygon layers
 */
export const LA_FILL_CONFIG = {
  /**
   * Fill opacity for LA polygons (0-1)
   */
  fillOpacity: 1,
  
  /**
   * Outline color for LA polygons
   * Uses theme-aware color that adapts to light/dark mode
   */
  outlineColor: {
    light: [255, 255, 255, 0.8] as [number, number, number, number],  // White outline in light mode
    dark: [50, 50, 50, 0.8] as [number, number, number, number]       // Dark gray outline in dark mode
  },
  
  /**
   * Outline width for LA polygons (pixels)
   */
  outlineWidth: 1,
  
  /**
   * Outline style
   */
  outlineStyle: 'solid' as const
} as const;

/**
 * ============================================================================
 * LINE SYMBOL CONFIGURATION (ROAD NETWORK)
 * ============================================================================
 */

/**
 * Line symbol configuration for road network segments
 */
export const ROAD_LINE_CONFIG = {
  /**
   * Default line width (pixels)
   */
  defaultWidth: 4,
  
  /**
   * Line width when highlighted/selected (pixels)
   */
  highlightedWidth: 6,
  
  /**
   * Line width for detailed view (high zoom levels)
   */
  detailedWidth: 6,
  
  /**
   * Line cap style
   */
  cap: 'round' as const,
  
  /**
   * Line join style
   */
  join: 'round' as const,
  
  /**
   * Default line opacity (0-1)
   */
  opacity: 0.9
} as const;

/**
 * ============================================================================
 * HELPER FUNCTIONS
 * ============================================================================
 */

/**
 * Get LA color gradient for a specific KPI
 * @param kpi - The KPI key
 * @returns RGB color gradient object
 */
export function getLAColorGradient(kpi: KPIKey): LAColorGradient {
  return LA_COLOR_GRADIENTS[kpi];
}

/**
 * Get percentage range for a specific KPI in Fair or Better mode
 * @param kpi - The KPI key
 * @returns Object with min and max percentages
 */
export function getLAPercentageRange(kpi: KPIKey): { min: number; max: number } {
  return LA_PERCENTAGE_RANGES[kpi];
}

/**
 * Interpolate between two RGB colors
 * @param color1 - Start color [R, G, B]
 * @param color2 - End color [R, G, B]
 * @param factor - Interpolation factor (0-1)
 * @returns Interpolated color [R, G, B]
 */
export function interpolateColor(
  color1: [number, number, number],
  color2: [number, number, number],
  factor: number
): [number, number, number] {
  const r = Math.round(color1[0] + factor * (color2[0] - color1[0]));
  const g = Math.round(color1[1] + factor * (color2[1] - color1[1]));
  const b = Math.round(color1[2] + factor * (color2[2] - color1[2]));
  return [r, g, b];
}

/**
 * Get class label for a given class value
 * @param classValue - Integer class value (1-5)
 * @param simplified - Whether to use simplified 3-class labels
 * @returns Human-readable class label
 */
export function getClassLabel(classValue: number, simplified: boolean = false): string {
  if (simplified) {
    if (classValue <= 2) return SIMPLIFIED_CLASS_LABELS.good;
    if (classValue === 3) return SIMPLIFIED_CLASS_LABELS.fair;
    return SIMPLIFIED_CLASS_LABELS.poor;
  }
  
  switch (classValue) {
    case 1: return CLASS_LABELS.veryGood;
    case 2: return CLASS_LABELS.good;
    case 3: return CLASS_LABELS.fair;
    case 4: return CLASS_LABELS.poor;
    case 5: return CLASS_LABELS.veryPoor;
    default: return 'Unknown';
  }
}

/**
 * Determine if a KPI uses inverted coloring (higher values = worse condition)
 * @param kpi - The KPI key
 * @returns true if KPI uses inverted coloring
 */
export function isInvertedKPI(kpi: KPIKey): boolean {
  // Lower is better for these KPIs
  return kpi === 'iri' || kpi === 'rut' || kpi === 'lpv3';
}

/**
 * Get the appropriate line width based on map scale/zoom
 * @param scale - Current map scale
 * @returns Line width in pixels
 */
export function getScaledLineWidth(scale: number): number {
  // Adjust line width based on scale for better visibility
  if (scale < 100000) {
    return ROAD_LINE_CONFIG.detailedWidth;  // Zoomed in - thicker lines
  }
  return ROAD_LINE_CONFIG.defaultWidth;     // Zoomed out - thinner lines
}

/**
 * ============================================================================
 * TYPE EXPORTS
 * ============================================================================
 */

/**
 * Type for renderer configuration
 */
export type RendererConfig = typeof RENDERER_CONFIG;

/**
 * Type for LA fill configuration
 */
export type LAFillConfig = typeof LA_FILL_CONFIG;

/**
 * Type for road line configuration
 */
export type RoadLineConfig = typeof ROAD_LINE_CONFIG;