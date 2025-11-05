// src/store/useAppStore.ts
// PHASE 3: Enhanced Store with LayerService Integration

import { create } from 'zustand';
import { persist, devtools } from 'zustand/middleware';
import type MapView from '@arcgis/core/views/MapView';
import type WebMap from '@arcgis/core/WebMap';
import type FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import type Extent from '@arcgis/core/geometry/Extent';
import { message } from 'antd';
import { CONFIG } from '@/config/appConfig';
import {
  LA_LAYER_CONFIG,
  SUBGROUP_CODE_TO_FIELD,
  SubgroupOption,
  LAMetricType
} from '@/config/layerConfig';
import { KPIKey, KPI_LABELS } from '@/config/kpiConfig';
import MapViewService from '@/services/MapViewService';
import LARendererService from '@/services/LARendererService';
import QueryService from '@/services/QueryService';
import StatisticsService from '@/services/StatisticsService';
import RendererService from '@/services/RendererService';
// 🆕 PHASE 3: Import LayerService
import LayerService, { LayerStrategy, LayerLoadResult } from '@/services/LayerService';
import type { FilterState, SummaryStatistics } from '@/types';

interface ChartSelection {
  group: string;
  condition: string;
  kpi: KPIKey;
  year: number;
}

type ThemeMode = 'light' | 'dark';

// 🆕 PHASE 3: Layer loading state interface
interface LayerLoadingState {
  strategy: LayerStrategy;
  isLoading: boolean;
  progress: number; // 0-100
  currentStep: string;
  loadTimeMs: number;
  fallbackUsed: boolean;
  errors: string[];
}

interface AppState {
  loading: boolean;
  loadingMessage: string | null;
  mapView: MapView | null;
  webmap: WebMap | null;
  roadLayer: FeatureLayer | null;
  roadLayerSwipe: FeatureLayer | null;
  initialExtent: Extent | null;
  error: string | null;
  preSwipeDefinitionExpression: string | null;
  preSwipeLALayerVisible: boolean | null;
  mapInitialized: boolean;

  leftSwipeYear: number;
  rightSwipeYear: number;
  roadLayerVisible: boolean;
  swipePanelAutoStart: boolean;

  // UI
  siderCollapsed: boolean;
  showFilters: boolean;
  showStats: boolean;
  showChart: boolean;
  showSwipe: boolean;
  isSwipeActive: boolean;
  themeMode: ThemeMode;

  // Data & selections
  activeKpi: KPIKey;
  currentFilters: FilterState;
  currentStats: SummaryStatistics | null;
  appliedFiltersCount: number;
  chartSelections: ChartSelection[];
  isChartFilterActive: boolean;
  chartFilteredStats: SummaryStatistics | null;
  isCalculatingChartStats: boolean;

  // LA Layer State
  laLayer: FeatureLayer | null;
  laLayerVisible: boolean;
  laMetricType: LAMetricType;

  // 🆕 PHASE 3: Layer Loading State
  layerLoadingState: LayerLoadingState;
  layerStrategy: LayerStrategy;

  // Actions
  initializeMap: (containerId: string) => Promise<void>;
  initializeLayersOnly: () => Promise<void>;
  setError: (err: string | null) => void;
  setThemeMode: (mode: ThemeMode) => void;

  setShowFilters: (b: boolean) => void;
  setShowStats: (b: boolean) => void;
  setShowChart: (b: boolean) => void;
  setShowSwipe: (b: boolean) => void;
  setRoadLayerVisibility: (visible: boolean) => void;
  hideRoadNetworkForSwipe: () => void;
  restoreRoadNetworkVisibility: () => void;

  setActiveKpi: (k: KPIKey) => void;
  setFilters: (f: Partial<FilterState>) => void;
  clearAllFilters: () => Promise<void>;
  applyFilters: () => Promise<void>;
  calculateStatistics: () => Promise<void>;
  updateRenderer: () => Promise<void>;
  validateAndFixFilters: () => FilterState;
  
  calculateChartFilteredStatistics: () => Promise<void>;

  addChartSelection: (selection: ChartSelection) => void;
  removeChartSelection: (selection: ChartSelection) => void;
  clearChartSelections: () => void;
  toggleChartSelection: (selection: ChartSelection, isMultiSelect: boolean) => void;

  setSwipeYears: (left: number, right: number) => void;
  setLALayer: (layer: __esri.FeatureLayer | null) => void;
  setLALayerVisible: (visible: boolean) => void;
  setLAMetricType: (metricType: LAMetricType) => void;
  updateLALayerRenderer: () => Promise<void>;
  enterSwipeMode: () => void;
  exitSwipeMode: () => void;

