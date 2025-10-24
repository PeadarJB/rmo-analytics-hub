import ClassBreaksRenderer from '@arcgis/core/renderers/ClassBreaksRenderer';
import SimpleLineSymbol from '@arcgis/core/symbols/SimpleLineSymbol';
import { 
  KPI_LABELS,
  KPIKey, 
  KPI_THRESHOLDS, 
  RENDERER_CONFIG, 
  CONFIG,
  getKPIFieldName,
  getConditionClass 
} from '@/config/appConfig';
import { getCSSCustomProperty, hexToRgb } from '@/utils/themeHelpers';

/**
 * Service for creating ArcGIS renderers for pavement condition KPIs.
 * Uses centralized thresholds and configuration from appConfig.ts
 * Implements caching for performance optimization.
 */
export default class RendererService {
  /**
   * Private cache for storing pre-computed renderers
   * Key format: "kpi_year" (e.g., "iri_2025")
   */
  private static rendererCache: Map<string, ClassBreaksRenderer> = new Map(); // Key: "kpi_year_themeMode"
  
  /**
   * Track whether renderers have been preloaded
   */
  private static isPreloaded: boolean = false;
  
  /**
   * Generate cache key for a KPI/year combination
   */
  private static getCacheKey(kpi: KPIKey, year: number, themeMode: 'light' | 'dark'): string {
    return `${kpi}_${year}_${themeMode}`;
  }
  
  /**
   * Get a cached renderer if it exists
   * @param kpi - The KPI type
   * @param year - The survey year
   * @returns Cached renderer or null if not found
   */
  static getCachedRenderer(kpi: KPIKey, year: number, themeMode: 'light' | 'dark'): ClassBreaksRenderer | null {
    const key = this.getCacheKey(kpi, year, themeMode);
    const cached = this.rendererCache.get(key);
    
    if (cached) {
      console.log(`Using cached renderer for ${kpi}/${year}`);
      return cached;
    }
    
    return null;
  }
  
  /**
   * Creates a class break renderer for a specific KPI and year.
   * This is the main factory method. It can create renderers based on:
   * 1. Pre-calculated class fields (e.g., `IRI_Class_2025`) for performance.
   * 2. Raw KPI values (e.g., `AIRI_2025`) as a fallback.
   * 
   * The method is designed to replace the older `createKPIRenderer`.
   * @param kpi - The KPI type (iri, rut, psci, etc.)
   * @param year - The survey year (2011, 2018, 2025)
   * @param themeMode - Current theme ('light' or 'dark')
   * @param useClassField - Whether to use pre-calculated class fields (default: true)
   * @returns A configured ClassBreaksRenderer or UniqueValueRenderer
   */
  static createRenderer(
    kpi: KPIKey, 
    year: number, 
    themeMode: 'light' | 'dark',
    useClassField: boolean = true
  ): ClassBreaksRenderer { // Note: Returns ClassBreaksRenderer for type consistency, even if underlying is UniqueValue
    // Check cache first
    const cached = this.getCachedRenderer(kpi, year, themeMode);
    if (cached) {
      return cached;
    }

    console.log(`Creating renderer for ${kpi}/${year}, useClassField: ${useClassField}`);

    // Use class field by default for performance
    const fieldName = getKPIFieldName(kpi, year, useClassField);
    const use5Classes = RENDERER_CONFIG.use5ClassRenderers;
    
    let renderer: ClassBreaksRenderer;

    if (useClassField) {
      // NEW: Use pre-calculated class fields (1-5 integer values)
      renderer = this.createClassFieldRenderer(kpi, fieldName, themeMode);
    } else {
      // FALLBACK: Use raw values with threshold calculations
      renderer = this.createRawValueRenderer(kpi, fieldName, themeMode, use5Classes);
    }

    // Cache the renderer
    const cacheKey = this.getCacheKey(kpi, year, themeMode);
    this.rendererCache.set(cacheKey, renderer);
    
    return renderer;
  }

