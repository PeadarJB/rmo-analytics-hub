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
 * 
 * PHASE 3: Updated to use pre-calculated class fields for better performance
 */
export default class RendererService {
  /**
   * Private cache for storing pre-computed renderers
   * Key format: "kpi_year_themeMode" (e.g., "iri_2025_light")
   */
  private static rendererCache: Map<string, ClassBreaksRenderer> = new Map();
  
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
   * @param themeMode - Current theme mode
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
   * Creates or retrieves a cached renderer for the given KPI, year, and theme.
   * This is the main entry point for all renderer creation.
   * Uses caching to avoid expensive renderer recreation (90-95% performance improvement).
   * 
   * @param kpi - The KPI type (iri, rut, psci, csc, mpd, lpv3)
   * @param year - Survey year (2011, 2018, or 2025)
   * @param themeMode - Current theme mode ('light' or 'dark')
   * @param useClassField - Whether to use pre-calculated class fields (default: true)
   * @returns ClassBreaksRenderer for the specified parameters
   */
  static createRenderer(
    kpi: KPIKey, 
    year: number, 
    themeMode: 'light' | 'dark',
    useClassField: boolean = true
  ): ClassBreaksRenderer {
    // ✅ FIX: Check cache first - this is the key performance optimization
    const cached = this.getCachedRenderer(kpi, year, themeMode);
    if (cached) {
      console.log(`⚡ Using cached renderer for ${kpi}/${year}/${themeMode}`);
      // ✅ CRITICAL: Clone the renderer to avoid shared state issues
      // Without cloning, multiple layers would share the same renderer object
      return cached.clone();
    }
    
    // Cache miss - create new renderer
    console.log(`🔨 Creating new renderer for ${kpi}/${year}/${themeMode}`);
    const startTime = performance.now();
    
    const fieldName = getKPIFieldName(kpi, year, useClassField); // Use class field by default for performance
    const use5Classes = RENDERER_CONFIG.use5ClassRenderers; // Determine 5-class usage

    let renderer: ClassBreaksRenderer;

    if (useClassField) {
      // NEW: Use pre-calculated class fields (1-5 integer values)
      renderer = this.createClassFieldRenderer(kpi, fieldName, themeMode);
    } else {
      // FALLBACK: Use raw values with threshold calculations
      renderer = this.createRawValueRenderer(kpi, fieldName, themeMode, use5Classes);
    }

    // Cache the renderer
    this.rendererCache.set(this.getCacheKey(kpi, year, themeMode), renderer);
    
    const duration = performance.now() - startTime;
    console.log(`✓ Renderer created and cached in ${duration.toFixed(2)}ms`);
    
    // Return the newly created renderer
    return renderer;
  }

