// src/services/LARendererService.ts
// MODIFIED VERSION - Implements continuous gradients using SimpleRenderer with visual variables

import SimpleRenderer from '@arcgis/core/renderers/SimpleRenderer';
import ClassBreaksRenderer from '@arcgis/core/renderers/ClassBreaksRenderer';
import SimpleFillSymbol from '@arcgis/core/symbols/SimpleFillSymbol';
import SimpleLineSymbol from '@arcgis/core/symbols/SimpleLineSymbol';
import type FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import {
  LAMetricType,
  LA_FIELD_PATTERNS,
  LA_COLOR_GRADIENTS,
  LA_PERCENTAGE_RANGES
} from '@/config/appConfig';
import { KPIKey, KPI_THRESHOLDS } from '@/config/kpiConfig';

/**
 * Service for creating ArcGIS renderers for LA polygon layers
 * Supports two visualization modes:
 * - Average: Shows county average KPI values with continuous gradient
 * - Fair or Better: Shows percentage of roads in acceptable condition with continuous gradient
 *
 * MODIFIED: Now uses SimpleRenderer with visual variables for true continuous gradients
 */
export default class LARendererService {
  private static rendererCache = new Map<string, SimpleRenderer | ClassBreaksRenderer>();
  private static maxValueCache = new Map<string, number>();

  /**
   * Generate cache key for renderer
   */
  private static getCacheKey(
    kpi: KPIKey,
    year: number,
    metricType: LAMetricType,
    themeMode: 'light' | 'dark'
  ): string {
    return `la_${kpi}_${year}_${metricType}_${themeMode}`;
  }

  /**
   * Generate cache key for max value queries
   */
  private static getMaxValueCacheKey(kpi: KPIKey, year: number, metricType: LAMetricType): string {
    return `max_${kpi}_${year}_${metricType}`;
  }

  /**
   * Query the LA layer to get the maximum value for a field
   * Used to dynamically set the upper bound of the gradient
   */
  private static async queryMaxValue(
    layer: FeatureLayer,
    fieldName: string,
    kpi: KPIKey,
    year: number,
    metricType: LAMetricType
  ): Promise<number> {
    const cacheKey = this.getMaxValueCacheKey(kpi, year, metricType);

    // Check cache first
    if (this.maxValueCache.has(cacheKey)) {
      console.log(`✓ Using cached max value for ${cacheKey}: ${this.maxValueCache.get(cacheKey)}`);
      return this.maxValueCache.get(cacheKey)!;
    }

    try {
      const query = layer.createQuery();
      query.where = `${fieldName} IS NOT NULL`;
      query.outStatistics = [{
        onStatisticField: fieldName,
        outStatisticFieldName: 'maxValue',
        statisticType: 'max'
      }] as any;

      const result = await layer.queryFeatures(query);

      if (result.features.length > 0 && result.features[0].attributes.maxValue != null) {
        const maxValue = result.features[0].attributes.maxValue;
        console.log(`✓ Queried max value for ${fieldName}: ${maxValue}`);

        // Cache the result
        this.maxValueCache.set(cacheKey, maxValue);
        return maxValue;
      }
    } catch (error) {
      console.error(`Error querying max value for ${fieldName}:`, error);
    }

    // Fallback to configured max if query fails
    const fallback = metricType === 'fairOrBetter'
      ? LA_PERCENTAGE_RANGES[kpi].max
      : this.getDefaultMaxForAverage(kpi);
    console.warn(`Using fallback max value: ${fallback}`);
    return fallback;
  }

  /**
   * Get default max value for average mode based on KPI thresholds
   */
  private static getDefaultMaxForAverage(kpi: KPIKey): number {
    // Use a reasonable maximum based on KPI characteristics
    if (kpi === 'iri' || kpi === 'lpv3') return 10; // Roughness metrics
    if (kpi === 'rut') return 30; // Rut depth
    if (kpi === 'csc') return 0.7; // Skid resistance
    if (kpi === 'mpd') return 1.5; // Texture depth
    if (kpi === 'psci') return 10; // Visual condition
    return 100; // Generic fallback
  }

  /**
   * Main entry point: Create renderer based on mode
   * Now returns SimpleRenderer for continuous gradients
   *
   * @param kpi - The KPI to visualize
   * @param year - Survey year (2011, 2018, 2025)
   * @param metricType - Visualization mode ('average' or 'fairOrBetter')
   * @param themeMode - Current theme for outline colors
   * @param layer - The LA FeatureLayer (needed to query max values for 2025 data)
   * @returns SimpleRenderer with continuous gradient
   */
  static async createLARenderer(
    kpi: KPIKey,
    year: number,
    metricType: LAMetricType,
    themeMode: 'light' | 'dark',
    layer: FeatureLayer
  ): Promise<SimpleRenderer | ClassBreaksRenderer> {
    // Check cache
    const cacheKey = this.getCacheKey(kpi, year, metricType, themeMode);
    const cached = this.rendererCache.get(cacheKey);
    if (cached) {
      console.log(`✓ Using cached LA renderer: ${cacheKey}`);
      return cached;
    }

    console.log(`Creating LA renderer with continuous gradient: ${kpi}/${year}/${metricType}`);

    // Delegate to mode-specific method
    const renderer = metricType === 'fairOrBetter'
      ? await this.createFairOrBetterRenderer(kpi, year, themeMode, layer)
      : await this.createAverageValueRenderer(kpi, year, themeMode, layer);

    // Cache and return
    this.rendererCache.set(cacheKey, renderer);
    return renderer;
  }

