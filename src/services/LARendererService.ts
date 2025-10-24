import ClassBreaksRenderer from '@arcgis/core/renderers/ClassBreaksRenderer';
import SimpleFillSymbol from '@arcgis/core/symbols/SimpleFillSymbol';
import SimpleLineSymbol from '@arcgis/core/symbols/SimpleLineSymbol';
import { 
  KPIKey, 
  LAMetricType, 
  LA_FIELD_PATTERNS, 
  LA_COLOR_GRADIENTS,
  LA_PERCENTAGE_RANGES,
  KPI_THRESHOLDS
} from '@/config/appConfig';

/**
 * Service for creating ArcGIS renderers for LA polygon layers
 * Supports two visualization modes:
 * - Average: Shows county average KPI values with threshold-based breaks
 * - Fair or Better: Shows percentage of roads in acceptable condition with continuous gradient
 */
export default class LARendererService {
  private static rendererCache = new Map<string, ClassBreaksRenderer>();

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
   * Main entry point: Create renderer based on mode
   * @param kpi - The KPI to visualize
   * @param year - Survey year (2011, 2018, 2025)
   * @param metricType - Visualization mode ('average' or 'fairOrBetter')
   * @param themeMode - Current theme for outline colors
   * @returns ClassBreaksRenderer configured for the LA layer
   */
  static createLARenderer(
    kpi: KPIKey,
    year: number,
    metricType: LAMetricType,
    themeMode: 'light' | 'dark'
  ): ClassBreaksRenderer {
    // Check cache
    const cacheKey = this.getCacheKey(kpi, year, metricType, themeMode);
    const cached = this.rendererCache.get(cacheKey);
    if (cached) {
      console.log(`✓ Using cached LA renderer: ${cacheKey}`);
      return cached;
    }

    console.log(`Creating LA renderer: ${kpi}/${year}/${metricType}`);

    // Delegate to mode-specific method
    const renderer = metricType === 'fairOrBetter'
      ? this.createFairOrBetterRenderer(kpi, year, themeMode)
      : this.createAverageValueRenderer(kpi, year, themeMode);

    // Cache and return
    this.rendererCache.set(cacheKey, renderer);
    return renderer;
  }

  /**
   * MODE A: Fair or Better percentage renderer
   * Uses continuous gradient across KPI-specific percentage range
   */
  private static createFairOrBetterRenderer(
    kpi: KPIKey,
    year: number,
    themeMode: 'light' | 'dark'
  ): ClassBreaksRenderer {
    const fieldName = LA_FIELD_PATTERNS.fairOrBetter(kpi, year);
    const range = LA_PERCENTAGE_RANGES[kpi];
    const colors = LA_COLOR_GRADIENTS[kpi];

    const renderer = new ClassBreaksRenderer({
      field: fieldName,
      defaultSymbol: this.createFillSymbol([200, 200, 200], themeMode),
      defaultLabel: 'No Data'
    });

    // MPD is inverse (shows % POOR, not % Fair-or-Better)
    if (kpi === 'mpd') {
      this.createContinuousBreaks(
        renderer,
        colors,
        range.min,
        range.max,
        10,
        true  // inverse colors for MPD
      );
    } else {
      this.createContinuousBreaks(
        renderer,
        colors,
        range.min,
        range.max,
        10,
        false
      );
    }

    return renderer;
  }

  /**
   * MODE B: Average values renderer
   * Uses threshold-based color breaks
   */
  private static createAverageValueRenderer(
    kpi: KPIKey,
    year: number,
    themeMode: 'light' | 'dark'
  ): ClassBreaksRenderer {
    const fieldName = LA_FIELD_PATTERNS.average(kpi, year);
    const thresholds = KPI_THRESHOLDS[kpi];
    const colors = LA_COLOR_GRADIENTS[kpi];

    const renderer = new ClassBreaksRenderer({
      field: fieldName,
      defaultSymbol: this.createFillSymbol([200, 200, 200], themeMode),
      defaultLabel: 'No Data'
    });

    // Handle KPI-specific class counts
    if (kpi === 'psci') {
      // PSCI: 4 classes only (9-10, 7-8, 5-6, 1-4)
      this.applyPSCIBreaks(renderer, colors, themeMode);
    } else if (kpi === 'mpd') {
      // MPD: 3 classes only (Good, Fair, Poor)
      this.applyMPDBreaks(renderer, colors, thresholds, themeMode);
    } else {
      // Standard 5 classes
      this.applyThresholdBreaks(renderer, colors, thresholds, kpi, themeMode);
    }

    return renderer;
  }

