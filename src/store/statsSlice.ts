// src/store/slices/statsSlice.ts
/**
 * ============================================================================
 * RMO Analytics Hub - Statistics Slice
 * ============================================================================
 * 
 * Manages statistics computation, caching, and performance tracking.
 * 
 * Responsibilities:
 * - Summary statistics calculation
 * - Chart-filtered statistics
 * - Statistics caching for performance
 * - Calculation state tracking
 * - Performance metrics monitoring
 * 
 * @module store/slices/statsSlice
 */

import type { StateCreator } from 'zustand';
import { message } from 'antd';
import StatisticsService from '@/services/StatisticsService';
import type { KPIKey } from '@/config/kpiConfig';
import type { FilterState } from '@/types';
import type { ChartSelection } from './chartSlice';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Summary statistics for road network segments
 * Contains aggregated metrics for a given KPI and filter combination
 */
export interface SummaryStatistics {
  /** KPI identifier (uppercase, e.g., 'IRI') */
  kpi: string;
  
  /** Survey year */
  year: number;
  
  /** Total number of segments */
  totalSegments: number;
  
  /** Total length in kilometers */
  totalLengthKm: number;
  
  /** Count of segments in each condition class */
  veryGoodCount: number;
  goodCount: number;
  fairCount: number;
  poorCount: number;
  veryPoorCount: number;
  
  /** Percentage of segments in each condition class */
  veryGoodPct: number;
  goodPct: number;
  fairPct: number;
  poorPct: number;
  veryPoorPct: number;
  
  /** Percentage of segments that are fair or better */
  fairOrBetterPct: number;
  
  /** Statistical values */
  avgValue: number;
  minValue: number;
  maxValue: number;
  
  /** Timestamp of last update */
  lastUpdated: string;
}

/**
 * Statistics cache entry
 */
interface StatsCacheEntry {
  stats: SummaryStatistics;
  timestamp: number;
  filters: FilterState;
  kpi: KPIKey;
}

/**
 * Performance metrics for statistics calculation
 */
interface StatsPerformanceMetrics {
  /** Last calculation duration in milliseconds */
  lastCalculationDuration: number;
  
  /** Average calculation duration */
  averageCalculationDuration: number;
  
  /** Total number of calculations performed */
  totalCalculations: number;
  
  /** Cache hit count */
  cacheHits: number;
  
  /** Cache miss count */
  cacheMisses: number;
  
  /** Cache hit rate percentage */
  cacheHitRate: number;
}

// ============================================================================
// STATE INTERFACE
// ============================================================================

export interface StatsSlice {
  // ============================================================================
  // Statistics State
  // ============================================================================
  
  /** Current summary statistics (main view) */
  currentStats: SummaryStatistics | null;
  
  /** Chart-filtered statistics (when chart filtering is active) */
  chartFilteredStats: SummaryStatistics | null;
  
  /** Loading state for main statistics calculation */
  isCalculatingStats: boolean;
  
  /** Loading state for chart-filtered statistics */
  isCalculatingChartStats: boolean;
  
  /** Error message if statistics calculation failed */
  statsError: string | null;
  
  // ============================================================================
  // Cache State
  // ============================================================================
  
  /** Statistics cache for performance optimization */
  statsCache: Map<string, StatsCacheEntry>;
  
  /** Maximum cache size (number of entries) */
  statsCacheMaxSize: number;
  
  /** Cache entry TTL (time to live) in milliseconds */
  statsCacheTTL: number;
  
  // ============================================================================
  // Performance Tracking
  // ============================================================================
  
  /** Performance metrics for monitoring */
  statsPerformanceMetrics: StatsPerformanceMetrics;
  
  // ============================================================================
  // Actions - Statistics Calculation
  // ============================================================================
  
  /**
   * Calculate summary statistics for current filters and KPI
   * Uses cache when possible for performance
   */
  calculateStatistics: () => Promise<void>;
  
  /**
   * Calculate statistics for chart-filtered selections
   * Combines multiple chart selections into aggregated stats
   */
  calculateChartFilteredStatistics: () => Promise<void>;
  
  /**
   * Force recalculation of statistics (bypass cache)
   * Useful after data updates or for debugging
   */
  forceRecalculateStatistics: () => Promise<void>;
  