  /**
   * MODE A: Fair or Better percentage renderer
   * Uses SimpleRenderer with visual variables for continuous gradient
   * Min value from 2019 report, Max value queried from 2025 data
   */
  private static async createFairOrBetterRenderer(
    kpi: KPIKey,
    year: number,
    themeMode: 'light' | 'dark',
    layer: FeatureLayer
  ): Promise<SimpleRenderer> {
    const fieldName = LA_FIELD_PATTERNS.fairOrBetter(kpi, year);
    const colors = LA_COLOR_GRADIENTS[kpi];

    // Get min from 2019 report configuration
    const minValue = LA_PERCENTAGE_RANGES[kpi].min;

    // Query max from 2025 data (only for year 2025)
    const maxValue = year === 2025
      ? await this.queryMaxValue(layer, fieldName, kpi, year, 'fairOrBetter')
      : LA_PERCENTAGE_RANGES[kpi].max;

    console.log(`Fair or Better gradient for ${kpi}: ${minValue}% - ${maxValue}%`);

    // MPD is inverse (shows % POOR, not % Fair-or-Better)
    const isInverse = kpi === 'mpd';
    const startColor = isInverse ? colors.veryGood : colors.veryPoor;
    const endColor = isInverse ? colors.veryPoor : colors.veryGood;

    return new SimpleRenderer({
      symbol: this.createFillSymbol([128, 128, 128], themeMode), // Default gray for no data
      visualVariables: [{
        type: 'color',
        field: fieldName,
        stops: [
          {
            value: minValue,
            color: [...startColor, 255] as any,  // Full opacity
            label: `${minValue.toFixed(0)}%`
          },
          {
            value: maxValue,
            color: [...endColor, 255] as any,  // Full opacity
            label: `${maxValue.toFixed(0)}%`
          }
        ]
      }] as any
    });
  }

  /**
   * MODE B: Average values renderer
   * Uses SimpleRenderer with visual variables for continuous gradient
   * Max value queried from 2025 data
   */
  private static async createAverageValueRenderer(
    kpi: KPIKey,
    year: number,
    themeMode: 'light' | 'dark',
    layer: FeatureLayer
  ): Promise<SimpleRenderer> {
    const fieldName = LA_FIELD_PATTERNS.average(kpi, year);
    const thresholds = KPI_THRESHOLDS[kpi];
    const colors = LA_COLOR_GRADIENTS[kpi];

    // Determine min and max based on KPI directionality
    const isLowerBetter = kpi === 'iri' || kpi === 'rut' || kpi === 'lpv3';

    let minValue: number;
    let maxValue: number;

    if (isLowerBetter) {
      // For "lower is better" KPIs, min is best (very good threshold), max is worst (query actual max)
      minValue = thresholds.veryGood || thresholds.good || 0;
      maxValue = year === 2025
        ? await this.queryMaxValue(layer, fieldName, kpi, year, 'average')
        : this.getDefaultMaxForAverage(kpi);
    } else {
      // For "higher is better" KPIs (csc, mpd, psci), min is worst, max is best (query actual max)
      minValue = thresholds.poor || 0;
      maxValue = year === 2025
        ? await this.queryMaxValue(layer, fieldName, kpi, year, 'average')
        : this.getDefaultMaxForAverage(kpi);
    }

    console.log(`Average gradient for ${kpi}: ${minValue} - ${maxValue}`);

    // Set colors based on directionality
    const startColor = isLowerBetter ? colors.veryGood : colors.veryPoor;
    const endColor = isLowerBetter ? colors.veryPoor : colors.veryGood;

    return new SimpleRenderer({
      symbol: this.createFillSymbol([128, 128, 128], themeMode), // Default gray for no data
      visualVariables: [{
        type: 'color',
        field: fieldName,
        stops: [
          {
            value: minValue,
            color: [...startColor, 255] as any,  // Full opacity
            label: minValue.toFixed(2)
          },
          {
            value: maxValue,
            color: [...endColor, 255] as any,  // Full opacity
            label: maxValue.toFixed(2)
          }
        ]
      }] as any
    });
  }

  /**
   * Helper: Create fill symbol with theme-aware outline
   * MODIFIED: Now uses full opacity (1.0) instead of 0.7
   */
  private static createFillSymbol(
    color: [number, number, number],
    themeMode: 'light' | 'dark'
  ): SimpleFillSymbol {
    const outlineColor = themeMode === 'dark' ? [100, 100, 100, 0.8] : [200, 200, 200, 0.8];

    return new SimpleFillSymbol({
      color: [...color, 255] as [number, number, number, number], // CHANGED: Full opacity (255/255 = 1.0)
      outline: new SimpleLineSymbol({
        color: outlineColor as [number, number, number, number],
        width: 0.5
      })
    });
  }

  /**
   * Clear the renderer cache
   */
  static clearCache(): void {
    console.log('Clearing LA renderer cache');
    this.rendererCache.clear();
    this.maxValueCache.clear();
  }

  /**
   * Get cache statistics
   */
  static getCacheStats(): {
    rendererCacheSize: number;
    rendererKeys: string[];
    maxValueCacheSize: number;
    maxValueKeys: string[];
  } {
    return {
      rendererCacheSize: this.rendererCache.size,
      rendererKeys: Array.from(this.rendererCache.keys()),
      maxValueCacheSize: this.maxValueCache.size,
      maxValueKeys: Array.from(this.maxValueCache.keys())
    };
  }
}
