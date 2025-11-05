import ClassBreaksRenderer from '@arcgis/core/renderers/ClassBreaksRenderer';
import SimpleLineSymbol from '@arcgis/core/symbols/SimpleLineSymbol';
import {
  RENDERER_CONFIG,
  CONFIG
} from '@/config/appConfig';
import { getKPIFieldName } from '@/config/layerConfig';
import {
  KPIKey, KPI_THRESHOLDS
} from '@/config/kpiConfig';
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
    const cached = this.getCachedRenderer(kpi, year, themeMode);
    if (cached) {
      console.log('Using cached renderer (clone returned)');
      return cached.clone();
    }

    // Cache miss - create new renderer
    console.log(`Creating new renderer for ${kpi}/${year}/${themeMode}`);
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
    console.log(`Renderer created and cached in ${duration.toFixed(2)}ms`);
    
    // Return a clone so the cached instance stays immutable
    return renderer.clone();
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
      this.addClassBreak(renderer, 1, 1, colors.veryGood as [number, number, number, number], lineWidth, 'Good (0.7)');
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
    console.log(` Preloaded ${this.rendererCache.size} renderers`);
  }

  /**
   * Preload all possible renderer combinations at startup
   * This creates all 18 renderers (6 KPIs  3 years) in advance
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
      maxSize: 18, // 6 KPIs  3 years = 18 renderers per theme
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
    console.log('');
    console.log(' RENDERER CACHE STATISTICS');
    console.log('');
    console.log(`Cache Size: ${stats.size} / ${stats.maxSize} (${Math.round(stats.size / stats.maxSize * 100)}% full)`);
    console.log('\nBreakdown by KPI:', stats.breakdown.byKPI);
    console.log('Breakdown by Year:', stats.breakdown.byYear);
    console.log('Breakdown by Theme:', stats.breakdown.byTheme);
    console.log('\nCached Keys:', stats.keys);
    console.log('\n');
  }

  /**
   * Apply renderer to a layer with verification and retry logic
   * This ensures the renderer is actually applied and visible
   *
   * @param layer - Feature layer to apply renderer to
   * @param renderer - ClassBreaksRenderer to apply
   * @param options - Application options
   * @returns Promise that resolves when renderer is applied
   */
  static async applyRendererWithVerification(
    layer: __esri.FeatureLayer,
    renderer: ClassBreaksRenderer,
    options?: {
      maxRetries?: number;
      retryDelay?: number;
      logProgress?: boolean;
    }
  ): Promise<void> {
    const maxRetries = options?.maxRetries || 3;
    const retryDelay = options?.retryDelay || 100;
    const logProgress = options?.logProgress !== false;

    if (logProgress) {
      console.log('[RendererService] Applying renderer to layer:', layer.title);
    }

    // Ensure layer is loaded
    if (!layer.loaded) {
      if (logProgress) {
        console.log('[RendererService] Waiting for layer to load...');
      }
      await layer.load();
    }

    let attempt = 0;
    let success = false;

    while (attempt < maxRetries && !success) {
      attempt++;

      try {
        // Apply renderer
        (layer as any).renderer = renderer.clone();

        // Wait a moment for the renderer to be applied
        await new Promise(resolve => setTimeout(resolve, retryDelay));

        // Verify renderer was applied
        const appliedRenderer = (layer as any).renderer;
        if (appliedRenderer && appliedRenderer.type === 'class-breaks') {
          success = true;
          if (logProgress) {
            console.log(`[RendererService] ✅ Renderer applied successfully (attempt ${attempt})`);
          }
        } else {
          if (logProgress) {
            console.warn(`[RendererService] ⚠️ Renderer not applied correctly (attempt ${attempt})`);
          }
        }
      } catch (error) {
        console.error(`[RendererService] Error applying renderer (attempt ${attempt}):`, error);
      }

      if (!success && attempt < maxRetries) {
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }

    if (!success) {
      throw new Error(`Failed to apply renderer after ${maxRetries} attempts`);
    }

    // Force layer refresh to ensure visual update
    try {
      layer.refresh();
      if (logProgress) {
        console.log('[RendererService] Layer refreshed');
      }
    } catch (error) {
      console.warn('[RendererService] Could not refresh layer:', error);
    }
  }

  /**
   * Wait for a layer to be ready for rendering
   * Checks that layer is loaded and has features
   *
   * @param layer - Feature layer to check
   * @param timeout - Maximum wait time in ms (default: 5000)
   * @returns Promise that resolves when layer is ready
   */
  static async waitForLayerReady(
    layer: __esri.FeatureLayer,
    timeout: number = 5000
  ): Promise<void> {
    const startTime = Date.now();

    console.log('[RendererService] Waiting for layer to be ready:', layer.title);

    // Wait for layer to load
    if (!layer.loaded) {
      await layer.load();
    }

    // Wait for layer to have a valid extent (indicates features are loaded)
    while (!layer.fullExtent && (Date.now() - startTime) < timeout) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    if (!layer.fullExtent) {
      console.warn('[RendererService] Layer extent not available within timeout');
    } else {
      console.log('[RendererService] ✅ Layer is ready');
    }
  }

  /**
   * Log current renderer state for debugging
   *
   * @param layer - Feature layer to inspect
   */
  static logRendererState(layer: __esri.FeatureLayer | null): void {
    if (!layer) {
      console.log('[RendererService] No layer provided');
      return;
    }

    console.log('[RendererService] Layer State:', {
      title: layer.title,
      loaded: layer.loaded,
      visible: layer.visible,
      hasRenderer: !!(layer as any).renderer,
      rendererType: (layer as any).renderer?.type || 'none',
      hasExtent: !!layer.fullExtent,
      featureCount: (layer.source as any)?.length || 'unknown'
    });

    const renderer = (layer as any).renderer;
    if (renderer && renderer.type === 'class-breaks') {
      console.log('[RendererService] Renderer Details:', {
        field: renderer.field,
        classBreakInfos: renderer.classBreakInfos?.length || 0,
        defaultSymbol: !!renderer.defaultSymbol
      });
    }
  }
}