  /**
   * @deprecated Use createRenderer instead.
   */
  static createKPIRenderer(kpi: KPIKey, year: number, themeMode: 'light' | 'dark'): ClassBreaksRenderer {
    const colors = RENDERER_CONFIG.getThemeAwareColors();

    // Check cache first
    const cached = this.getCachedRenderer(kpi, year, themeMode);
    if (cached) {
      return cached;
    }
    
    console.log(`Creating new renderer for ${kpi}/${year}`);
    
    // DEPRECATED: This path uses raw values. New path uses createRenderer.
    const fieldName = getKPIFieldName(kpi, year);
    
    // Get thresholds for this KPI from centralized config
    const thresholds = KPI_THRESHOLDS[kpi];
    
    // Create the renderer
    const renderer = new ClassBreaksRenderer({
      field: fieldName,
      defaultSymbol: new SimpleLineSymbol({
        color: hexToRgb(getCSSCustomProperty('--color-fg-muted'), 0.5), // Gray for null/undefined values
        width: RENDERER_CONFIG.lineWidth || 4
      }),
      defaultLabel: 'No Data'
    });
    
    // Add class breaks based on KPI type
    if (kpi === 'iri' || kpi === 'rut' || kpi === 'lpv3') {
      // Lower values are better
      this.addStandardBreaks(renderer, kpi, thresholds, RENDERER_CONFIG.use5ClassRenderers, colors);
    } else if (kpi === 'csc') {
      // Higher values are better (inverted)
      this.addInvertedBreaks(renderer, kpi, thresholds, RENDERER_CONFIG.use5ClassRenderers, colors);
    } else if (kpi === 'psci') {
      // PSCI uses 1-10 scale, higher is better
      this.addPSCIBreaks(renderer, RENDERER_CONFIG.use5ClassRenderers, colors);
    } else if (kpi === 'mpd') {
      // MPD has simple poor/fair/good threshold
      this.addMPDBreaks(renderer, colors);
    }
    
    // Cache the renderer before returning
    const key = this.getCacheKey(kpi, year, themeMode);
    this.rendererCache.set(key, renderer);
    
    return renderer;
  }
  
  /**
   * Creates a renderer from a pre-calculated class field (e.g., `IRI_Class_2025`).
   * This is more performant as the classification is done on the server.
   * The field is expected to contain integer values (1-5) representing condition classes.
   * 1=Very Good, 2=Good, 3=Fair, 4=Poor, 5=Very Poor
   * @param kpi - The KPI for which to create the renderer.
   * @param fieldName - The name of the pre-calculated class field.
   * @param themeMode - The current UI theme.
   * @returns A configured ClassBreaksRenderer.
   */
  private static createClassFieldRenderer(
    kpi: KPIKey,
    fieldName: string,
    themeMode: 'light' | 'dark'
  ): ClassBreaksRenderer {
    const colors = RENDERER_CONFIG.getThemeAwareColors();
    const lineWidth = RENDERER_CONFIG.lineWidth;

    const renderer = new ClassBreaksRenderer({
      field: fieldName,
      defaultSymbol: new SimpleLineSymbol({
        color: hexToRgb(getCSSCustomProperty('--color-fg-muted'), 0.5),
        width: lineWidth
      }),
      defaultLabel: 'No Data'
    });

    // Define class breaks for integer values 1 through 5
    const classInfos = [
      { value: 1, label: 'Very Good', color: colors.veryGood },
      { value: 2, label: 'Good', color: colors.good },
      { value: 3, label: 'Fair', color: colors.fair },
      { value: 4, label: 'Poor', color: colors.poor },
      { value: 5, label: 'Very Poor', color: colors.veryPoor }
    ];

    // MPD only has 3 classes (Good, Fair, Poor), which we map to 2, 3, 4
    if (kpi === 'mpd') {
      renderer.addClassBreakInfo({
        minValue: 2, maxValue: 2, label: 'Good',
        symbol: new SimpleLineSymbol({ color: colors.good, width: lineWidth })
      });
      renderer.addClassBreakInfo({
        minValue: 3, maxValue: 3, label: 'Fair',
        symbol: new SimpleLineSymbol({ color: colors.fair, width: lineWidth })
      });
      renderer.addClassBreakInfo({
        minValue: 4, maxValue: 4, label: 'Poor',
        symbol: new SimpleLineSymbol({ color: colors.poor, width: lineWidth })
      });
    } else {
      classInfos.forEach(info => {
        renderer.addClassBreakInfo({
          minValue: info.value,
          maxValue: info.value,
          label: info.label,
          symbol: new SimpleLineSymbol({ color: info.color, width: lineWidth })
        });
      });
    }

    return renderer;
  }

