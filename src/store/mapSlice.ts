// src/store/mapSlice.ts - FIXED VERSION
/**
 * ============================================================================
 * RMO Analytics Hub - Map Slice (FIXED)
 * ============================================================================
 * 
 * Manages map view, layers, and initialization state.
 * 
 * FIXES APPLIED:
 * 1. Line 453: Fixed CurrentPage type comparison issue
 * 2. Line 545: Fixed KPICode vs KPIKey type mismatch (using lowercase 'iri' instead of 'IRI')
 */

import type { StateCreator } from 'zustand';
import type MapView from '@arcgis/core/views/MapView';
import type WebMap from '@arcgis/core/WebMap';
import type FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import type Extent from '@arcgis/core/geometry/Extent';
import { message } from 'antd';

// Services
import MapViewService from '@/services/MapViewService';
import LARendererService from '@/services/LARendererService';
import RendererService from '@/services/RendererService';

// Config
import { LA_LAYER_CONFIG } from '@/config/layerConfig';
import { SURVEY_YEARS } from '@/config/constants';
import type { KPIKey } from '@/config/kpiConfig';

// ============================================================================
// TYPES
// ============================================================================

/**
 * KPI codes for condition metrics - uppercase version for field names
 */
export type KPICode = 'IRI' | 'RUT' | 'PSCI' | 'CSC' | 'MPD' | 'LPV';

/**
 * LA metric type for rendering
 */
export type LAMetricType = 'average' | 'fairOrBetter';

/**
 * Current page type
 */
export type CurrentPage = 'overview' | 'condition-summary';

// ============================================================================
// STATE INTERFACE
// ============================================================================

export interface MapSlice {
  // ============================================================================
  // Map View State
  // ============================================================================
  
  /** Loading state during map initialization */
  loading: boolean;
  
  /** ArcGIS MapView instance */
  mapView: MapView | null;
  
  /** ArcGIS WebMap instance */
  webmap: WebMap | null;
  
  /** Initial extent when map first loads (for reset functionality) */
  initialExtent: Extent | null;
  
  /** Map initialization error message */
  error: string | null;
  
  /** Flag to prevent duplicate initializations */
  mapInitialized: boolean;
  
  // ============================================================================
  // Layer State
  // ============================================================================
  
  /** Main road network layer (for filtering and rendering) */
  roadLayer: FeatureLayer | null;
  
  /** Secondary road layer for swipe comparison */
  roadLayerSwipe: FeatureLayer | null;
  
  /** Cache of LA polygon layers keyed by: {kpi}_{year}_{metricType} */
  laLayerCache: Map<string, FeatureLayer> | null;
  
  /** Current page context (determines which layers are visible) */
  currentPage: CurrentPage;
  
  /** Swipe comparison years */
  leftSwipeYear: number;
  rightSwipeYear: number;
  
  /** Current LA metric type for rendering */
  currentLAMetricType: LAMetricType;
  
  // ============================================================================
  // Actions
  // ============================================================================
  
  /**
   * Initialize the map view and load layers
   */
  initializeMap: (containerId: string) => Promise<void>;
  
  /**
   * Update visibility of LA polygon layers based on current page and active KPI
   * FIXED: Now properly handles CurrentPage type
   */
  updateLALayerVisibility: () => void;
  
  /**
   * Switch between LA metric rendering types
   */
  setLAMetricType: (metricType: LAMetricType) => void;
  
  /**
   * Update swipe comparison years
   */
  setSwipeYears: (left: number, right: number) => void;
  
  /**
   * Set the current page
   */
  setCurrentPage: (page: CurrentPage) => void;
  
  /**
   * Reset map to initial extent
   */
  resetMapExtent: () => void;
  
  /**
   * Cleanup map resources
   */
  cleanupMap: () => void;
}

// ============================================================================
// SLICE CREATOR
// ============================================================================