  /**
   * Set statistics loading state
   * @param loading - Whether statistics are being calculated
   */
  setCalculatingStats: (loading: boolean) => void;
  
  /**
   * Set chart statistics loading state
   * @param loading - Whether chart statistics are being calculated
   */
  setCalculatingChartStats: (loading: boolean) => void;
  
  /**
   * Set statistics error message
   * @param error - Error message or null to clear
   */
  setStatsError: (error: string | null) => void;
  
  // ============================================================================
  // Actions - Cache Management
  // ============================================================================
  
  /**
   * Get statistics from cache if available and valid
   * @param kpi - KPI key
   * @param filters - Current filter state
   * @returns Cached statistics or null if not found/expired
   */
  getCachedStats: (kpi: KPIKey, filters: FilterState) => SummaryStatistics | null;
  
  /**
   * Store statistics in cache
   * @param kpi - KPI key
   * @param filters - Filter state
   * @param stats - Statistics to cache
   */
  setCachedStats: (kpi: KPIKey, filters: FilterState, stats: SummaryStatistics) => void;
  
  /**
   * Generate cache key for statistics
   * @param kpi - KPI key
   * @param filters - Filter state
   * @returns Cache key string
   */
  getStatsCacheKey: (kpi: KPIKey, filters: FilterState) => string;
  
  /**
   * Clear all cached statistics
   * Useful when underlying data changes
   */
  clearStatsCache: () => void;
  
  /**
   * Remove expired entries from cache
   */
  pruneStatsCache: () => void;
  
  /**
   * Get cache statistics for monitoring
   * @returns Cache size and metrics
   */
  getStatsCacheInfo: () => {
    size: number;
    maxSize: number;
    utilizationPct: number;
    oldestEntry: number | null;
    newestEntry: number | null;
  };
  
  // ============================================================================
  // Actions - Performance Tracking
  // ============================================================================
  
  /**
   * Record a statistics calculation for performance tracking
   * @param duration - Calculation duration in milliseconds
   * @param wasCached - Whether the result came from cache
   */
  recordCalculation: (duration: number, wasCached: boolean) => void;
  
  /**
   * Reset performance metrics
   */
  resetPerformanceMetrics: () => void;
  
  /**
   * Get formatted performance report
   * @returns Human-readable performance summary
   */
  getPerformanceReport: () => string;
  
  /**
   * Log performance metrics to console
   */
  logPerformanceMetrics: () => void;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/** Default cache TTL: 5 minutes */
const DEFAULT_CACHE_TTL = 5 * 60 * 1000;

/** Default maximum cache size: 50 entries */
const DEFAULT_CACHE_MAX_SIZE = 50;

// ============================================================================
// SLICE CREATOR
// ============================================================================

export const createStatsSlice: StateCreator<StatsSlice> = (set, get) => ({
  // ============================================================================
  // Initial State
  // ============================================================================
  
  currentStats: null,
  chartFilteredStats: null,
  isCalculatingStats: false,
  isCalculatingChartStats: false,
  statsError: null,
  
  statsCache: new Map<string, StatsCacheEntry>(),
  statsCacheMaxSize: DEFAULT_CACHE_MAX_SIZE,
  statsCacheTTL: DEFAULT_CACHE_TTL,
  
  statsPerformanceMetrics: {
    lastCalculationDuration: 0,
    averageCalculationDuration: 0,
    totalCalculations: 0,
    cacheHits: 0,
    cacheMisses: 0,
    cacheHitRate: 0,
  },
  
  // ============================================================================
  // Actions - Statistics Calculation
  // ============================================================================
  
  calculateStatistics: async () => {
    // Note: This implementation requires access to roadLayer, activeKpi, and currentFilters
    // These will be accessed via the combined store in the actual integration
    console.log('[Stats] Calculate statistics called - implementation requires store integration');
    
    const startTime = performance.now();
    
    set({ 
      isCalculatingStats: true,
      statsError: null 
    });
    
    try {
      // Note: In the integrated store, we'll access these from other slices
      // const { roadLayer } = get(); // from mapSlice
      // const { activeKpi } = get(); // from filterSlice
      // const { currentFilters } = get(); // from filterSlice
      
      // For now, just log that calculation was attempted
      console.log('[Stats] Statistics calculation requires integration with other slices');
      
      // Placeholder success
      const duration = performance.now() - startTime;
      get().recordCalculation(duration, false);
      
      set({ isCalculatingStats: false });
      
    } catch (error) {
      console.error('[Stats] Error calculating statistics:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      set({ 
        statsError: errorMessage,
        isCalculatingStats: false 
      });
      
      message.error('Failed to calculate statistics');
    }
  },
  
  calculateChartFilteredStatistics: async () => {
    console.log('[Stats] Calculate chart-filtered statistics called');
    
    const startTime = performance.now();
    
    set({ 
      isCalculatingChartStats: true,
      statsError: null 
    });
    
    try {
      // Note: Requires integration with mapSlice, filterSlice, and chartSlice
      // const { roadLayer } = get(); // from mapSlice
      // const { currentFilters } = get(); // from filterSlice
      // const { chartSelections } = get(); // from chartSlice
      
      console.log('[Stats] Chart statistics calculation requires integration with other slices');
      
      const duration = performance.now() - startTime;
      get().recordCalculation(duration, false);
      
      set({ isCalculatingChartStats: false });
      
    } catch (error) {
      console.error('[Stats] Error calculating chart statistics:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      set({ 
        statsError: errorMessage,
        isCalculatingChartStats: false 
      });
      
      message.error('Failed to calculate chart statistics');
    }
  },
  
