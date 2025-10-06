/**
 * Reads CSS custom property value from computed styles
 * Used for passing theme colors to JS libraries
 */
export function getCSSCustomProperty(propertyName: string): string {
  return getComputedStyle(document.documentElement)
    .getPropertyValue(propertyName)
    .trim();
}

/**
 * Gets condition colors for map rendering
 * Returns RGB array for ArcGIS symbology
 */
export function getConditionColors(): Record<string, number[]> {
  return {
    veryGood: hexToRgb(getCSSCustomProperty('--color-condition-very-good-map')),
    good: hexToRgb(getCSSCustomProperty('--color-condition-good-map')),
    fair: hexToRgb(getCSSCustomProperty('--color-condition-fair-map')),
    poor: hexToRgb(getCSSCustomProperty('--color-condition-poor-map')),
    veryPoor: hexToRgb(getCSSCustomProperty('--color-condition-very-poor-map'))
  };
}

/**
 * Converts hex color to RGB array for ArcGIS
 */
function hexToRgb(hex: string): number[] {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) {
    console.warn(`Invalid hex color: ${hex}`);
    return [128, 128, 128, 0.8]; // Fallback gray
  }
  return [
    parseInt(result[1], 16),
    parseInt(result[2], 16),
    parseInt(result[3], 16),
    0.8 // Alpha
  ];
}

/**
 * Gets Chart.js theme colors
 */
export function getChartThemeColors() {
  return {
    gridLines: getCSSCustomProperty('--chart-grid-line'),
    axisLines: getCSSCustomProperty('--chart-axis-line'),
    labels: getCSSCustomProperty('--chart-label'),
    tooltipBg: getCSSCustomProperty('--chart-tooltip-bg'),
    primary: getCSSCustomProperty('--color-brand-primary')
  };
}