  /**
   * Helper: Create continuous gradient classes
   */
  private static createContinuousBreaks(
    renderer: ClassBreaksRenderer,
    colors: Record<string, [number, number, number]>,
    min: number,
    max: number,
    numClasses: number = 10,
    inverse: boolean = false
  ): void {
    const range = max - min;
    const step = range / numClasses;

    // Get color endpoints
    const startColor = inverse ? colors.veryGood : colors.veryPoor;
    const endColor = inverse ? colors.veryPoor : colors.veryGood;

    for (let i = 0; i < numClasses; i++) {
      const minValue = min + (i * step);
      const maxValue = min + ((i + 1) * step);
      
      // Interpolate color
      const t = i / (numClasses - 1);
      const r = Math.round(startColor[0] + t * (endColor[0] - startColor[0]));
      const g = Math.round(startColor[1] + t * (endColor[1] - startColor[1]));
      const b = Math.round(startColor[2] + t * (endColor[2] - startColor[2]));

      renderer.addClassBreakInfo({
        minValue: minValue,
        maxValue: maxValue,
        symbol: this.createFillSymbol([r, g, b], 'light'),
        label: `${minValue.toFixed(0)}% - ${maxValue.toFixed(0)}%`
      });
    }
  }

  /**
   * Helper: Apply threshold-based breaks (5 classes)
   */
  private static applyThresholdBreaks(
    renderer: ClassBreaksRenderer,
    colors: Record<string, [number, number, number]>,
    thresholds: any,
    kpi: KPIKey,
    themeMode: 'light' | 'dark'
  ): void {
    // Determine directionality
    const isLowerBetter = kpi === 'iri' || kpi === 'rut' || kpi === 'lpv3';
    const isHigherBetter = kpi === 'csc';

    if (isLowerBetter) {
      // Lower is better: IRI, Rut, LPV
      // Very Good (darkest) = lowest values
      // Very Poor (lightest) = highest values
      renderer.addClassBreakInfo({
        minValue: 0,
        maxValue: thresholds.veryGood || thresholds.good,
        symbol: this.createFillSymbol(colors.veryGood, themeMode),
        label: 'Very Good'
      });
      renderer.addClassBreakInfo({
        minValue: thresholds.veryGood || thresholds.good,
        maxValue: thresholds.good,
        symbol: this.createFillSymbol(colors.good, themeMode),
        label: 'Good'
      });
      renderer.addClassBreakInfo({
        minValue: thresholds.good,
        maxValue: thresholds.fair,
        symbol: this.createFillSymbol(colors.fair, themeMode),
        label: 'Fair'
      });
      renderer.addClassBreakInfo({
        minValue: thresholds.fair,
        maxValue: thresholds.poor || 999,
        symbol: this.createFillSymbol(colors.poor, themeMode),
        label: 'Poor'
      });
      renderer.addClassBreakInfo({
        minValue: thresholds.poor || thresholds.fair,
        maxValue: 9999,
        symbol: this.createFillSymbol(colors.veryPoor, themeMode),
        label: 'Very Poor'
      });
    } else if (isHigherBetter) {
      // Higher is better: CSC
      // Very Good (lightest) = highest values
      // Very Poor (darkest) = lowest values
      renderer.addClassBreakInfo({
        minValue: thresholds.good,
        maxValue: 999,
        symbol: this.createFillSymbol(colors.veryGood, themeMode),
        label: 'Very Good'
      });
      renderer.addClassBreakInfo({
        minValue: thresholds.fair,
        maxValue: thresholds.good,
        symbol: this.createFillSymbol(colors.good, themeMode),
        label: 'Good'
      });
      renderer.addClassBreakInfo({
        minValue: thresholds.poor!,
        maxValue: thresholds.fair,
        symbol: this.createFillSymbol(colors.fair, themeMode),
        label: 'Fair'
      });
      renderer.addClassBreakInfo({
        minValue: thresholds.veryPoor!,
        maxValue: thresholds.poor!,
        symbol: this.createFillSymbol(colors.poor, themeMode),
        label: 'Poor'
      });
      renderer.addClassBreakInfo({
        minValue: 0,
        maxValue: thresholds.veryPoor!,
        symbol: this.createFillSymbol(colors.veryPoor, themeMode),
        label: 'Very Poor'
      });
    }
  }

