// src/services/LayerService.ts
// PHASE 2: Layer Loading Service with Direct URL and Hybrid Strategies

import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import WebMap from '@arcgis/core/WebMap';
import { FEATURE_LAYER_URLS, LAYER_LOADING_CONFIG, CONFIG } from '@/config/appConfig';

/**
 * Layer loading strategy types
 */
export type LayerStrategy = 'direct' | 'webmap';

/**
 * Result of a layer loading operation
 */
export interface LayerLoadResult {
  roadLayer: FeatureLayer | null;
  roadLayerSwipe: FeatureLayer | null;
  laLayer: FeatureLayer | null;
  strategy: LayerStrategy;
  loadTimeMs: number;
  errors: string[];
  fallbackUsed: boolean;
}

/**
 * Performance metrics for layer loading
 */
interface LoadMetrics {
  strategyUsed: LayerStrategy;
  startTime: number;
  endTime: number;
  duration: number;
  success: boolean;
  fallbackUsed: boolean;
  errors: string[];
}

/**
 * LayerService provides two strategies for loading ArcGIS Feature Layers.
 *
 * Two loading strategies are supported:
 * 1. **Direct**: Load layers directly from Feature Service URLs (fastest)
 * 2. **WebMap**: Load layers from WebMap configuration (legacy, slower)
 *
 * @example
 * ```typescript
 * // Direct loading (recommended for reports)
 * const result = await LayerService.loadLayers('direct');
 * if (result.roadLayer) {
 *   console.log(`Loaded in ${result.loadTimeMs}ms using ${result.strategy}`);
 * }
 *
 * // WebMap loading (recommended for map views)
 * const result = await LayerService.loadLayers('webmap');
 * ```
 */
export default class LayerService {
  private static metrics: LoadMetrics[] = [];
  private static readonly MAX_METRICS = 50; // Keep last 50 load operations

  /**
   * Main entry point for loading layers with specified strategy
   *
   * @param strategy - Loading strategy to use ('direct' or 'webmap')
   * @param options - Optional configuration
   * @returns Promise resolving to LayerLoadResult
   */
  static async loadLayers(
    strategy: LayerStrategy = 'direct',
    options: {
      timeout?: number;
      enableLogging?: boolean;
    } = {}
  ): Promise<LayerLoadResult> {
    const {
      timeout = 10000,
      enableLogging = true
    } = options;

    const startTime = performance.now();

    try {
      let result: LayerLoadResult;

      switch (strategy) {
        case 'direct':
          result = await this.loadLayersDirect(timeout);
          break;

        case 'webmap':
          result = await this.loadLayersFromWebMap();
          break;

        default:
          throw new Error(`Unknown layer strategy: ${strategy}`);
      }

      const endTime = performance.now();
      result.loadTimeMs = Math.round(endTime - startTime);
      
      // Record metrics
      this.recordMetrics({
        strategyUsed: result.strategy,
        startTime,
        endTime,
        duration: result.loadTimeMs,
        success: !!(result.roadLayer && result.laLayer),
        fallbackUsed: result.fallbackUsed,
        errors: result.errors
      });

      // Log performance if enabled
      if (enableLogging) {
        this.logLoadResult(result);
      }

      return result;

    } catch (error: any) {
      const endTime = performance.now();
      const loadTimeMs = Math.round(endTime - startTime);

      // Record failure metrics
      this.recordMetrics({
        strategyUsed: strategy,
        startTime,
        endTime,
        duration: loadTimeMs,
        success: false,
        fallbackUsed: false,
        errors: [error.message]
      });

      if (enableLogging) {
        console.error('[LayerService] Layer loading failed:', error);
      }

      // Return empty result with error info
      return {
        roadLayer: null,
        roadLayerSwipe: null,
        laLayer: null,
        strategy,
        loadTimeMs,
        errors: [error.message],
        fallbackUsed: false
      };
    }
  }

