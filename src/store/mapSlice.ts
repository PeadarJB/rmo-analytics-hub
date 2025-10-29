/**
 * ============================================================================
 * RMO Analytics Hub - Map Slice
 * ============================================================================
 * 
 * Manages map view, layers, and initialization state.
 * Extracted from monolithic useAppStore.ts for better separation of concerns.
 * 
 * File: src/store/slices/mapSlice.ts
 * Size: ~450 lines
 * Created: 2025-10-29
 * 
 * Responsibilities:
 * - Map view initialization and lifecycle
 * - Layer management (road network, LA polygons, swipe layers)
 * - Layer visibility and caching
 * - LA layer rendering and metric types
 * - Error handling for map operations
 * 
 * @module store/slices/mapSlice
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
import type { KPICode } from '@/config/kpiConfig';

// Types
import type { LAMetricType } from '@/types';

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
  
  /** Single Local Authority polygon layer (new architecture) */
  laLayer: FeatureLayer | null;
  
  /** Cached LA polygon layers for O(1) lookup - Map<cacheKey, FeatureLayer>
   * Key format: "{kpi}_{year}_average" (e.g., "iri_2025_average")
   */
  laLayerCache: Map<string, FeatureLayer>;
  
  /** Legacy: Map of LA polygon layers for swipe mode - Map<layerTitle, FeatureLayer> */
  laPolygonLayers: Map<string, FeatureLayer>;
  
  // ============================================================================
  // Layer Visibility State
  // ============================================================================
  
  /** Whether road network layer is visible */
  roadLayerVisible: boolean;
  
  /** Whether LA polygon layer is visible */
  laLayerVisible: boolean;
  
  /** Type of metric shown on LA layer (average vs fairOrBetter percentages) */
  laMetricType: LAMetricType;
  
  /** Stored definition expression before entering swipe mode (for restoration) */
  preSwipeDefinitionExpression: string | null;
  
  // ============================================================================
  // MAP INITIALIZATION ACTIONS
  // ============================================================================
  
  /**
   * Initializes the ArcGIS map view with layers and widgets.
   * Includes multiple guards to prevent duplicate initialization.
   * 
   * @param containerId - DOM element ID to attach the map view
   * 
   * @example
   * ```typescript
   * const { initializeMap } = useAppStore();
   * 
   * useEffect(() => {
   *   initializeMap('map-container');
   * }, []);
   * ```
   */
  initializeMap: (containerId: string) => Promise<void>;
  
  /**
   * Sets or clears the map initialization error.
   * 
   * @param error - Error message or null to clear
   */
  setError: (error: string | null) => void;
  
  // ============================================================================
  // LAYER MANAGEMENT ACTIONS
  // ============================================================================
  
  /**
   * Sets the single LA polygon layer reference.
   * Called during map initialization.
   * 
   * @param layer - FeatureLayer instance or null
   */
  setLALayer: (layer: FeatureLayer | null) => void;
  
  /**
   * Updates LA polygon layer visibility using cached layer references.
   * O(1) lookup performance vs O(n) layer searching.
   * 
   * Called when:
   * - KPI changes
   * - Year changes (left or right swipe year)
   * - Page changes (overview <-> condition-summary)
   * 
   * @example
   * ```typescript
   * // After changing KPI
   * setActiveKpi('RUT');
   * updateLALayerVisibility(); // Shows RUT layers for current years
   * ```
   */
  updateLALayerVisibility: () => void;
  
  /**
   * Toggle LA layer visibility (show/hide all LA layers).
   * 
   * @param visible - Whether to show or hide all LA layers
   */
  setLaLayersVisibility: (visible: boolean) => void;
  
  /**
   * Toggle single LA layer visibility (new architecture).
   * 
   * @param visible - Whether to show or hide the LA layer
   */
  setLALayerVisible: (visible: boolean) => void;
  
  /**
   * Change LA layer metric type (average vs fairOrBetter).
   * Triggers renderer update.
   * 
   * @param metricType - "average" or "fairOrBetter"
   * 
   * @example
   * ```typescript
   * // Show "Fair or Better" percentages instead of averages
   * setLAMetricType('fairOrBetter');
   * ```
   */
  setLAMetricType: (metricType: LAMetricType) => void;
  
  /**
   * Updates the LA layer renderer based on current KPI, year, and metric type.
   * Called automatically when these values change.
   */
  updateLALayerRenderer: () => void;
  
  /**
   * Sets road network layer visibility.
   * 
   * @param visible - Whether to show or hide the road layer
   */
  setRoadLayerVisibility: (visible: boolean) => void;
  
  /**
   * Hides the road network layer for swipe mode.
   * Stores the current definition expression for later restoration.
   */
  hideRoadNetworkForSwipe: () => void;
  
  /**
   * Restores the road network layer visibility after swipe mode.
   * Reapplies the stored definition expression.
   */
  restoreRoadNetworkVisibility: () => void;
  
  /**
   * Enters swipe mode by hiding the main road layer and storing its filter.
   */
  enterSwipeMode: () => void;
  
  /**
   * Exits swipe mode by restoring the main road layer and its filter.
   */
  exitSwipeMode: () => void;
}