  /**
   * Helper: Apply PSCI breaks (4 classes only)
   * Classes: 9-10, 7-8, 5-6, 1-4
   */
  private static applyPSCIBreaks(
    renderer: ClassBreaksRenderer,
    colors: Record<string, [number, number, number]>,
    themeMode: 'light' | 'dark'
  ): void {
    // PSCI uses 4 classes based on 2018 Regional Report
    // Class 1: 9-10 (Very Good)
    renderer.addClassBreakInfo({
      minValue: 9,
      maxValue: 10,
      symbol: this.createFillSymbol(colors.veryGood, themeMode),
      label: '9-10 (Very Good)'
    });
    // Class 2: 7-8 (Good)
    renderer.addClassBreakInfo({
      minValue: 7,
      maxValue: 9,
      symbol: this.createFillSymbol(colors.good, themeMode),
      label: '7-8 (Good)'
    });
    // Class 3: 5-6 (Fair)
    renderer.addClassBreakInfo({
      minValue: 5,
      maxValue: 7,
      symbol: this.createFillSymbol(colors.fair, themeMode),
      label: '5-6 (Fair)'
    });
    // Class 4: 1-4 (Poor) - combines Poor and Very Poor
    renderer.addClassBreakInfo({
      minValue: 1,
      maxValue: 5,
      symbol: this.createFillSymbol(colors.poor, themeMode),
      label: '1-4 (Poor)'
    });
  }

  /**
   * Helper: Apply MPD breaks (3 classes only)
   * Classes: Good (≥0.7), Fair (0.6-0.7), Poor (<0.6)
   */
  private static applyMPDBreaks(
    renderer: ClassBreaksRenderer,
    colors: Record<string, [number, number, number]>,
    thresholds: any,
    themeMode: 'light' | 'dark'
  ): void {
    // MPD: Higher is better, 3 classes only
    renderer.addClassBreakInfo({
      minValue: thresholds.good,
      maxValue: 999,
      symbol: this.createFillSymbol(colors.good, themeMode),
      label: 'Good (≥0.7)'
    });
    renderer.addClassBreakInfo({
      minValue: thresholds.poor!,
      maxValue: thresholds.good,
      symbol: this.createFillSymbol(colors.fair, themeMode),
      label: 'Fair (0.6-0.7)'
    });
    renderer.addClassBreakInfo({
      minValue: 0,
      maxValue: thresholds.poor!,
      symbol: this.createFillSymbol(colors.poor, themeMode),
      label: 'Poor (<0.6)'
    });
  }

  /**
   * Helper: Create fill symbol with theme-aware outline
   */
  private static createFillSymbol(
    color: [number, number, number],
    themeMode: 'light' | 'dark'
  ): SimpleFillSymbol {
    const outlineColor = themeMode === 'dark' ? [100, 100, 100, 0.8] : [200, 200, 200, 0.8];
    
    return new SimpleFillSymbol({
      color: [...color, 0.7] as [number, number, number, number],
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
  }

  /**
   * Get cache statistics
   */
  static getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.rendererCache.size,
      keys: Array.from(this.rendererCache.keys())
    };
  }
}