  /**
   * Creates a renderer by applying class breaks to raw KPI values.
   * This is the fallback method if pre-calculated fields are not used.
   * @param kpi - The KPI for which to create the renderer.
   * @param fieldName - The name of the raw value field.
   * @param themeMode - The current UI theme.
   * @param use5Classes - Whether to use a 5-class or 3-class system.
   * @returns A configured ClassBreaksRenderer.
   */
  private static createRawValueRenderer(
    kpi: KPIKey,
    fieldName: string,
    themeMode: 'light' | 'dark',
    use5Classes: boolean
  ): ClassBreaksRenderer {
    const colors = RENDERER_CONFIG.getThemeAwareColors();
    const thresholds = KPI_THRESHOLDS[kpi];
    const renderer = new ClassBreaksRenderer({
      field: fieldName,
      defaultSymbol: new SimpleLineSymbol({ color: hexToRgb(getCSSCustomProperty('--color-fg-muted'), 0.5), width: RENDERER_CONFIG.lineWidth }),
      defaultLabel: 'No Data'
    });

    if (kpi === 'iri' || kpi === 'rut' || kpi === 'lpv3') this.addStandardBreaks(renderer, kpi, thresholds, use5Classes, colors);
    else if (kpi === 'csc') this.addInvertedBreaks(renderer, kpi, thresholds, use5Classes, colors);
    else if (kpi === 'psci') this.addPSCIBreaks(renderer, use5Classes, colors);
    else if (kpi === 'mpd') this.addMPDBreaks(renderer, colors);

    return renderer;
  }

  /**
   * Preload all possible renderer combinations at startup
   * This creates all 18 renderers (6 KPIs × 3 years) in advance
   * @returns Promise that resolves when all renderers are loaded
   */
  static async preloadAllRenderers(themeMode: 'light' | 'dark'): Promise<void> {
    if (this.isPreloaded) {
      console.log('Renderers already preloaded, skipping');
      return;
    }
    
    console.log('Preloading all renderers...');
    const startTime = performance.now();
    
    // Get all valid KPIs and years
    const kpis: KPIKey[] = ['iri', 'rut', 'psci', 'csc', 'mpd', 'lpv3'];
    const years = CONFIG.filters.year.options?.map(o => o.value) || [2011, 2018, 2025];
    
    let count = 0;
    const total = kpis.length * years.length;
    
    // Create all combinations
    for (const kpi of kpis) {
      for (const year of years) {
        // This will create and cache each renderer
        this.createRenderer(kpi, year, themeMode);
        count++;
        
        // Yield to browser to prevent blocking
        if (count % 6 === 0) {
          await new Promise(resolve => setTimeout(resolve, 0));
        }
      }
    }
    
    const endTime = performance.now();
    const duration = Math.round(endTime - startTime);
    
    console.log(`Preloaded ${count} renderers in ${duration}ms`);
    console.log(`Cache size: ${this.rendererCache.size} renderers`);
    
    this.isPreloaded = true;
  }
  
  /**
   * Clear the renderer cache (useful for testing or memory management)
   */
  static clearCache(): void {
    console.log(`Clearing renderer cache (${this.rendererCache.size} items)`);
    this.rendererCache.clear();
    this.isPreloaded = false;
  }
  
  /**
   * Get cache statistics (for debugging/monitoring)
   */
  static getCacheStats(): { size: number; keys: string[]; isPreloaded: boolean } {
    return {
      size: this.rendererCache.size,
      keys: Array.from(this.rendererCache.keys()),
      isPreloaded: this.isPreloaded
    };
  }
  