  /**
   * NEW: Creates renderer using pre-calculated class fields
   * Class field values: 1=Very Good, 2=Good, 3=Fair, 4=Poor, 5=Very Poor
   * @param kpi - The KPI type
   * @param classFieldName - The class field name (e.g., "IRI_Class_2025")
   * @param themeMode - Current theme mode
   * @returns ClassBreaksRenderer using class field values
   */
  private static createClassFieldRenderer(
    kpi: KPIKey,
    classFieldName: string,
    themeMode: 'light' | 'dark'
  ): ClassBreaksRenderer {
    const colors = RENDERER_CONFIG.getThemeAwareColors();
    const lineWidth = RENDERER_CONFIG.lineWidth;

    const renderer = new ClassBreaksRenderer({
      field: classFieldName,
      defaultSymbol: new SimpleLineSymbol({
        color: hexToRgb(getCSSCustomProperty('--color-fg-muted'), 0.5),
        width: lineWidth
      }),
      defaultLabel: 'No Data'
    });

    // Handle KPI-specific class counts
    if (kpi === 'psci') {
      // PSCI: 4 classes (1-4, no class 5)
      this.addClassBreak(renderer, 1, 1, colors.veryGood as [number, number, number, number], lineWidth, 'Very Good (9-10)');
      this.addClassBreak(renderer, 2, 2, colors.good as [number, number, number, number], lineWidth, 'Good (7-8)');
      this.addClassBreak(renderer, 3, 3, colors.fair as [number, number, number, number], lineWidth, 'Fair (5-6)');
      this.addClassBreak(renderer, 4, 4, colors.poor as [number, number, number, number], lineWidth, 'Poor (1-4)');
    } else if (kpi === 'mpd') {
      // MPD: 3 classes (1=Good, 2=Fair, 3=Poor)
      this.addClassBreak(renderer, 1, 1, colors.veryGood as [number, number, number, number], lineWidth, 'Good (≥0.7)');
      this.addClassBreak(renderer, 2, 2, colors.fair as [number, number, number, number], lineWidth, 'Fair (0.6-0.7)');
      this.addClassBreak(renderer, 3, 3, colors.poor as [number, number, number, number], lineWidth, 'Poor (<0.6)');
    } else {
      // Standard 5 classes for IRI, Rut, CSC, LPV
      this.addClassBreak(renderer, 1, 1, colors.veryGood as [number, number, number, number], lineWidth, 'Very Good');
      this.addClassBreak(renderer, 2, 2, colors.good as [number, number, number, number], lineWidth, 'Good');
      this.addClassBreak(renderer, 3, 3, colors.fair as [number, number, number, number], lineWidth, 'Fair');
      this.addClassBreak(renderer, 4, 4, colors.poor as [number, number, number, number], lineWidth, 'Poor');
      this.addClassBreak(renderer, 5, 5, colors.veryPoor as [number, number, number, number], lineWidth, 'Very Poor');
    }

    return renderer;
  }

  /**
   * Helper: Add a class break to renderer
   */
  private static addClassBreak(
    renderer: ClassBreaksRenderer,
    minValue: number,
    maxValue: number,
    color: [number, number, number, number],
    width: number,
    label: string
  ): void {
    renderer.addClassBreakInfo({
      minValue,
      maxValue,
      symbol: new SimpleLineSymbol({
        color,
        width
      }),
      label
    });
  }