  forceRecalculateStatistics: async () => {
    console.log('[Stats] Force recalculation requested - clearing cache');
    
    // Clear cache to force fresh calculation
    get().clearStatsCache();
    
    // Trigger calculation
    await get().calculateStatistics();
  },
  
  setCalculatingStats: (loading: boolean) => {
    set({ isCalculatingStats: loading });
  },
  
  setCalculatingChartStats: (loading: boolean) => {
    set({ isCalculatingChartStats: loading });
  },
  
  setStatsError: (error: string | null) => {
    set({ statsError: error });
  },
  
  // ============================================================================
  // Actions - Cache Management
  // ============================================================================
  
  getCachedStats: (kpi: KPIKey, filters: FilterState) => {
    const cacheKey = get().getStatsCacheKey(kpi, filters);
    const cached = get().statsCache.get(cacheKey);
    
    if (!cached) {
      return null;
    }
    
    // Check if cache entry is expired
    const now = Date.now();
    const age = now - cached.timestamp;
    
    if (age > get().statsCacheTTL) {
      console.log(`[Stats Cache] Entry expired (age: ${(age / 1000).toFixed(1)}s)`);
      get().statsCache.delete(cacheKey);
      return null;
    }
    
    console.log(`[Stats Cache] ✓ Hit (age: ${(age / 1000).toFixed(1)}s)`);
    return cached.stats;
  },
  
  setCachedStats: (kpi: KPIKey, filters: FilterState, stats: SummaryStatistics) => {
    const state = get();
    const cacheKey = state.getStatsCacheKey(kpi, filters);
    
    // Check if cache is at max size
    if (state.statsCache.size >= state.statsCacheMaxSize) {
      console.log('[Stats Cache] Max size reached, pruning...');
      state.pruneStatsCache();
    }
    
    const entry: StatsCacheEntry = {
      stats,
      timestamp: Date.now(),
      filters: { ...filters },
      kpi,
    };
    
    state.statsCache.set(cacheKey, entry);
    console.log(`[Stats Cache] Stored entry (total: ${state.statsCache.size})`);
  },
  
  getStatsCacheKey: (kpi: KPIKey, filters: FilterState) => {
    // Create unique key from KPI and filter values
    const parts = [
      kpi,
      filters.year,
      filters.subgroup.sort().join(','),
      filters.localAuthority.sort().join(','),
      filters.route.sort().join(','),
    ];
    
    return parts.join('|');
  },
  
  clearStatsCache: () => {
    const size = get().statsCache.size;
    get().statsCache.clear();
    
    console.log(`[Stats Cache] Cleared ${size} entries`);
    message.info('Statistics cache cleared');
  },
  