  /**
   * Add standard class breaks (lower values = better condition)
   * Used for IRI, RUT, and LPV3
   */
  private static addStandardBreaks(
    renderer: ClassBreaksRenderer, 
    kpi: KPIKey,
    thresholds: typeof KPI_THRESHOLDS[KPIKey],
    use5Classes: boolean = false,
    colors: any
  ): void {
    const lineWidth = RENDERER_CONFIG.lineWidth;
    
    if (use5Classes && thresholds.veryGood !== undefined && thresholds.poor !== undefined) {
      // 5-class system with Very Good through Very Poor
      renderer.addClassBreakInfo({
        minValue: 0,
        maxValue: thresholds.veryGood,
        symbol: new SimpleLineSymbol({ color: colors.veryGood, width: lineWidth }),
        label: `Very Good (< ${thresholds.veryGood})`
      });
      
      renderer.addClassBreakInfo({
        minValue: thresholds.veryGood,
        maxValue: thresholds.good,
        symbol: new SimpleLineSymbol({ color: colors.good, width: lineWidth }),
        label: `Good (${thresholds.veryGood}-${thresholds.good})`
      });
      
      renderer.addClassBreakInfo({
        minValue: thresholds.good,
        maxValue: thresholds.fair,
        symbol: new SimpleLineSymbol({ color: colors.fair, width: lineWidth }),
        label: `Fair (${thresholds.good}-${thresholds.fair})`
      });
      
      renderer.addClassBreakInfo({
        minValue: thresholds.fair,
        maxValue: thresholds.poor,
        symbol: new SimpleLineSymbol({ color: colors.poor, width: lineWidth }),
        label: `Poor (${thresholds.fair}-${thresholds.poor})`
      });
      
      renderer.addClassBreakInfo({
        minValue: thresholds.poor,
        maxValue: 9999999,
        symbol: new SimpleLineSymbol({ color: colors.veryPoor, width: lineWidth }),
        label: `Very Poor (> ${thresholds.poor})`
      });
    } else {
      // Simplified 3-class system
      const goodMax = thresholds.good;
      const fairMax = thresholds.fair;
      
      renderer.addClassBreakInfo({
        minValue: 0,
        maxValue: goodMax,
        symbol: new SimpleLineSymbol({ color: colors.good, width: lineWidth }),
        label: `Good (< ${goodMax})`
      });
      
      renderer.addClassBreakInfo({
        minValue: goodMax,
        maxValue: fairMax,
        symbol: new SimpleLineSymbol({ color: colors.fair, width: lineWidth }),
        label: `Fair (${goodMax}-${fairMax})`
      });
      
      renderer.addClassBreakInfo({
        minValue: fairMax,
        maxValue: 9999999,
        symbol: new SimpleLineSymbol({ color: colors.poor, width: lineWidth }),
        label: `Poor (> ${fairMax})`
      });
    }
  }
  
  /**
   * Add inverted class breaks for CSC (higher values = better condition)
   * CSC: ≤0.35 = Very Poor, 0.35-0.40 = Poor, 0.40-0.45 = Fair, 0.45-0.50 = Good, >0.50 = Very Good
   */
  private static addInvertedBreaks(
    renderer: ClassBreaksRenderer,
    kpi: KPIKey,
    thresholds: typeof KPI_THRESHOLDS[KPIKey],
    use5Classes: boolean = false,
    colors: any
  ): void {
    const lineWidth = RENDERER_CONFIG.lineWidth;
    
    if (use5Classes && thresholds.veryPoor !== undefined && thresholds.poor !== undefined && thresholds.good !== undefined) {
      // 5-class system for CSC
      renderer.addClassBreakInfo({
        minValue: 0,
        maxValue: thresholds.veryPoor,
        symbol: new SimpleLineSymbol({ color: colors.veryPoor, width: lineWidth }),
        label: `Very Poor (≤ ${thresholds.veryPoor})`
      });
      
      renderer.addClassBreakInfo({
        minValue: thresholds.veryPoor,
        maxValue: thresholds.poor,
        symbol: new SimpleLineSymbol({ color: colors.poor, width: lineWidth }),
        label: `Poor (${thresholds.veryPoor}-${thresholds.poor})`
      });
      
      renderer.addClassBreakInfo({
        minValue: thresholds.poor,
        maxValue: thresholds.fair,
        symbol: new SimpleLineSymbol({ color: colors.fair, width: lineWidth }),
        label: `Fair (${thresholds.poor}-${thresholds.fair})`
      });
      
      renderer.addClassBreakInfo({
        minValue: thresholds.fair,
        maxValue: thresholds.good,
        symbol: new SimpleLineSymbol({ color: colors.good, width: lineWidth }),
        label: `Good (${thresholds.fair}-${thresholds.good})`
      });
      
      renderer.addClassBreakInfo({
        minValue: thresholds.good,
        maxValue: 1,
        symbol: new SimpleLineSymbol({ color: colors.veryGood, width: lineWidth }),
        label: `Very Good (> ${thresholds.good})`
      });
    } else {
      // 3-class system for CSC
      const poorMax = thresholds.veryPoor || thresholds.poor!;
      
      renderer.addClassBreakInfo({
        minValue: 0,
        maxValue: poorMax,
        symbol: new SimpleLineSymbol({ color: colors.poor, width: lineWidth }),
        label: `Poor (< ${poorMax})`
      });
      
      renderer.addClassBreakInfo({
        minValue: poorMax,
        maxValue: thresholds.fair,
        symbol: new SimpleLineSymbol({ color: colors.fair, width: lineWidth }),
        label: `Fair (${poorMax}-${thresholds.fair})`
      });
      
      renderer.addClassBreakInfo({
        minValue: thresholds.fair,
        maxValue: 1,
        symbol: new SimpleLineSymbol({ color: colors.good, width: lineWidth }),
        label: `Good (> ${thresholds.fair})`
      });
    }
  }
  