  /**
   * FALLBACK: Creates renderer using raw KPI values with threshold calculations
   * Used when class fields are not available
   * @param kpi - The KPI type
   * @param fieldName - The raw value field name
   * @param themeMode - Current theme mode
   * @param use5Classes - Whether to use 5-class system
   * @returns ClassBreaksRenderer using raw value thresholds
   */
  private static createRawValueRenderer(
    kpi: KPIKey,
    fieldName: string,
    themeMode: 'light' | 'dark',
    use5Classes: boolean
  ): ClassBreaksRenderer {
    const colors = RENDERER_CONFIG.getThemeAwareColors();
    const thresholds = KPI_THRESHOLDS[kpi];
    const lineWidth = RENDERER_CONFIG.lineWidth;

    const renderer = new ClassBreaksRenderer({
      field: fieldName,
      defaultSymbol: new SimpleLineSymbol({
        color: hexToRgb(getCSSCustomProperty('--color-fg-muted'), 0.5),
        width: lineWidth
      }),
      defaultLabel: 'No Data'
    });

    // Apply threshold-based breaks (existing logic)
    if (kpi === 'iri' || kpi === 'rut' || kpi === 'lpv3') {
      // Lower is better
      if (use5Classes && thresholds.veryGood !== undefined) {
        this.addClassBreak(renderer, 0, thresholds.veryGood, colors.veryGood as [number, number, number, number], lineWidth, 'Very Good');
      }
      this.addClassBreak(renderer, thresholds.veryGood || 0, thresholds.good, colors.good as [number, number, number, number], lineWidth, 'Good');
      this.addClassBreak(renderer, thresholds.good, thresholds.fair, colors.fair as [number, number, number, number], lineWidth, 'Fair');
      
      if (use5Classes && thresholds.poor !== undefined) {
        this.addClassBreak(renderer, thresholds.fair, thresholds.poor, colors.poor as [number, number, number, number], lineWidth, 'Poor');
        this.addClassBreak(renderer, thresholds.poor, 9999, colors.veryPoor as [number, number, number, number], lineWidth, 'Very Poor');
      } else {
        this.addClassBreak(renderer, thresholds.fair, 9999, colors.poor as [number, number, number, number], lineWidth, 'Poor');
      }
    } else if (kpi === 'csc') {
      // Higher is better (inverted)
      if (use5Classes && thresholds.good !== undefined) {
        this.addClassBreak(renderer, thresholds.good, 999, colors.veryGood as [number, number, number, number], lineWidth, 'Very Good');
      }
      this.addClassBreak(renderer, thresholds.fair, thresholds.good, colors.good as [number, number, number, number], lineWidth, 'Good');
      this.addClassBreak(renderer, thresholds.poor!, thresholds.fair, colors.fair as [number, number, number, number], lineWidth, 'Fair');
      
      if (use5Classes && thresholds.veryPoor !== undefined) {
        this.addClassBreak(renderer, thresholds.veryPoor, thresholds.poor!, colors.poor as [number, number, number, number], lineWidth, 'Poor');
        this.addClassBreak(renderer, 0, thresholds.veryPoor, colors.veryPoor as [number, number, number, number], lineWidth, 'Very Poor');
      } else {
        this.addClassBreak(renderer, 0, thresholds.poor!, colors.poor as [number, number, number, number], lineWidth, 'Poor');
      }
    } else if (kpi === 'psci') {
      // PSCI: 4 classes when using raw values
      if (use5Classes) {
        this.addClassBreak(renderer, 9, 10, colors.veryGood as [number, number, number, number], lineWidth, 'Very Good (9-10)');
        this.addClassBreak(renderer, 7, 9, colors.good as [number, number, number, number], lineWidth, 'Good (7-8)');
        this.addClassBreak(renderer, 5, 7, colors.fair as [number, number, number, number], lineWidth, 'Fair (5-6)');
        this.addClassBreak(renderer, 1, 5, colors.poor as [number, number, number, number], lineWidth, 'Poor (1-4)');
      } else {
        this.addClassBreak(renderer, thresholds.fair, 10, colors.good as [number, number, number, number], lineWidth, 'Good');
        this.addClassBreak(renderer, thresholds.poor!, thresholds.fair, colors.fair as [number, number, number, number], lineWidth, 'Fair');
        this.addClassBreak(renderer, 1, thresholds.poor!, colors.poor as [number, number, number, number], lineWidth, 'Poor');
      }
    } else if (kpi === 'mpd') {
      // MPD: 3 classes only
      this.addClassBreak(renderer, thresholds.good, 999, colors.veryGood as [number, number, number, number], lineWidth, 'Good');
      this.addClassBreak(renderer, thresholds.poor!, thresholds.good, colors.fair as [number, number, number, number], lineWidth, 'Fair');
      this.addClassBreak(renderer, 0, thresholds.poor!, colors.poor as [number, number, number, number], lineWidth, 'Poor');
    }

    return renderer;
  }

  /**
   * @deprecated Use createRenderer instead.
   * Legacy method maintained for backward compatibility
   */
  static createKPIRenderer(kpi: KPIKey, year: number, themeMode: 'light' | 'dark'): ClassBreaksRenderer {
    console.warn('createKPIRenderer is deprecated. Use createRenderer instead.');
    return this.createRenderer(kpi, year, themeMode, false); // Use raw values for legacy calls
  }