  pruneStatsCache: () => {
    const state = get();
    const now = Date.now();
    let pruned = 0;
    
    // Remove expired entries
    for (const [key, entry] of state.statsCache.entries()) {
      const age = now - entry.timestamp;
      if (age > state.statsCacheTTL) {
        state.statsCache.delete(key);
        pruned++;
      }
    }
    
    // If still at max size, remove oldest entries
    if (state.statsCache.size >= state.statsCacheMaxSize) {
      const entries = Array.from(state.statsCache.entries());
      entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
      
      const toRemove = entries.slice(0, Math.ceil(state.statsCacheMaxSize * 0.2));
      toRemove.forEach(([key]) => {
        state.statsCache.delete(key);
        pruned++;
      });
    }
    
    if (pruned > 0) {
      console.log(`[Stats Cache] Pruned ${pruned} entries`);
    }
  },
  
  getStatsCacheInfo: () => {
    const state = get();
    const entries = Array.from(state.statsCache.values());
    
    let oldestEntry: number | null = null;
    let newestEntry: number | null = null;
    
    if (entries.length > 0) {
      const timestamps = entries.map(e => e.timestamp);
      oldestEntry = Math.min(...timestamps);
      newestEntry = Math.max(...timestamps);
    }
    
    return {
      size: state.statsCache.size,
      maxSize: state.statsCacheMaxSize,
      utilizationPct: (state.statsCache.size / state.statsCacheMaxSize) * 100,
      oldestEntry,
      newestEntry,
    };
  },
  
  // ============================================================================
  // Actions - Performance Tracking
  // ============================================================================
  
  recordCalculation: (duration: number, wasCached: boolean) => {
    set((state) => {
      const metrics = state.statsPerformanceMetrics;
      const totalCalcs = metrics.totalCalculations + 1;
      
      // Update cache metrics
      const cacheHits = wasCached ? metrics.cacheHits + 1 : metrics.cacheHits;
      const cacheMisses = wasCached ? metrics.cacheMisses : metrics.cacheMisses + 1;
      const cacheHitRate = (cacheHits / totalCalcs) * 100;
      
      // Update duration metrics (only count actual calculations, not cache hits)
      let avgDuration = metrics.averageCalculationDuration;
      if (!wasCached) {
        const totalDuration = metrics.averageCalculationDuration * metrics.cacheMisses;
        avgDuration = (totalDuration + duration) / cacheMisses;
      }
      
      return {
        statsPerformanceMetrics: {
          lastCalculationDuration: duration,
          averageCalculationDuration: avgDuration,
          totalCalculations: totalCalcs,
          cacheHits,
          cacheMisses,
          cacheHitRate,
        },
      };
    });
    
    console.log(
      `[Stats Performance] ${wasCached ? '⚡ Cache hit' : '🔨 Calculated'} ` +
      `in ${duration.toFixed(2)}ms`
    );
  },
  
  resetPerformanceMetrics: () => {
    set({
      statsPerformanceMetrics: {
        lastCalculationDuration: 0,
        averageCalculationDuration: 0,
        totalCalculations: 0,
        cacheHits: 0,
        cacheMisses: 0,
        cacheHitRate: 0,
      },
    });
    
    console.log('[Stats Performance] Metrics reset');
  },
  
  getPerformanceReport: () => {
    const metrics = get().statsPerformanceMetrics;
    const cacheInfo = get().getStatsCacheInfo();
    
    return `
Statistics Performance Report
=============================
Calculations:
  Total: ${metrics.totalCalculations}
  Cache Hits: ${metrics.cacheHits}
  Cache Misses: ${metrics.cacheMisses}
  Hit Rate: ${metrics.cacheHitRate.toFixed(1)}%

Timing:
  Last: ${metrics.lastCalculationDuration.toFixed(2)}ms
  Average: ${metrics.averageCalculationDuration.toFixed(2)}ms

Cache:
  Entries: ${cacheInfo.size} / ${cacheInfo.maxSize}
  Utilization: ${cacheInfo.utilizationPct.toFixed(1)}%
=============================
    `.trim();
  },
  
  logPerformanceMetrics: () => {
    console.log(get().getPerformanceReport());
  },
});