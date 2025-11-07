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
import LayerService from '@/services/LayerService';
import type { FilterState, SummaryStatistics } from '@/types';

interface ChartSelection {
  group: string;
  condition: string;
  kpi: KPIKey;
  year: number;
}

type ThemeMode = 'light' | 'dark';

// REMOVED: LayerLoadingState interface - no longer using hybrid loading

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

  // Actions
  initializeMapWithWebMap: (containerId: string) => Promise<void>;
  initializeLayersDirectly: () => Promise<void>;
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
}

const initialFilters: FilterState = {
  localAuthority: [],
  subgroup: [],
  route: [],
  year: CONFIG.defaultYear
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

        /**
         * Initialize map for Overview Dashboard using WebMap
         * This loads the full WebMap with all configurations
         */
        initializeMapWithWebMap: async (containerId: string) => {
          const state = get();

          const container = document.getElementById(containerId);
          if (!container) {
            throw new Error(`Container ${containerId} not found`);
          }

          // Check if container already has a valid view
          const existingView = (container as any).__esri_mapview;
          if (existingView && !existingView.destroyed && state.mapInitialized) {
            console.log('[Map Init] Already initialized with valid view');
            return;
          }

          // If view was destroyed, allow re-initialization
          if (state.mapInitialized && (!existingView || existingView.destroyed)) {
            console.log('[Map Init] Previous view destroyed, re-initializing...');
            set({ mapInitialized: false, roadLayer: null, mapView: null, webmap: null });
          }

          // Additional guard: Prevent concurrent initialization
          if (state.loading) {
            console.log('[Map Init] Initialization already in progress');
            return;
          }

          set({ loading: true, loadingMessage: 'Loading WebMap...' });

          try {
            console.log('[Map Init] Starting WebMap initialization...');

            // Load map using WebMap configuration
            const { view, webmap } = await MapViewService.initializeMapView(
              containerId,
              CONFIG.webMapId
            );

            // Extract layers from WebMap
            const roadLayer = webmap.layers.find(
              l => l.title === CONFIG.roadNetworkLayerTitle
            ) as FeatureLayer;

            const roadLayerSwipe = webmap.layers.find(
              l => l.title === CONFIG.roadNetworkLayerSwipeTitle
            ) as FeatureLayer;

            const laLayer = webmap.layers.find(
              l => l.title === CONFIG.laPolygonLayerTitle
            ) as FeatureLayer;

            if (!roadLayer) {
              throw new Error('Road network layer not found in WebMap');
            }

            // Wait for road layer to load
            await roadLayer.load();
            console.log('[Map Init] Road layer loaded from WebMap');

            // Configure LA layer
            if (laLayer) {
              laLayer.visible = false;
              laLayer.opacity = 0.7;
              webmap.layers.reorder(laLayer, 0);
            }

            // Store state
            set({
              mapView: view,
              webmap,
              roadLayer,
              roadLayerSwipe,
              laLayer,
              initialExtent: view.extent ?? null,
              loading: false,
              loadingMessage: null,
              mapInitialized: true,
              error: null
            });

            console.log('[Map Init] Waiting for road layer to be ready for rendering...');
            await RendererService.waitForLayerReady(roadLayer);
            console.log('[Map Init] Road layer is ready');

            // Apply initial renderer
            console.log('[Map Init] Applying initial renderer...');
            const renderer = RendererService.createRenderer(
              state.activeKpi,
              state.currentFilters.year,
              state.themeMode,
              true
            );

            await RendererService.applyRendererWithVerification(
              roadLayer,
              renderer,
              {
                maxRetries: 3,
                retryDelay: 100,
                logProgress: true
              }
            );

            console.log('[Map Init] ✅ Initial renderer applied successfully');

            // Preload renderers in background
            RendererService.preloadAllRenderers(state.themeMode).catch(err =>
              console.warn('Background renderer preloading failed:', err)
            );

            console.log('✅ Map initialization completed successfully');
            message.success('Map loaded successfully');

          } catch (e: any) {
            console.error('Map initialization error:', e);
            const errorMsg = e?.message || 'Failed to initialize map';
            set({
              error: errorMsg,
              loading: false,
              loadingMessage: null,
              mapInitialized: false
            });
            message.error(errorMsg);
          }
        },

        /**
         * Initialize layers only for Report pages using direct loading
         * This does NOT create a map view, only loads the feature layers
         */
        initializeLayersDirectly: async () => {
          const state = get();

          if (state.roadLayer && state.roadLayer.loaded) {
            console.log('[Layer Init] Layers already loaded');
            return;
          }

          set({ loading: true, loadingMessage: 'Loading data layers...' });

          try {
            console.log('[Layer Init] Loading layers directly...');

            // Use LayerService to load layers directly
            const layerResult = await LayerService.loadLayers('direct', {
              enableLogging: true,
              timeout: 10000
            });

            if (!layerResult.roadLayer) {
              throw new Error('Failed to load road network layer');
            }

            console.log(`[Layer Init] Layers loaded in ${layerResult.loadTimeMs}ms`);

            // Store layers
            set({
              roadLayer: layerResult.roadLayer,
              roadLayerSwipe: layerResult.roadLayerSwipe,
              laLayer: layerResult.laLayer,
              loading: false,
              loadingMessage: null,
              error: null
            });

            console.log('✅ Layers initialized successfully');
            message.success('Data layers loaded successfully');

          } catch (e: any) {
            console.error('Layer initialization error:', e);
            const errorMsg = e?.message || 'Failed to load data layers';
            set({
              error: errorMsg,
              loading: false,
              loadingMessage: null
            });
            message.error(errorMsg);
          }
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

        setShowFilters: (b) => {
          if (b) {
            // Turn off Chart and Compare when enabling Filters
            set({
              showFilters: true,
              showChart: false,
              showSwipe: false
            });
          } else {
            set({ showFilters: false });
          }
        },
        setShowStats: (b) => set({ showStats: b }),
        setShowChart: (b) => {
          if (b) {
            // Turn off Filters and Compare when enabling Chart
            set({
              showChart: true,
              showFilters: false,
              showSwipe: false
            });
          } else {
            set({ showChart: false });
          }
        },
        setShowSwipe: (b) => {
          if (b) {
            // Turn off Filters and Chart when enabling Compare
            set({
              showSwipe: true,
              showFilters: false,
              showChart: false
            });
          } else {
            set({ showSwipe: false });
          }
        },

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
          const state = get();

          // Preserve current year selection
          const currentYear = state.currentFilters.year || CONFIG.defaultYear;

          // Reset filters while maintaining year
          const resetFilters = {
            localAuthority: [],
            subgroup: [],
            route: [],
            year: currentYear,
          };

          set({
            currentFilters: resetFilters,
            currentStats: null,
            appliedFiltersCount: 0,
            loading: true,
            loadingMessage: 'Clearing filters...'
          });

          try {
            if (state.roadLayer) {
              (state.roadLayer as any).definitionExpression = '1=1';
              await state.roadLayer.when();
            }

            if (state.mapView && state.initialExtent) {
              await state.mapView.goTo(state.initialExtent, {
                duration: 1000,
                easing: 'ease-in-out'
              });
            }

            await state.updateRenderer();
            await state.calculateStatistics();

            message.success(`Filters cleared. Showing all ${state.activeKpi.toUpperCase()} data for ${currentYear}`);
          } catch (error) {
            console.error('Error clearing filters:', error);
            message.error('Failed to reset filters completely');
          } finally {
            set({ loading: false, loadingMessage: null });
          }
        },

        applyFilters: async () => {
          const state = get();
          const { roadLayer } = state;

          if (!roadLayer || !roadLayer.loaded) {
            message.error('Road layer not loaded. Please refresh the page.');
            return;
          }

          // Validate filters before applying
          const validatedFilters = state.validateAndFixFilters();

          // Build definition expression (year NOT included in WHERE clause)
          const where = QueryService.buildDefinitionExpression({
            localAuthority: validatedFilters.localAuthority,
            subgroup: validatedFilters.subgroup,
            route: validatedFilters.route
          });

          const filterCount =
            (validatedFilters.localAuthority.length > 0 ? 1 : 0) +
            (validatedFilters.subgroup.length > 0 ? 1 : 0) +
            (validatedFilters.route.length > 0 ? 1 : 0);

          set({ appliedFiltersCount: filterCount, loading: true, loadingMessage: 'Applying filters...' });

          try {
            // Apply definition expression
            (roadLayer as any).definitionExpression = where;

            // Wait for layer to process the definition change
            await roadLayer.when();

            // Zoom to the filtered extent
            await QueryService.zoomToDefinition(state.mapView, roadLayer, where);

            // Update renderer
            await state.updateRenderer();

            set({ showStats: true });
            await state.calculateStatistics();

            if (filterCount > 0) {
              message.success(`${filterCount} filter${filterCount > 1 ? 's' : ''} applied`);
            } else {
              message.info('Showing all data for ' + validatedFilters.year);
            }

          } catch (error) {
            console.error('Error applying filters:', error);
            message.error('Failed to apply filters completely');
            await state.calculateStatistics();
          } finally {
            set({ loading: false, loadingMessage: null });
          }
        },

        calculateStatistics: async () => {
          const state = get();
          const { roadLayer, activeKpi } = state;

          if (!roadLayer) {
            console.warn('[Statistics] Cannot calculate - road layer not loaded');
            return;
          }

          // Validate filters before calculating
          const validatedFilters = state.validateAndFixFilters();
          if (typeof validatedFilters.year !== 'number') {
            console.error('[Statistics] Year validation failed, cannot calculate statistics');
            return;
          }

          try {
            const stats = await StatisticsService.computeSummary(
              roadLayer,
              validatedFilters,
              activeKpi
            );

            if (stats.totalSegments === 0) {
              message.warning('No road segments match the current filters');
              set({
                currentStats: stats
              });
            } else {
              set({ currentStats: stats });
              console.log(`Statistics calculated: ${stats.totalSegments} segments, ` +
                        `${stats.totalLengthKm} km total length`);
            }
          } catch (error) {
            console.error('Error calculating statistics:', error);
            message.error('Failed to calculate statistics');

            const year = validatedFilters.year || CONFIG.defaultYear;
            const emptyStats: SummaryStatistics = {
              kpi: activeKpi.toUpperCase(),
              year: year,
              avgValue: 0,
              minValue: 0,
              maxValue: 0,
              totalSegments: 0,
              totalLengthKm: 0,
              veryGoodCount: 0,
              goodCount: 0,
              fairCount: 0,
              poorCount: 0,
              veryPoorCount: 0,
              veryGoodPct: 0,
              goodPct: 0,
              fairPct: 0,
              poorPct: 0,
              veryPoorPct: 0,
              fairOrBetterPct: 0,
              lastUpdated: new Date().toISOString()
            };
            set({ currentStats: emptyStats });
          }
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
          const state = get();
          const currentFilters = { ...state.currentFilters };

          // Validate year (single value)
          if (typeof currentFilters.year === 'string') {
            const numYear = parseInt(currentFilters.year, 10);
            if (!isNaN(numYear) && numYear >= 2000 && numYear <= 2030) {
              console.warn(`[Data Validation] Converted year from string "${currentFilters.year}" to number ${numYear}`);
              currentFilters.year = numYear;
            } else {
              console.warn(`[Data Validation] Invalid year value "${currentFilters.year}", using default`);
              currentFilters.year = CONFIG.defaultYear;
            }
          } else if (typeof currentFilters.year !== 'number' || currentFilters.year < 2000 || currentFilters.year > 2030) {
            console.warn('[Data Validation] Year filter missing or invalid, resetting to default');
            currentFilters.year = CONFIG.defaultYear;
          }

          // Log the final validated year for debugging
          console.log('[Data Validation] Final year filter:', currentFilters.year);

          // Update state with validated filters
          set({ currentFilters });
          return currentFilters;
        },

        calculateChartFilteredStatistics: async () => {
          const state = get();
          const { roadLayer, chartSelections, currentFilters } = state;

          if (!roadLayer || chartSelections.length === 0) {
            set({
              chartFilteredStats: null,
              isCalculatingChartStats: false
            });
            return;
          }

          set({ isCalculatingChartStats: true });

          try {
            console.log('[Chart Stats] Calculating for selections:', chartSelections);

            const stats = await StatisticsService.computeChartFilteredStatistics(
              roadLayer,
              chartSelections,
              currentFilters
            );

            set({
              chartFilteredStats: stats,
              isCalculatingChartStats: false
            });

            console.log('[Chart Stats] Calculated:', stats);

          } catch (error) {
            console.error('Error calculating chart-filtered statistics:', error);
            set({
              chartFilteredStats: null,
              isCalculatingChartStats: false
            });
          }
        },

        addChartSelection: (selection) => {
          const state = get();
          const exists = state.chartSelections.some(s =>
            s.group === selection.group &&
            s.condition === selection.condition &&
            s.kpi === selection.kpi &&
            s.year === selection.year
          );

          if (!exists) {
            set({
              chartSelections: [...state.chartSelections, selection],
              isChartFilterActive: true
            });
            console.log('[Chart Selection] Added:', selection);
          }
        },

        removeChartSelection: (selection) => {
          const state = get();
          const filtered = state.chartSelections.filter(s => !(
            s.group === selection.group &&
            s.condition === selection.condition &&
            s.kpi === selection.kpi &&
            s.year === selection.year
          ));

          set({
            chartSelections: filtered,
            isChartFilterActive: filtered.length > 0
          });
          console.log('[Chart Selection] Removed:', selection);
        },

        clearChartSelections: () => {
          set({
            chartSelections: [],
            isChartFilterActive: false,
            chartFilteredStats: null
          });
          console.log('[Chart Selection] Cleared all selections');
        },

        toggleChartSelection: (selection, isMultiSelect) => {
          const state = get();
          const exists = state.chartSelections.some(s =>
            s.group === selection.group &&
            s.condition === selection.condition &&
            s.kpi === selection.kpi &&
            s.year === selection.year
          );

          if (isMultiSelect) {
            if (exists) {
              state.removeChartSelection(selection);
            } else {
              state.addChartSelection(selection);
            }
          } else {
            if (exists && state.chartSelections.length === 1) {
              state.clearChartSelections();
            } else {
              set({
                chartSelections: [selection],
                isChartFilterActive: true
              });
              console.log('[Chart Selection] Replaced with:', selection);
            }
          }

          // Auto-calculate chart statistics after selection change
          setTimeout(() => {
            state.calculateChartFilteredStatistics();
          }, 100);
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
          const { laLayer, activeKpi, currentFilters, laMetricType, themeMode } = get();

          if (!laLayer) {
            console.warn('Cannot update renderer: LA layer not set');
            return;
          }
          // Get the active year (use first selected year)
          const year = currentFilters.year || CONFIG.defaultYear;

          console.log(`Updating LA renderer: ${activeKpi}/${year}/${laMetricType}/${themeMode}`);

          try {
            // Create renderer using LARendererService with continuous gradient
            // Pass the layer to enable max value queries for dynamic scaling
            const renderer = await LARendererService.createLARenderer(
              activeKpi,
              year,
              laMetricType,
              themeMode,
              laLayer
            );

            // Apply renderer to layer
            laLayer.renderer = renderer;

            console.log('✓ LA layer renderer updated with continuous gradient');
          } catch (error) {
            console.error('Error updating LA layer renderer:', error);
          }
        },

        enterSwipeMode: () => {
          const { roadLayer, laLayer, laLayerVisible } = get();
          if (roadLayer) {
            set({
              preSwipeDefinitionExpression: (roadLayer as any).definitionExpression || '1=1',
              isSwipeActive: true
            });
          }
          if (laLayer) {
            set({ preSwipeLALayerVisible: laLayerVisible });
            laLayer.visible = false;
          }
          get().hideRoadNetworkForSwipe();
        },

        exitSwipeMode: () => {
          const { roadLayer, preSwipeDefinitionExpression, laLayer, preSwipeLALayerVisible } = get();
          if (roadLayer) {
            (roadLayer as any).definitionExpression = preSwipeDefinitionExpression || '1=1';
          }
          if (laLayer) {
            laLayer.visible = preSwipeLALayerVisible ?? false;
          }
          set({
            preSwipeDefinitionExpression: null,
            preSwipeLALayerVisible: null,
            isSwipeActive: false
          });
          get().restoreRoadNetworkVisibility();
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
        })
      }
    )
  )
);

export default useAppStore;