  /**
   * Load layers directly from Feature Service URLs
   * This is the fastest method but requires valid URLs in configuration
   * 
   * @param timeout - Maximum time to wait for loading (milliseconds)
   * @returns Promise resolving to LayerLoadResult
   */
  static async loadLayersDirect(timeout: number = 5000): Promise<LayerLoadResult> {
    const startTime = performance.now();
    const errors: string[] = [];

    try {
      // Validate URLs are configured
      if (FEATURE_LAYER_URLS.roadNetwork.url.includes('PLACEHOLDER')) {
        throw new Error('Direct loading requires valid Feature Layer URLs. Please update FEATURE_LAYER_URLS in appConfig.ts');
      }

      console.log('[LayerService] Loading layers directly from URLs...');

      // Create timeout promise
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error(`Direct loading timeout after ${timeout}ms`)), timeout);
      });

      // Load all layers in parallel with timeout
      const loadPromise = Promise.all([
        this.createLayerFromURL(
          FEATURE_LAYER_URLS.roadNetwork.url,
          FEATURE_LAYER_URLS.roadNetwork.title
        ),
        this.createLayerFromURL(
          FEATURE_LAYER_URLS.roadNetworkSwipe.url,
          FEATURE_LAYER_URLS.roadNetworkSwipe.title
        ),
        this.createLayerFromURL(
          FEATURE_LAYER_URLS.laPolygon.url,
          FEATURE_LAYER_URLS.laPolygon.title
        )
      ]);

      const [roadLayer, roadLayerSwipe, laLayer] = await Promise.race([
        loadPromise,
        timeoutPromise
      ]);

      const loadTimeMs = Math.round(performance.now() - startTime);

      console.log(`[LayerService] Direct loading completed in ${loadTimeMs}ms`);

      // Validate layers
      if (!roadLayer) {
        errors.push('Road network layer failed to load');
      }
      if (!laLayer) {
        errors.push('LA polygon layer failed to load');
      }

      return {
        roadLayer,
        roadLayerSwipe,
        laLayer,
        strategy: 'direct',
        loadTimeMs,
        errors,
        fallbackUsed: false
      };

    } catch (error: any) {
      const loadTimeMs = Math.round(performance.now() - startTime);
      console.error('[LayerService] Direct loading failed:', error);
      
      throw new Error(`Direct loading failed: ${error.message}`);
    }
  }

  /**
   * Create a FeatureLayer from a URL
   * 
   * @param url - Feature Service URL
   * @param title - Layer title for identification
   * @returns Promise resolving to FeatureLayer
   */
  private static async createLayerFromURL(
    url: string,
    title: string
  ): Promise<FeatureLayer> {
    try {
      console.log(`[LayerService] Creating layer from URL: ${title}`);
      
      const layer = new FeatureLayer({
        url,
        title,
        outFields: ['*'], // Load all fields
      });

      // Wait for layer to load
      await layer.load();

      console.log(`[LayerService] Layer loaded successfully: ${title} (${layer.fields.length} fields)`);

      return layer;

    } catch (error: any) {
      console.error(`[LayerService] Failed to create layer from URL: ${title}`, error);
      throw new Error(`Failed to load layer "${title}" from ${url}: ${error.message}`);
    }
  }

  /**
   * Load layers from WebMap configuration (legacy method)
   * This is slower but more compatible with existing WebMap-based workflows
   * 
   * @returns Promise resolving to LayerLoadResult
   */
  static async loadLayersFromWebMap(): Promise<LayerLoadResult> {
    const startTime = performance.now();
    const errors: string[] = [];

    try {
      console.log('[LayerService] Loading layers from WebMap...');

      // Load the WebMap
      const webmap = new WebMap({
        portalItem: {
          id: CONFIG.webMapId
        }
      });

      await webmap.load();

      // Find layers by title
      const roadLayer = webmap.allLayers.find(
        (l: any) => l.title === CONFIG.roadNetworkLayerTitle
      ) as FeatureLayer | undefined;

      const roadLayerSwipe = webmap.allLayers.find(
        (l: any) => l.title === CONFIG.roadNetworkLayerSwipeTitle
      ) as FeatureLayer | undefined;

      const laLayer = webmap.allLayers.find(
        (l: any) => l.title === CONFIG.laPolygonLayerTitle
      ) as FeatureLayer | undefined;

      const loadTimeMs = Math.round(performance.now() - startTime);

      console.log(`[LayerService] WebMap loading completed in ${loadTimeMs}ms`);

      // Validate layers
      if (!roadLayer) {
        errors.push(`Road network layer "${CONFIG.roadNetworkLayerTitle}" not found in WebMap`);
      }
      if (!laLayer) {
        errors.push(`LA polygon layer "${CONFIG.laPolygonLayerTitle}" not found in WebMap`);
      }

      return {
        roadLayer: roadLayer || null,
        roadLayerSwipe: roadLayerSwipe || null,
        laLayer: laLayer || null,
        strategy: 'webmap',
        loadTimeMs,
        errors,
        fallbackUsed: false
      };

    } catch (error: any) {
      const loadTimeMs = Math.round(performance.now() - startTime);
      console.error('[LayerService] WebMap loading failed:', error);
      
      throw new Error(`WebMap loading failed: ${error.message}`);
    }
  }

  /**
   * Get the layer loading strategy from URL parameters or use default
   * Supports: ?layerStrategy=direct|webmap
   *
   * @returns Layer strategy to use
   */
  static getStrategyFromURL(): LayerStrategy {
    const params = new URLSearchParams(window.location.search);
    const strategy = params.get('layerStrategy') as LayerStrategy | null;

    if (strategy && ['direct', 'webmap'].includes(strategy)) {
      console.log(`[LayerService] Using strategy from URL: ${strategy}`);
      return strategy;
    }

    return 'direct'; // Default to direct loading
  }

  /**
   * Record performance metrics for analysis
   * 
   * @param metrics - Metrics to record
   */
  private static recordMetrics(metrics: LoadMetrics): void {
    this.metrics.push(metrics);

    // Keep only the most recent metrics
    if (this.metrics.length > this.MAX_METRICS) {
      this.metrics.shift();
    }
  }

  /**
   * Get performance metrics for all layer loading operations
   * Useful for debugging and optimization
   * 
   * @returns Array of load metrics
   */
  static getMetrics(): LoadMetrics[] {
    return [...this.metrics];
  }

  /**
   * Get average load times by strategy
   * 
   * @returns Object with average times per strategy
   */
  static getAverageLoadTimes(): Record<LayerStrategy, number> {
    const averages = {
      direct: 0,
      webmap: 0,
      hybrid: 0
    };

    const counts = {
      direct: 0,
      webmap: 0,
      hybrid: 0
    };

    this.metrics.forEach(metric => {
      if (metric.success) {
        averages[metric.strategyUsed] += metric.duration;
        counts[metric.strategyUsed]++;
      }
    });

    return {
      direct: counts.direct > 0 ? Math.round(averages.direct / counts.direct) : 0,
      webmap: counts.webmap > 0 ? Math.round(averages.webmap / counts.webmap) : 0
    };
  }

  /**
   * Get success rate by strategy
   * 
   * @returns Object with success rates (0-100) per strategy
   */
  static getSuccessRates(): Record<LayerStrategy, number> {
    const successes = {
      direct: 0,
      webmap: 0
    };

    const totals = {
      direct: 0,
      webmap: 0
    };

    this.metrics.forEach(metric => {
      totals[metric.strategyUsed]++;
      if (metric.success) {
        successes[metric.strategyUsed]++;
      }
    });

    return {
      direct: totals.direct > 0 ? Math.round((successes.direct / totals.direct) * 100) : 0,
      webmap: totals.webmap > 0 ? Math.round((successes.webmap / totals.webmap) * 100) : 0
    };
  }

  /**
   * Log layer load result for debugging
   * 
   * @param result - Load result to log
   */
  private static logLoadResult(result: LayerLoadResult): void {
    const emoji = result.roadLayer && result.laLayer ? '✅' : '❌';
    const fallbackNote = result.fallbackUsed ? ' (fallback used)' : '';
    
    console.log(`${emoji} [LayerService] Strategy: ${result.strategy}${fallbackNote}`);
    console.log(`⏱️  [LayerService] Load time: ${result.loadTimeMs}ms`);
    console.log(`🗺️  [LayerService] Layers loaded:`);
    console.log(`   - Road Network: ${result.roadLayer ? '✅' : '❌'}`);
    console.log(`   - Road Network Swipe: ${result.roadLayerSwipe ? '✅' : '❌'}`);
    console.log(`   - LA Polygons: ${result.laLayer ? '✅' : '❌'}`);

    if (result.errors.length > 0) {
      console.warn(`⚠️  [LayerService] Errors:`, result.errors);
    }
  }

  /**
   * Clear all recorded metrics
   * Useful for testing or resetting performance tracking
   */
  static clearMetrics(): void {
    this.metrics = [];
    console.log('[LayerService] Metrics cleared');
  }

  /**
   * Print a performance summary to the console
   * Shows average load times, success rates, and fallback usage
   */
  static printPerformanceSummary(): void {
    if (this.metrics.length === 0) {
      console.log('[LayerService] No metrics available');
      return;
    }

    const avgTimes = this.getAverageLoadTimes();
    const successRates = this.getSuccessRates();
    const fallbackCount = this.metrics.filter(m => m.fallbackUsed).length;

    console.log('\n=== LayerService Performance Summary ===');
    console.log(`Total loads: ${this.metrics.length}`);
    console.log('\nAverage Load Times:');
    console.log(`  Direct:  ${avgTimes.direct}ms`);
    console.log(`  WebMap:  ${avgTimes.webmap}ms`);
    console.log('\nSuccess Rates:');
    console.log(`  Direct:  ${successRates.direct}%`);
    console.log(`  WebMap:  ${successRates.webmap}%`);
    console.log(`\nFallbacks used: ${fallbackCount}/${this.metrics.length}`);
    console.log('========================================\n');
  }
}