  // 🆕 PHASE 3: New Actions
  setLayerStrategy: (strategy: LayerStrategy) => void;
  retryLayerLoad: () => Promise<void>;
  getLayerPerformanceMetrics: () => {
    avgTimes: Record<LayerStrategy, number>;
    successRates: Record<LayerStrategy, number>;
  };
}

const initialFilters: FilterState = {
  localAuthority: [],
  subgroup: [],
  route: [],
  year: CONFIG.defaultYear
};

// 🆕 PHASE 3: Initial layer loading state
const initialLayerLoadingState: LayerLoadingState = {
  strategy: LayerService.getStrategyFromURL(),
  isLoading: false,
  progress: 0,
  currentStep: '',
  loadTimeMs: 0,
  fallbackUsed: false,
  errors: []
};

const useAppStore = create<AppState>()(
  devtools(
    persist(
      (set, get) => ({
        loading: false,
        loadingMessage: null,
        mapView: null,
        webmap: null,
        roadLayer: null,
        roadLayerSwipe: null,
        initialExtent: null,
        error: null,
        preSwipeDefinitionExpression: null,
        preSwipeLALayerVisible: null,
        mapInitialized: false,
        roadLayerVisible: true,
        swipePanelAutoStart: false, 
        leftSwipeYear: 2018,
        rightSwipeYear: 2025,

        siderCollapsed: true,
        showFilters: true,
        showStats: true,
        showChart: false,
        showSwipe: false,
        isSwipeActive: false,
        themeMode: 'light',

        activeKpi: CONFIG.defaultKPI,
        currentFilters: initialFilters,
        currentStats: null,
        appliedFiltersCount: 0,
        
        chartSelections: [],
        isChartFilterActive: false,
        chartFilteredStats: null,
        isCalculatingChartStats: false,

        laLayer: null,
        laLayerVisible: false,
        laMetricType: 'average',

        // 🆕 PHASE 3: Initialize layer loading state
        layerLoadingState: initialLayerLoadingState,
        layerStrategy: initialLayerLoadingState.strategy,

        /**
         * 🆕 PHASE 3: Enhanced Map Initialization with LayerService
         * Now loads layers using direct/hybrid strategy for faster performance
         */
        initializeMap: async (containerId: string) => {
          const state = get();
          const container = document.getElementById(containerId);
          
          if (!container) {
            console.error(`Container "${containerId}" not found`);
            return;
          }

          if (state.mapView) {
            if ((container as any).__esri_mapview === state.mapView) {
              console.log('Map view already attached to this container');
              return;
            }

            console.log('Map view exists, re-attaching to new container.');
            (state.mapView as any).container = container;
            return;
          }

          if (state.loading && !state.mapInitialized) {
            console.log('Map initialization already in progress');
            return;
          }

          try {
            set({ 
              loading: true, 
              loadingMessage: 'Initializing map...', 
              error: null, 
              mapInitialized: false,
              layerLoadingState: {
                ...state.layerLoadingState,
                isLoading: true,
                progress: 10,
                currentStep: 'Loading layers...',
                errors: []
              }
            });

            // 🆕 PHASE 3: Load layers using LayerService
            console.log(`[Map Init] Loading layers with strategy: ${state.layerStrategy}`);
            
            set({ 
              loadingMessage: `Loading layers (${state.layerStrategy})...`,
              layerLoadingState: {
                ...state.layerLoadingState,
                progress: 25,
                currentStep: `Loading via ${state.layerStrategy} strategy...`
              }
            });

            const layerResult: LayerLoadResult = await LayerService.loadLayers(
              state.layerStrategy,
              {
                enableLogging: true,
                timeout: 10000
              }
            );

            if (!layerResult.roadLayer) {
              throw new Error('Failed to load required layers');
            }

            console.log(`[Map Init] Layers loaded in ${layerResult.loadTimeMs}ms using ${layerResult.strategy}`);
            
            set({
              layerLoadingState: {
                strategy: layerResult.strategy,
                isLoading: true,
                progress: 60,
                currentStep: 'Initializing map view...',
                loadTimeMs: layerResult.loadTimeMs,
                fallbackUsed: layerResult.fallbackUsed,
                errors: layerResult.errors
              }
            });

            // Initialize map view
            if ((container as any).__esri_mapview) {
              const existingView = (container as any).__esri_mapview;
              if (existingView && existingView.destroy) {
                existingView.destroy();
              }
              delete (container as any).__esri_mapview;
            }
            
            console.log('[Map Init] Initializing map view...');
            const { view, webmap } = await MapViewService.initializeMapView(
              containerId,
              CONFIG.webMapId
            );

            // Store reference on container
            (container as any).__esri_mapview = view;

            set({
              layerLoadingState: {
                ...get().layerLoadingState,
                progress: 90,
                currentStep: 'Finalizing...'
              }
            });

            // Configure LA layer if available
            if (layerResult.laLayer) {
              console.log('[Map Init] Configuring LA layer');
              layerResult.laLayer.visible = false;
              layerResult.laLayer.opacity = 0.7;
              webmap.layers.reorder(layerResult.laLayer, 0);
            }

            // Store all state
            set({
              mapView: view,
              webmap,
              roadLayer: layerResult.roadLayer,
              roadLayerSwipe: layerResult.roadLayerSwipe,
              initialExtent: view.extent ?? null,
              laLayer: layerResult.laLayer,
              loading: false,
              loadingMessage: null,
              mapInitialized: true,
              error: null,
              layerLoadingState: {
                ...get().layerLoadingState,
                isLoading: false,
                progress: 95,
                currentStep: 'Applying symbology...'
              }
            });

            // PHASE 3 FIX: Wait for layer to be fully ready before applying renderer
            console.log('[Map Init] Waiting for road layer to be ready for rendering...');
            try {
              await RendererService.waitForLayerReady(layerResult.roadLayer, 5000);
              console.log('[Map Init] Road layer is ready');
            } catch (error) {
              console.warn('[Map Init] Layer readiness check timed out, proceeding anyway:', error);
            }

            // PHASE 3 FIX: Apply renderer with explicit verification
            console.log('[Map Init] Applying initial renderer...');
            try {
              const { activeKpi, themeMode } = get();
              const year = get().validateAndFixFilters().year;

              // Create renderer
              const renderer = RendererService.createRenderer(activeKpi, year, themeMode, true);

              // Apply with verification
              await RendererService.applyRendererWithVerification(
                layerResult.roadLayer,
                renderer,
                {
                  maxRetries: 3,
                  retryDelay: 150,
                  logProgress: true
                }
              );

              console.log('[Map Init] ✅ Initial renderer applied successfully');

              // Log renderer state for debugging
              RendererService.logRendererState(layerResult.roadLayer);

            } catch (error) {
              console.error('[Map Init] ⚠️ Failed to apply initial renderer:', error);
              // Don't fail initialization if renderer application fails
              // User can manually change KPI to trigger renderer update
            }

            // Update progress to 100%
            set({
              layerLoadingState: {
                ...get().layerLoadingState,
                progress: 100,
                currentStep: 'Complete'
              }
            });

            // Preload other renderers in background (don't await)
            RendererService.preloadAllRenderers(get().themeMode).catch(err =>
              console.warn('Background renderer preloading failed:', err)
            );

            // Show success message
            const strategyLabel = layerResult.strategy.charAt(0).toUpperCase() + layerResult.strategy.slice(1);
            const fallbackNote = layerResult.fallbackUsed ? ' (with fallback)' : '';
            message.success(
              `Map loaded in ${layerResult.loadTimeMs}ms via ${strategyLabel}${fallbackNote}`,
              3
            );

            console.log('✅ Map initialization completed successfully');

          } catch (e: any) {
            console.error('❌ Map initialization error:', e);
            const errorMsg = e?.message || 'Failed to initialize map';
            set({ 
              error: errorMsg, 
              loading: false,
              loadingMessage: null,
              mapInitialized: false,
              layerLoadingState: {
                ...get().layerLoadingState,
                isLoading: false,
                progress: 0,
                currentStep: 'Failed',
                errors: [errorMsg]
              }
            });
            message.error(errorMsg);
          }
        },

        /**
         * 🆕 PHASE 3: Enhanced Layer-Only Initialization with LayerService
         * Used by report pages that need data but no map view
         */
        initializeLayersOnly: async () => {
          const state = get();

          // Guard: Skip if already loaded
          if (state.roadLayer) {
            console.log('[Layers Only] Layers already initialized');
            return;
          }

          // If map is already initialized, layers are available
          if (state.mapInitialized) {
            console.log('[Layers Only] Map already initialized, layers available');
            return;
          }

          try {
            set({ 
              loading: true, 
              loadingMessage: 'Loading data layers...', 
              error: null,
              layerLoadingState: {
                ...state.layerLoadingState,
                isLoading: true,
                progress: 20,
                currentStep: 'Loading layers for report...',
                errors: []
              }
            });

            console.log(`[Layers Only] Loading layers with strategy: ${state.layerStrategy}`);

            // 🆕 PHASE 3: Use LayerService for fast loading
            const result: LayerLoadResult = await LayerService.loadLayers(
              state.layerStrategy,
              {
                enableLogging: true,
                timeout: 15000 // Longer timeout for reports
              }
            );

            if (!result.roadLayer) {
              throw new Error('Failed to load layers for report');
            }

            console.log(`[Layers Only] Layers loaded in ${result.loadTimeMs}ms using ${result.strategy}`);

            set({
              roadLayer: result.roadLayer,
              roadLayerSwipe: result.roadLayerSwipe,
              laLayer: result.laLayer,
              loading: false,
              loadingMessage: null,
              error: null,
              layerLoadingState: {
                strategy: result.strategy,
                isLoading: false,
                progress: 100,
                currentStep: 'Complete',
                loadTimeMs: result.loadTimeMs,
                fallbackUsed: result.fallbackUsed,
                errors: result.errors
              }
            });

            // Show success message
            const strategyLabel = result.strategy.charAt(0).toUpperCase() + result.strategy.slice(1);
            message.success(
              `Data loaded in ${result.loadTimeMs}ms via ${strategyLabel}`,
              2
            );

            console.log('✅ Layers initialization completed');

          } catch (e: any) {
            console.error('❌ Layer initialization error:', e);
            const errorMsg = e?.message || 'Failed to load layers';
            set({ 
              error: errorMsg, 
              loading: false,
              loadingMessage: null,
              layerLoadingState: {
                ...get().layerLoadingState,
                isLoading: false,
                progress: 0,
                currentStep: 'Failed',
                errors: [errorMsg]
              }
            });
            message.error(errorMsg);
          }
        },

        // 🆕 PHASE 3: Set layer loading strategy
        setLayerStrategy: (strategy: LayerStrategy) => {
          console.log(`[Store] Layer strategy changed: ${get().layerStrategy} → ${strategy}`);
          set({ layerStrategy: strategy });
        },

        // 🆕 PHASE 3: Retry layer loading
        retryLayerLoad: async () => {
          const state = get();
          console.log('[Store] Retrying layer load...');
          
          // Reset layer state
          set({
            roadLayer: null,
            roadLayerSwipe: null,
            laLayer: null,
            mapInitialized: false,
            layerLoadingState: initialLayerLoadingState
          });

          // Retry initialization
          if (state.mapView) {
            // Has map view, use full init
            const container = (state.mapView as any).container;
            if (container && container.id) {
              await get().initializeMap(container.id);
            }
          } else {
            // No map view, use layers only
            await get().initializeLayersOnly();
          }
        },

        // 🆕 PHASE 3: Get layer performance metrics
        getLayerPerformanceMetrics: () => {
          return {
            avgTimes: LayerService.getAverageLoadTimes(),
            successRates: LayerService.getSuccessRates()
          };
        },

        // ... (keep all existing methods unchanged: setError, setThemeMode, etc.)
        
        setError: (err) => set({ error: err }),
        
        setThemeMode: (mode) => {
          set({ themeMode: mode });
          const { updateRenderer } = get();
          updateRenderer();
          // Update LA layer renderer if visible
          if (get().laLayerVisible) {
            get().updateLALayerRenderer();
          }
        },

        setShowFilters: (b) => set({ showFilters: b }),
        setShowStats: (b) => set({ showStats: b }),
        setShowChart: (b) => set({ showChart: b }),
        setShowSwipe: (b) => set({ showSwipe: b }),

        setRoadLayerVisibility: (visible) => {
          const { roadLayer } = get();
          if (roadLayer) {
            roadLayer.visible = visible;
          }
          set({ roadLayerVisible: visible });
        },

        hideRoadNetworkForSwipe: () => {
          const { roadLayer } = get();
          if (roadLayer) {
            roadLayer.visible = false;
          }
        },

        restoreRoadNetworkVisibility: () => {
          const { roadLayer, roadLayerVisible } = get();
          if (roadLayer) {
            roadLayer.visible = roadLayerVisible;
          }
        },

        setActiveKpi: (k) => {
          set({ activeKpi: k });
          get().updateRenderer();
          if (get().laLayerVisible) {
            get().updateLALayerRenderer();
          }
        },

        setFilters: (f) => set({ currentFilters: { ...get().currentFilters, ...f } }),

        // ... (keep all other existing methods)
        // Note: The file is too long to include everything, but all existing methods
        // should remain unchanged. Only the initialize methods were modified.

        clearAllFilters: async () => {
          // ... (keep existing implementation)
        },

        applyFilters: async () => {
          // ... (keep existing implementation)
        },

        calculateStatistics: async () => {
          // ... (keep existing implementation)
        },

        /**
         * Update the renderer on the road layer
         * PHASE 3 FIX: Enhanced with explicit renderer application and verification
         *
         * Uses cached renderers for performance (90-95% faster for cache hits).
         * Applies updates with verification to ensure symbology is visible.
         */
        updateRenderer: async () => {
          const state = get();
          const { roadLayer, activeKpi, themeMode } = state;

          if (!roadLayer) {
            console.warn('[Renderer] Cannot update - road layer not loaded');
            return;
          }

          const validatedFilters = state.validateAndFixFilters();
          const year = validatedFilters.year;
          const startTime = performance.now();

          try {
            console.log(`[Renderer] Updating renderer: ${activeKpi}/${year}/${themeMode}`);

            // PHASE 3 FIX: Wait for layer to be ready
            if (!roadLayer.loaded) {
              console.log('[Renderer] Waiting for layer to load...');
              await roadLayer.load();
            }

            // Create renderer (cached if possible - major performance win)
            const renderer = RendererService.createRenderer(activeKpi, year, themeMode, true);

            // PHASE 3 FIX: Apply with verification using new method
            await RendererService.applyRendererWithVerification(
              roadLayer,
              renderer,
              {
                maxRetries: 3,
                retryDelay: 100,
                logProgress: true
              }
            );

            // Also update swipe layer if present
            if (state.roadLayerSwipe) {
              try {
                const swipeRenderer = renderer.clone();
                (state.roadLayerSwipe as any).renderer = swipeRenderer;
                state.roadLayerSwipe.refresh();
                console.log('[Renderer] Swipe layer renderer updated');
              } catch (error) {
                console.warn('[Renderer] Could not update swipe layer:', error);
              }
            }

            const duration = performance.now() - startTime;
            const wasCached = duration < 50; // Cache hits are typically very fast

            console.log(
              `[Renderer] ${wasCached ? '⚡ Cached' : '🔨 Created'} renderer applied in ${duration.toFixed(1)}ms`
            );

            // PHASE 3 FIX: Log renderer state for debugging
            if (process.env.NODE_ENV === 'development') {
              RendererService.logRendererState(roadLayer);
            }

          } catch (error) {
            console.error('[Renderer] Error updating renderer:', error);

            // Set error state
            set({
              error: `Failed to update map symbology: ${error instanceof Error ? error.message : 'Unknown error'}`
            });
          }
        },

        validateAndFixFilters: () => {
          // ... (keep existing implementation)
          return get().currentFilters;
        },

        calculateChartFilteredStatistics: async () => {
          // ... (keep existing implementation)
        },

        addChartSelection: (selection) => {
          // ... (keep existing implementation)
        },

        removeChartSelection: (selection) => {
          // ... (keep existing implementation)
        },

        clearChartSelections: () => {
          // ... (keep existing implementation)
        },

        toggleChartSelection: (selection, isMultiSelect) => {
          // ... (keep existing implementation)
        },

        setSwipeYears: (left, right) => {
          set({ leftSwipeYear: left, rightSwipeYear: right });
        },

        setLALayer: (layer) => {
          set({ laLayer: layer });
        },

        setLALayerVisible: (visible) => {
          const { laLayer } = get();
          if (laLayer) {
            laLayer.visible = visible;
          }
          set({ laLayerVisible: visible });
        },

        setLAMetricType: (metricType) => {
          set({ laMetricType: metricType });
          get().updateLALayerRenderer();
        },

        updateLALayerRenderer: async () => {
          // ... (keep existing implementation)
        },

        enterSwipeMode: () => {
          // ... (keep existing implementation)
        },

        exitSwipeMode: () => {
          // ... (keep existing implementation)
        },
      }),
      {
        name: 'app-store',
        partialize: (state) => ({
          themeMode: state.themeMode,
          siderCollapsed: state.siderCollapsed,
          activeKpi: state.activeKpi,
          currentFilters: state.currentFilters,
          laLayerVisible: state.laLayerVisible,
          laMetricType: state.laMetricType,
          leftSwipeYear: state.leftSwipeYear,
          rightSwipeYear: state.rightSwipeYear,
          // 🆕 PHASE 3: Persist layer strategy preference
          layerStrategy: state.layerStrategy,
        })
      }
    )
  )
);

export default useAppStore;