export const createMapSlice: StateCreator<MapSlice> = (set, get) => ({
  // ============================================================================
  // Initial State
  // ============================================================================
  
  loading: false,
  mapView: null,
  webmap: null,
  initialExtent: null,
  error: null,
  mapInitialized: false,
  roadLayer: null,
  roadLayerSwipe: null,
  laLayerCache: null,
  currentPage: 'overview',
  leftSwipeYear: 2018,
  rightSwipeYear: 2025,
  currentLAMetricType: 'average',
  
  // ============================================================================
  // Actions
  // ============================================================================
  
  initializeMap: async (containerId: string) => {
    const state = get();
    
    // Prevent duplicate initialization
    if (state.mapInitialized || state.loading) {
      console.log('[Map Init] Already initialized or loading');
      return;
    }
    
    set({ loading: true, error: null });
    console.log('[Map Init] Starting initialization...');
    
    try {
      // Initialize map view
      const { view, map } = await MapViewService.initialize(containerId);
      
      // Store initial extent for reset functionality
      const initialExtent = view.extent.clone();
      
      // Find road network layer
      const roadLayer = map.layers.find(
        (layer) => layer.title?.toLowerCase().includes('road') && layer.type === 'feature'
      ) as FeatureLayer | undefined;
      
      if (!roadLayer) {
        throw new Error('Road network layer not found in map');
      }
      
      console.log('[Map Init] Found road layer:', roadLayer.title);
      
      // Initialize LA layer cache
      const laCache = new Map<string, FeatureLayer>();
      
      // Find and cache all LA polygon layers
      map.layers.forEach((layer) => {
        if (layer.type === 'feature' && layer.title) {
          const title = layer.title.toLowerCase();
          
          // Match LA layers with pattern: {KPI}_{YEAR}_average or {KPI}_{YEAR}_fairorbetter
          const match = title.match(/^(iri|rut|psci|csc|mpd|lpv)_(\d{4})_(average|fairorbetter)$/);
          
          if (match) {
            const [, kpi, year, metricType] = match;
            const key = `${kpi}_${year}_${metricType}`;
            laCache.set(key, layer as FeatureLayer);
            console.log(`[Map Init] Cached LA layer: ${key}`);
            
            // Hide layer initially
            (layer as FeatureLayer).visible = false;
          }
        }
      });
      
      console.log(`[Map Init] Cached ${laCache.size} LA polygon layers`);
      
      // Update state
      set({
        mapView: view,
        webmap: map,
        roadLayer,
        roadLayerSwipe: null,
        laLayerCache: laCache,
        initialExtent,
        loading: false,
        mapInitialized: true,
        error: null
      });
      
      console.log('[Map Init] ✓ Initialization complete');
      message.success('Map loaded successfully');
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[Map Init] Failed:', error);
      
      set({
        loading: false,
        error: errorMessage,
        mapInitialized: false
      });
      
      message.error(`Map initialization failed: ${errorMessage}`);
    }
  },
  
  /**
   * FIXED: Line 453 - Proper handling of CurrentPage type comparison
   */
  updateLALayerVisibility: () => {
    const { laLayerCache, currentPage } = get();
    
    if (!laLayerCache) {
      console.warn('[LA Visibility] Layer cache not initialized yet');
      return;
    }
    
    const startTime = performance.now();
    
    // Get current context from store
    // NOTE: In a combined store, these would come from other slices
    // For now, we use placeholder values
    const activeKpi: KPIKey = 'iri'; // FIXED: Using lowercase KPIKey type
    const leftSwipeYear = get().leftSwipeYear;
    const rightSwipeYear = get().rightSwipeYear;
    const currentLAMetricType = get().currentLAMetricType;
    
    // FIXED: Proper type-safe comparison
    // The issue was comparing a typed literal 'overview' with 'condition-summary'
    // Now we correctly check if currentPage equals 'condition-summary'
    const shouldShow = currentPage === 'condition-summary';
    
    const leftKey = `${activeKpi}_${leftSwipeYear}_${currentLAMetricType}`;
    const rightKey = `${activeKpi}_${rightSwipeYear}_${currentLAMetricType}`;
    
    let updatedCount = 0;
    
    // Hide all LA layers
    for (const [key, layer] of laLayerCache.entries()) {
      if (layer.visible) {
        layer.visible = false;
        updatedCount++;
      }
    }
    
    // Show relevant layers if on condition-summary page
    if (shouldShow) {
      const leftLayer = laLayerCache.get(leftKey);
      const rightLayer = laLayerCache.get(rightKey);
      
      if (leftLayer) {
        leftLayer.visible = true;
        updatedCount++;
        console.log(`[LA Visibility] ✓ Showing left: ${leftKey}`);
      } else {
        console.warn(`[LA Visibility] ⚠ Left layer not found: ${leftKey}`);
      }
      
      if (rightLayer && rightKey !== leftKey) {
        rightLayer.visible = true;
        updatedCount++;
        console.log(`[LA Visibility] ✓ Showing right: ${rightKey}`);
      }
    }
    
    const duration = performance.now() - startTime;
    console.log(`[LA Visibility] Updated ${updatedCount} layers in ${duration.toFixed(2)}ms`);
  },
  
  setLAMetricType: (metricType: LAMetricType) => {
    set({ currentLAMetricType: metricType });
    
    // Trigger visibility update with new metric type
    get().updateLALayerVisibility();
    
    console.log(`[Map] Switched to ${metricType} metric type`);
  },
  
  setSwipeYears: (left: number, right: number) => {
    set({ leftSwipeYear: left, rightSwipeYear: right });
    console.log(`[Map] Updated swipe years: ${left} vs ${right}`);
  },
  
  setCurrentPage: (page: CurrentPage) => {
    set({ currentPage: page });
    
    // Update layer visibility when page changes
    get().updateLALayerVisibility();
    
    console.log(`[Map] Switched to page: ${page}`);
  },
  
  resetMapExtent: () => {
    const { mapView, initialExtent } = get();
    
    if (mapView && initialExtent) {
      mapView.goTo(initialExtent).catch((error) => {
        console.error('[Map] Failed to reset extent:', error);
      });
      console.log('[Map] Reset to initial extent');
    }
  },
  
  cleanupMap: () => {
    const { mapView, webmap, laLayerCache } = get();
    
    // Clear layer cache
    if (laLayerCache) {
      laLayerCache.clear();
    }
    
    // Destroy map view
    if (mapView) {
      mapView.destroy();
    }
    
    // Note: WebMap is managed by ArcGIS and will be cleaned up automatically
    
    set({
      mapView: null,
      webmap: null,
      roadLayer: null,
      roadLayerSwipe: null,
      laLayerCache: null,
      initialExtent: null,
      mapInitialized: false
    });
    
    console.log('[Map] Cleanup complete');
  }
});