// ============================================================================
// SLICE CREATOR
// ============================================================================

/**
 * Creates the map slice with all state and actions.
 * Uses Zustand's StateCreator type for proper typing.
 */
export const createMapSlice: StateCreator
  MapSlice,
  [],
  [],
  MapSlice
> = (set, get) => ({
  
  // ============================================================================
  // INITIAL STATE
  // ============================================================================
  
  loading: true,
  mapView: null,
  webmap: null,
  roadLayer: null,
  roadLayerSwipe: null,
  laLayer: null,
  initialExtent: null,
  error: null,
  mapInitialized: false,
  laLayerCache: new Map(),
  laPolygonLayers: new Map(),
  roadLayerVisible: true,
  laLayerVisible: false,
  laMetricType: 'average',
  preSwipeDefinitionExpression: null,
  
  // ============================================================================
  // ACTIONS
  // ============================================================================
  
  /**
   * Initializes the ArcGIS map view
   */
  initializeMap: async (containerId: string) => {
    const state = get();
    
    // ========================================================================
    // GUARD 1: Check if map is already initialized
    // ========================================================================
    if (state.mapInitialized && state.mapView) {
      console.log('[Map] Already initialized, skipping re-initialization');
      
      // Just ensure the view container is correct
      const container = document.getElementById(containerId);
      if (container && state.mapView.container !== container) {
        console.log('[Map] Updating map container');
        (state.mapView as any).container = container;
      }
      
      return; // Early return - map already exists
    }
    
    // ========================================================================
    // GUARD 2: Prevent concurrent initialization attempts
    // ========================================================================
    if (state.loading && state.mapInitialized) {
      console.log('[Map] Initialization already in progress');
      return;
    }
    
    try {
      set({ loading: true, error: null });
      
      // ========================================================================
      // GUARD 3: Check if container exists
      // ========================================================================
      const container = document.getElementById(containerId);
      if (!container) {
        throw new Error(`Container element with id "${containerId}" not found`);
      }
      
      // ========================================================================
      // GUARD 4: Check if a map view is already attached to this container
      // ========================================================================
      if ((container as any).__esri_mapview) {
        console.warn('[Map] Container already has a map view attached, cleaning up');
        const existingView = (container as any).__esri_mapview;
        if (existingView && existingView.destroy) {
          existingView.destroy();
        }
        delete (container as any).__esri_mapview;
      }
      
      // ========================================================================
      // Initialize Map View
      // ========================================================================
      console.log('[Map] Initializing new map view...');
      
      // Get webMapId from config (you'll need to import this)
      const webMapId = '4e3d7e6f8c0a4f6a8e9d5c7b2a1f3e8d'; // Replace with actual config value
      const { view, webmap } = await MapViewService.initializeMapView(
        containerId,
        webMapId
      );
      
      // ========================================================================
      // Build LA Layer Cache for O(1) Lookups
      // ========================================================================
      const laCache = new Map<string, FeatureLayer>();
      const laPolygons = new Map<string, FeatureLayer>();
      
      webmap.layers.forEach(layer => {
        const layerTitle = layer.title;
        
        // Only proceed if the layer has a title
        if (layerTitle) {
          // Check if this is an LA polygon layer
          // Pattern: "Average [KPI] [YEAR]"
          const laPattern = /^Average\s+(IRI|RUT|PSCI|CSC|MPD|LPV)\s+(2011|2018|2025)$/i;
          const match = layerTitle.match(laPattern);
          
          if (match && layer.type === 'feature') {
            const kpi = match[1].toLowerCase();
            const year = parseInt(match[2]);
            
            // Store with consistent key format
            const cacheKey = `${kpi}_${year}_average`; // e.g., "iri_2025_average"
            laCache.set(cacheKey, layer as FeatureLayer);
            laPolygons.set(layerTitle, layer as FeatureLayer);
            
            console.log(`[LA Cache] Registered: ${cacheKey} → "${layerTitle}"`);
          }
        }
      });
      
      console.log(`[LA Cache] Built cache with ${laCache.size} layers`);
      
      // ========================================================================
      // Store Reference on Container (for guard checks)
      // ========================================================================
      (container as any).__esri_mapview = view;
      
      // ========================================================================
      // Find Road Network Layers
      // ========================================================================
      const roadLayerTitle = 'Regional Road Network 100m segments'; // From config
      const roadSwipeLayerTitle = 'Regional Road Network 100m segments - Swipe'; // From config
      
      const road = webmap.allLayers.find(
        (l: any) => l.title === roadLayerTitle
      ) as FeatureLayer | undefined;
      
      const roadSwipe = webmap.allLayers.find(
        (l: any) => l.title === roadSwipeLayerTitle
      ) as FeatureLayer | undefined;
      
      if (!road) {
        message.warning('Road network layer not found. Check layer title in config.');
      }
      
      // ========================================================================
      // Find Single LA Polygon Layer (New Architecture)
      // ========================================================================
      const laLayerTitle = LA_LAYER_CONFIG.layerTitle; // From config
      const laLayer = webmap.allLayers.find(
        (l: any) => l.title === laLayerTitle
      ) as FeatureLayer | undefined;
      
      if (laLayer) {
        console.log('✓ Found LA polygon layer:', laLayer.title);
        await laLayer.load(); // Load to access fields
        laLayer.visible = false; // Hidden by default
        
        // Set opacity and z-order
        laLayer.opacity = 0.7;
        
        // Move LA layer below road network
        if (road) {
          const roadIndex = webmap.layers.indexOf(road as any);
          webmap.reorder(laLayer, roadIndex);
        }
      } else {
        console.warn('⚠ LA polygon layer not found:', laLayerTitle);
      }
      
      // ========================================================================
      // Update State
      // ========================================================================
      set({
        mapView: view,
        webmap,
        roadLayer: road ?? null,
        roadLayerSwipe: roadSwipe ?? null,
        laLayer: laLayer ?? null,
        initialExtent: view.extent ?? null,
        laLayerCache: laCache,
        laPolygonLayers: laPolygons,
        loading: false,
        mapInitialized: true,
        error: null
      });
      
      // ========================================================================
      // Background Tasks
      // ========================================================================
      
      // Preload all renderers in the background during idle time
      // to make subsequent KPI/year changes instantaneous
      if (road) {
        const themeMode = 'light'; // Get from theme slice later
        RendererService.preloadAllRenderers(themeMode).catch(err =>
          console.warn('[Map] Background renderer preloading failed:', err)
        );
      }
      
      // Clean up previous view if it exists
      if (state.mapView && state.mapView !== view) {
        state.mapView.destroy();
      }
      
      console.log('[Map] Initialization completed successfully');
      
    } catch (e: any) {
      console.error('[Map] Initialization error:', e);
      const errorMsg = e?.message || 'Failed to initialize map';
      set({
        error: errorMsg,
        loading: false,
        mapInitialized: false
      });
      message.error(errorMsg);
    }
  },
  
  /**
   * Sets or clears the error state
   */
  setError: (error: string | null) => {
    set({ error });
  },
  
  /**
   * Sets the LA layer reference
   */
  setLALayer: (layer: FeatureLayer | null) => {
    set({ laLayer: layer });
  },
  
  /**
   * Updates LA polygon layer visibility using cached layer references
   */
  updateLALayerVisibility: () => {
    const {
      laLayerCache,
    } = get();
    
    // Fast exit if cache not built yet
    if (laLayerCache.size === 0) {
      console.warn('[LA Visibility] Layer cache not initialized yet');
      return;
    }
    
    const startTime = performance.now();
    
    // Get current state from other slices (will be passed in when combined)
    // For now, use placeholder values - these will come from filter/ui slices
    const activeKpi: KPICode = 'IRI'; // From filter slice
    const leftSwipeYear = 2018; // From ui slice
    const rightSwipeYear = 2025; // From ui slice
    const currentPage: 'overview' | 'condition-summary' = 'overview'; // From ui slice
    
    const shouldShow = currentPage === 'condition-summary';
    
    // Build keys for layers that should be visible
    const leftKey = `${activeKpi.toLowerCase()}_${leftSwipeYear}_average`;
    const rightKey = `${activeKpi.toLowerCase()}_${rightSwipeYear}_average`;
    
    let updatedCount = 0;
    
    // Hide all LA layers first (fast iteration over cached layers only)
    for (const [key, layer] of laLayerCache.entries()) {
      if (layer.visible) {
        layer.visible = false;
        updatedCount++;
      }
    }
    
    // Show only the relevant layers
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
  
  /**
   * Toggle all LA layers visibility
   */
  setLaLayersVisibility: (visible: boolean) => {
    const { laLayerCache } = get();
    
    for (const [_, layer] of laLayerCache.entries()) {
      layer.visible = visible;
    }
    
    console.log(`[LA Visibility] Set all layers to: ${visible}`);
  },
  
  /**
   * Toggle single LA layer visibility
   */
  setLALayerVisible: (visible: boolean) => {
    const { laLayer } = get();
    
    set({ laLayerVisible: visible });
    
    if (laLayer) {
      laLayer.visible = visible;
      console.log(`[LA Layer] Visibility set to: ${visible}`);
    }
  },
  
  /**
   * Change LA layer metric type
   */
  setLAMetricType: (metricType: LAMetricType) => {
    set({ laMetricType: metricType });
    
    // Update renderer when metric type changes
    get().updateLALayerRenderer();
  },
  
  /**
   * Updates the LA layer renderer
   */
  updateLALayerRenderer: () => {
    const { laLayer, laMetricType } = get();
    
    if (!laLayer) {
      console.warn('[LA Renderer] No LA layer available');
      return;
    }
    
    // Get current state from other slices (will be passed in when combined)
    const activeKpi: KPICode = 'IRI'; // From filter slice
    const currentYear = 2025; // From filter slice
    
    try {
      const renderer = LARendererService.createLARenderer(
        activeKpi,
        currentYear,
        laMetricType
      );
      
      laLayer.renderer = renderer as any;
      console.log(`[LA Renderer] Updated for ${activeKpi} ${currentYear} (${laMetricType})`);
    } catch (error) {
      console.error('[LA Renderer] Failed to update:', error);
    }
  },
  
  /**
   * Sets road network layer visibility
   */
  setRoadLayerVisibility: (visible: boolean) => {
    const { roadLayer } = get();
    
    set({ roadLayerVisible: visible });
    
    if (roadLayer) {
      roadLayer.visible = visible;
      console.log(`[Road Layer] Visibility set to: ${visible}`);
    }
  },
  
  /**
   * Hides road network for swipe mode
   */
  hideRoadNetworkForSwipe: () => {
    const { roadLayer } = get();
    
    if (roadLayer) {
      // Store current definition expression
      const currentExpression = (roadLayer as any).definitionExpression || '1=1';
      set({ preSwipeDefinitionExpression: currentExpression });
      
      // Hide the layer
      roadLayer.visible = false;
      
      console.log('[Swipe] Hidden road network, stored filter:', currentExpression);
    }
  },
  
  /**
   * Restores road network after swipe mode
   */
  restoreRoadNetworkVisibility: () => {
    const { roadLayer, preSwipeDefinitionExpression } = get();
    
    if (roadLayer && preSwipeDefinitionExpression) {
      // Restore definition expression
      (roadLayer as any).definitionExpression = preSwipeDefinitionExpression;
      
      // Make layer visible only if a filter was active
      roadLayer.visible = preSwipeDefinitionExpression !== '1=1';
      
      console.log('[Swipe] Restored road network with filter:', preSwipeDefinitionExpression);
    }
    
    set({ preSwipeDefinitionExpression: null });
  },
  
  /**
   * Enters swipe mode
   */
  enterSwipeMode: () => {
    get().hideRoadNetworkForSwipe();
  },
  
  /**
   * Exits swipe mode
   */
  exitSwipeMode: () => {
    get().restoreRoadNetworkVisibility();
  },
});

// ============================================================================
// EXPORTS
// ============================================================================

export type { MapSlice };
export { createMapSlice };