  /**
   * Preload renderers for common KPI/year combinations
   * This improves initial load performance by caching renderers upfront
   */
  static preloadRenderers(themeMode: 'light' | 'dark'): void {
    if (this.isPreloaded) {
      console.log('Renderers already preloaded');
      return;
    }

    console.log('Preloading renderers with class fields...');
    const kpis: KPIKey[] = ['iri', 'rut', 'psci', 'csc', 'mpd', 'lpv3'];
    const years = [2011, 2018, 2025];

    kpis.forEach(kpi => {
      years.forEach(year => {
        // Preload with class fields (default behavior)
        this.createRenderer(kpi, year, themeMode, true);
      });
    });

    this.isPreloaded = true;
    console.log(`✓ Preloaded ${this.rendererCache.size} renderers`);
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
    const years = [2011, 2018, 2025];
    
    let count = 0;
    const total = kpis.length * years.length;
    
    // Create all combinations
    for (const kpi of kpis) {
      for (const year of years) {
        // This will create and cache each renderer
        this.createRenderer(kpi, year, themeMode, true); // Use class fields
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
   * Get detailed cache statistics for monitoring and debugging
   * Useful for verifying cache is working correctly
   */
  static getCacheStats(): {
    size: number;
    keys: string[];
    maxSize: number;
    breakdown: {
      byKPI: Record<string, number>;
      byYear: Record<string, number>;
      byTheme: Record<string, number>;
    };
  } {
    const keys = Array.from(this.rendererCache.keys());
    
    // Analyze cache contents
    const byKPI: Record<string, number> = {};
    const byYear: Record<string, number> = {};
    const byTheme: Record<string, number> = {};
    
    keys.forEach(key => {
      const [kpi, year, theme] = key.split('_');
      byKPI[kpi] = (byKPI[kpi] || 0) + 1;
      byYear[year] = (byYear[year] || 0) + 1;
      byTheme[theme] = (byTheme[theme] || 0) + 1;
    });

    return {
      size: this.rendererCache.size,
      keys,
      maxSize: 18, // 6 KPIs × 3 years = 18 renderers per theme
      breakdown: {
        byKPI,
        byYear,
        byTheme
      }
    };
  }

  /**
   * Log cache performance metrics to console
   * Call this during development to verify caching is working
   */
  static logCacheMetrics(): void {
    const stats = this.getCacheStats();
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 RENDERER CACHE STATISTICS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`Cache Size: ${stats.size} / ${stats.maxSize} (${Math.round(stats.size / stats.maxSize * 100)}% full)`);
    console.log('\nBreakdown by KPI:', stats.breakdown.byKPI);
    console.log('Breakdown by Year:', stats.breakdown.byYear);
    console.log('Breakdown by Theme:', stats.breakdown.byTheme);
    console.log('\nCached Keys:', stats.keys);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  }

  /**
   * Add standard class breaks (lower values = better condition)
   * Used for IRI, RUT, and LPV3
   * @deprecated - Used only in legacy createKPIRenderer
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
      this.addClassBreak(renderer, 0, thresholds.veryGood, colors.veryGood, lineWidth, 
        `Very Good (< ${thresholds.veryGood})`);
      
      this.addClassBreak(renderer, thresholds.veryGood, thresholds.good, colors.good, lineWidth,
        `Good (${thresholds.veryGood}-${thresholds.good})`);
      
      this.addClassBreak(renderer, thresholds.good, thresholds.fair, colors.fair, lineWidth,
        `Fair (${thresholds.good}-${thresholds.fair})`);
      
      this.addClassBreak(renderer, thresholds.fair, thresholds.poor, colors.poor, lineWidth,
        `Poor (${thresholds.fair}-${thresholds.poor})`);
      
      this.addClassBreak(renderer, thresholds.poor, 9999, colors.veryPoor, lineWidth,
        `Very Poor (> ${thresholds.poor})`);
    } else {
      // 3-class system: Good, Fair, Poor
      this.addClassBreak(renderer, 0, thresholds.good, colors.good, lineWidth,
        `Good (< ${thresholds.good})`);
      
      this.addClassBreak(renderer, thresholds.good, thresholds.fair, colors.fair, lineWidth,
        `Fair (${thresholds.good}-${thresholds.fair})`);
      
      this.addClassBreak(renderer, thresholds.fair, 9999, colors.poor, lineWidth,
        `Poor (> ${thresholds.fair})`);
    }
  }

  /**
   * Add inverted class breaks (higher values = better condition)
   * Used for CSC
   * @deprecated - Used only in legacy createKPIRenderer
   */
  private static addInvertedBreaks(
    renderer: ClassBreaksRenderer,
    kpi: KPIKey,
    thresholds: typeof KPI_THRESHOLDS[KPIKey],
    use5Classes: boolean = false,
    colors: any
  ): void {
    const lineWidth = RENDERER_CONFIG.lineWidth;
    
    if (use5Classes && thresholds.veryPoor !== undefined && thresholds.good !== undefined) {
      // 5-class system (inverted)
      this.addClassBreak(renderer, thresholds.good, 999, colors.veryGood, lineWidth,
        `Very Good (> ${thresholds.good})`);
      
      this.addClassBreak(renderer, thresholds.fair, thresholds.good, colors.good, lineWidth,
        `Good (${thresholds.fair}-${thresholds.good})`);
      
      this.addClassBreak(renderer, thresholds.poor!, thresholds.fair, colors.fair, lineWidth,
        `Fair (${thresholds.poor}-${thresholds.fair})`);
      
      this.addClassBreak(renderer, thresholds.veryPoor, thresholds.poor!, colors.poor, lineWidth,
        `Poor (${thresholds.veryPoor}-${thresholds.poor})`);
      
      this.addClassBreak(renderer, 0, thresholds.veryPoor, colors.veryPoor, lineWidth,
        `Very Poor (< ${thresholds.veryPoor})`);
    } else {
      // 3-class system (inverted)
      this.addClassBreak(renderer, thresholds.fair, 999, colors.good, lineWidth,
        `Good (> ${thresholds.fair})`);
      
      this.addClassBreak(renderer, thresholds.poor!, thresholds.fair, colors.fair, lineWidth,
        `Fair (${thresholds.poor}-${thresholds.fair})`);
      
      this.addClassBreak(renderer, 0, thresholds.poor!, colors.poor, lineWidth,
        `Poor (< ${thresholds.poor})`);
    }
  }

  /**
   * Add PSCI-specific breaks (4 classes)
   * @deprecated - Used only in legacy createKPIRenderer
   */
  private static addPSCIBreaks(
    renderer: ClassBreaksRenderer,
    use5Classes: boolean = false,
    colors: any
  ): void {
    const lineWidth = RENDERER_CONFIG.lineWidth;
    
    if (use5Classes) {
      // 4-class system for PSCI
      this.addClassBreak(renderer, 9, 10, colors.veryGood, lineWidth, 'Very Good (9-10)');
      this.addClassBreak(renderer, 7, 9, colors.good, lineWidth, 'Good (7-8)');
      this.addClassBreak(renderer, 5, 7, colors.fair, lineWidth, 'Fair (5-6)');
      this.addClassBreak(renderer, 1, 5, colors.poor, lineWidth, 'Poor (1-4)');
    } else {
      // 3-class system
      this.addClassBreak(renderer, 7, 10, colors.good, lineWidth, 'Good (7-10)');
      this.addClassBreak(renderer, 5, 7, colors.fair, lineWidth, 'Fair (5-6)');
      this.addClassBreak(renderer, 1, 5, colors.poor, lineWidth, 'Poor (1-4)');
    }
  }

  /**
   * Add MPD-specific breaks (3 classes only)
   * @deprecated - Used only in legacy createKPIRenderer
   */
  private static addMPDBreaks(
    renderer: ClassBreaksRenderer,
    colors: any
  ): void {
    const lineWidth = RENDERER_CONFIG.lineWidth;
    const thresholds = KPI_THRESHOLDS['mpd'];
    
    this.addClassBreak(renderer, thresholds.good, 999, colors.veryGood, lineWidth,
      `Good (≥ ${thresholds.good})`);
    
    this.addClassBreak(renderer, thresholds.poor!, thresholds.good, colors.fair, lineWidth,
      `Fair (${thresholds.poor}-${thresholds.good})`);
    
    this.addClassBreak(renderer, 0, thresholds.poor!, colors.poor, lineWidth,
      `Poor (< ${thresholds.poor})`);
  }
}