  /**
   * Add PSCI-specific breaks (1-10 scale)
   * PSCI remedial categories from 2018 report:
   * - 1-2: Road Reconstruction
   * - 3-4: Structural Rehabilitation  
   * - 5-6: Surface Restoration
   * - 7-8: Restoration of Skid Resistance
   * - 9-10: Routine Maintenance
   * * Note: ClassBreaksRenderer treats maxValue as inclusive.
   * To avoid overlap, we use values like 2.999, 4.999, etc.
   */
  private static addPSCIBreaks(renderer: ClassBreaksRenderer, use5Classes: boolean = false, colors: any): void {
    const lineWidth = RENDERER_CONFIG.lineWidth;
    const thresholds = KPI_THRESHOLDS.psci;
    
    if (use5Classes) {
      // 5-class system matching remedial categories
      renderer.addClassBreakInfo({
        minValue: 0,
        maxValue: thresholds.veryPoor!, // Using value from appConfig
        symbol: new SimpleLineSymbol({ color: colors.veryPoor, width: lineWidth }),
        label: 'Very Poor (1-2): Reconstruction'
      });
      
      renderer.addClassBreakInfo({
        minValue: thresholds.veryPoor!,
        maxValue: thresholds.poor!,
        symbol: new SimpleLineSymbol({ color: colors.poor, width: lineWidth }),
        label: 'Poor (3-4): Structural Rehab'
      });
      
      renderer.addClassBreakInfo({
        minValue: thresholds.poor!,
        maxValue: thresholds.fair!,
        symbol: new SimpleLineSymbol({ color: colors.fair, width: lineWidth }),
        label: 'Fair (5-6): Surface Restoration'
      });
      
      renderer.addClassBreakInfo({
        minValue: thresholds.fair!,
        maxValue: thresholds.good!,
        symbol: new SimpleLineSymbol({ color: colors.good, width: lineWidth }),
        label: 'Good (7-8): Skid Resistance'
      });
      
      renderer.addClassBreakInfo({
        minValue: thresholds.good!,
        maxValue: 10,
        symbol: new SimpleLineSymbol({ color: colors.veryGood, width: lineWidth }),
        label: 'Very Good (9-10): Routine Maint.'
      });
    } else {
      // Simplified 3-class system
      renderer.addClassBreakInfo({
        minValue: 0,
        maxValue: thresholds.poor!,
        symbol: new SimpleLineSymbol({ color: colors.poor, width: lineWidth }),
        label: 'Poor (1-4): Reconstruction/Structural'
      });
      
      renderer.addClassBreakInfo({
        minValue: thresholds.poor!,
        maxValue: thresholds.fair!,
        symbol: new SimpleLineSymbol({ color: colors.fair, width: lineWidth }),
        label: 'Fair (5-6): Surface Restoration'
      });
      
      renderer.addClassBreakInfo({
        minValue: thresholds.fair!,
        maxValue: 10,
        symbol: new SimpleLineSymbol({ color: colors.good, width: lineWidth }),
        label: 'Good (7-10): Routine Maintenance'
      });
    }
  }
  
  /**
   * Add MPD-specific breaks
   * MPD (Mean Profile Depth) for skid resistance:
   * - < 0.6mm: Poor skid resistance
   * - 0.6-0.7mm: Fair (transitional)
   * - > 0.7mm: Good skid resistance
   */
  private static addMPDBreaks(renderer: ClassBreaksRenderer, colors: any): void {
    const lineWidth = RENDERER_CONFIG.lineWidth;
    const thresholds = KPI_THRESHOLDS.mpd;
    
    renderer.addClassBreakInfo({
      minValue: 0,
      maxValue: thresholds.poor!,
      symbol: new SimpleLineSymbol({ color: colors.poor, width: lineWidth }),
      label: `Poor Skid Resistance (< ${thresholds.poor}mm)`
    });
    
    renderer.addClassBreakInfo({
      minValue: thresholds.poor!,
      maxValue: thresholds.good!,
      symbol: new SimpleLineSymbol({ color: colors.fair, width: lineWidth }),
      label: `Fair (${thresholds.poor}-${thresholds.good}mm)`
    });
    
    renderer.addClassBreakInfo({
      minValue: thresholds.good!,
      maxValue: 9999999,
      symbol: new SimpleLineSymbol({ color: colors.good, width: lineWidth }),
      label: `Good Skid Resistance (≥ ${thresholds.good}mm)`
    });
  }
  
  /**
   * Get the condition class for a value based on KPI type and thresholds
   * This method is now a wrapper around the centralized function in appConfig
   * Kept for backward compatibility
   * * @deprecated Use getConditionClass from appConfig directly
   */
  static getConditionClass(kpi: KPIKey, value: number): 'good' | 'fair' | 'poor' | null {
    const detailedClass = getConditionClass(kpi, value, false);
    
    if (!detailedClass) return null;
    
    // Map to simplified 3-class system
    if (detailedClass === 'veryGood' || detailedClass === 'good') return 'good';
    if (detailedClass === 'fair') return 'fair';
    return 'poor';
  }
  
  /**
   * Creates a simple renderer with a single symbol (no classification)
   * Useful for highlighting selected features or showing all features uniformly
   */
  static createSimpleRenderer(color?: number[], width?: number): any {
    const symbolColor = color || hexToRgb(getCSSCustomProperty('--color-brand-primary'), 0.8);
    const symbolWidth = width || RENDERER_CONFIG.lineWidth;

    return {
      type: 'simple',
      symbol: new SimpleLineSymbol({
        color: symbolColor,
        width: symbolWidth
      })
    };
  }
  
  /**
   * Creates a unique value renderer for categorical data (e.g., subgroups)
   * @param field - The field name to use for unique values
   * @param valueColorMap - Map of field values to colors
   */
  static createUniqueValueRenderer(
    field: string, 
    valueColorMap: Map<string, number[]>
  ): any {
    const uniqueValueInfos: any[] = [];
    const lineWidth = RENDERER_CONFIG.lineWidth;
    
    valueColorMap.forEach((color, value) => {
      uniqueValueInfos.push({
        value: value,
        symbol: new SimpleLineSymbol({
          color: color,
          width: lineWidth
        }),
        label: value
      });
    });
    
    return {
      type: 'unique-value',
      field: field,
      uniqueValueInfos: uniqueValueInfos,
      defaultSymbol: new SimpleLineSymbol({
        color: hexToRgb(getCSSCustomProperty('--color-fg-muted'), 0.5),
        width: lineWidth
      }),
      defaultLabel: 'Other'
    };
  }

  /**
   * Clear cached renderers for a specific theme mode
   * Call this when theme changes to prevent stale renderers
   */
  static clearThemeCache(themeMode: 'light' | 'dark'): void {
    const keysToDelete: string[] = [];
    
    this.rendererCache.forEach((_, key) => {
      if (key.endsWith(`_${themeMode}`)) {
        keysToDelete.push(key);
      }
    });
    
    keysToDelete.forEach(key => this.rendererCache.delete(key));
    
    console.log(`[Renderer Cache] Cleared ${keysToDelete.length} cached renderers for ${themeMode} theme`);
  }
}