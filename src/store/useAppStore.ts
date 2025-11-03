import { create } from 'zustand';
import { persist, devtools } from 'zustand/middleware';
import type MapView from '@arcgis/core/views/MapView';
import type WebMap from '@arcgis/core/WebMap';
import type FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import type Extent from '@arcgis/core/geometry/Extent';
import { message } from 'antd'; // ADD LAMetricType
import {
  CONFIG,
  LA_LAYER_CONFIG,
  SUBGROUP_CODE_TO_FIELD,
  SubgroupOption,
  LAMetricType
} from '@/config/appConfig';
import { KPIKey, KPI_LABELS } from '@/config/kpiConfig';
import MapViewService from '@/services/MapViewService';
import LARendererService from '@/services/LARendererService';
import QueryService from '@/services/QueryService';
import StatisticsService from '@/services/StatisticsService';
import RendererService from '@/services/RendererService'; // Keep this import
import type { FilterState, SummaryStatistics } from '@/types';

interface ChartSelection {
  group: string;
  condition: string;
  kpi: KPIKey;
  year: number;
}

type ThemeMode = 'light' | 'dark';

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
  // ADD THESE:
  chartSelections: ChartSelection[];
  isChartFilterActive: boolean;
  // ADD THESE:
  chartFilteredStats: SummaryStatistics | null;
  isCalculatingChartStats: boolean;

  // NEW: LA Layer State
  laLayer: __esri.FeatureLayer | null;
  laLayerVisible: boolean;
  laMetricType: LAMetricType;

  // Actions
  initializeMap: (containerId: string) => Promise<void>;
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
  updateRenderer: () => void;
  validateAndFixFilters: () => FilterState;
  
  // ADD THIS:
  calculateChartFilteredStatistics: () => Promise<void>;

  // ADD THESE:
  addChartSelection: (selection: ChartSelection) => void;
  removeChartSelection: (selection: ChartSelection) => void;
  clearChartSelections: () => void;
  toggleChartSelection: (selection: ChartSelection, isMultiSelect: boolean) => void;

  // New actions for Task 13
  setSwipeYears: (left: number, right: number) => void;
  setLALayer: (layer: __esri.FeatureLayer | null) => void;
  setLALayerVisible: (visible: boolean) => void;
  setLAMetricType: (metricType: LAMetricType) => void;
  updateLALayerRenderer: () => Promise<void>;  // Now async
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
        
        // ADD THESE:
        chartSelections: [],
        isChartFilterActive: false,
        
        // ADD THESE:
        chartFilteredStats: null,
        isCalculatingChartStats: false,

        // NEW: LA Layer Initial State
        laLayer: null,
        laLayerVisible: false,
        laMetricType: 'average',

        setError: (err) => set({ error: err }),
        setThemeMode: (mode: 'light' | 'dark') => {
          // Set the data-theme attribute on the root element
          document.documentElement.setAttribute('data-theme', mode);
          // Persist the theme choice in localStorage
          localStorage.setItem('rmo-theme', mode);

          set({ themeMode: mode });
    
          // Clear all renderer caches to force re-creation with the new theme
          RendererService.clearCache();
          LARendererService.clearCache();

          const { roadLayer, activeKpi, currentFilters, updateLALayerRenderer } = get();
    
          // Update road layer renderer
          if (roadLayer) {
            const year = currentFilters.year || CONFIG.defaultYear;
            // [SPRINT 1 / TASK-001] Also updated here to use createRenderer
            const renderer = RendererService.createRenderer(activeKpi, year, mode, true);
            roadLayer.renderer = renderer;
          }
    
          // NEW: Update LA layer renderer when theme changes
          void updateLALayerRenderer();  // Fire-and-forget async call

          console.log('Theme mode changed to:', mode);
        },

        setShowFilters: (b) => set({ showFilters: b, showChart: b ? false : get().showChart }),
        setShowStats: (b) => set({ showStats: b }),
        setShowChart: (b) => set({ showChart: b, showFilters: b ? false : get().showFilters }),
        setShowSwipe: (b) => set({ showSwipe: b }),
        setRoadLayerVisibility: (visible) => {
          const { roadLayer, roadLayerSwipe } = get();
          if (roadLayer) roadLayer.visible = visible;
          if (roadLayerSwipe) roadLayerSwipe.visible = visible;
          set({ roadLayerVisible: visible });
        },
        
        hideRoadNetworkForSwipe: () => {
          const { roadLayer, roadLayerSwipe } = get();
          if (roadLayer) roadLayer.visible = false;
          if (roadLayerSwipe) roadLayerSwipe.visible = false;
          set({ roadLayerVisible: false });
        },
        
        restoreRoadNetworkVisibility: () => {
          const { roadLayer, roadLayerSwipe } = get();
          if (roadLayer) roadLayer.visible = true;
          if (roadLayerSwipe) roadLayerSwipe.visible = true;
          set({ roadLayerVisible: true });
        },

        setActiveKpi: (k) => {
          set({ activeKpi: k });
          get().updateRenderer();
          get().calculateStatistics();
          // Update LA layer renderer when KPI changes
          void get().updateLALayerRenderer();  // Fire-and-forget async call
        },

        setFilters: (f) => {
          const currentFilters = get().currentFilters;
          const newFilters = { ...currentFilters, ...f };
          
          // Check if year changed
          const yearChanged = f.year !== undefined && f.year !== currentFilters.year;

          // Type-check and validate year if provided
          if (f.year !== undefined) {
            if (typeof f.year === 'string') {
              const parsed = parseInt(f.year, 10);
              if (!isNaN(parsed) && parsed >= 2000 && parsed <= 2030) {
                console.warn(`[SetFilters] Coerced year from string to number: "${f.year}"  ${parsed}`);
                newFilters.year = parsed;
              } else {
                console.warn(`[SetFilters] Invalid year "${f.year}", using default`);
                newFilters.year = CONFIG.defaultYear;
              }
            } else if (typeof f.year === 'number' && f.year >= 2000 && f.year <= 2030) {
              newFilters.year = f.year;
            } else {
              console.warn(`[SetFilters] Invalid year value, using default`);
              newFilters.year = CONFIG.defaultYear;
            }
          }
          
          set({ currentFilters: newFilters });
          
          const { roadLayer, activeKpi, themeMode, updateLALayerRenderer } = get();
          
          // Apply definition expression (year NOT included in WHERE clause)
          const definitionExpression = QueryService.buildDefinitionExpression({
            localAuthority: newFilters.localAuthority,
            subgroup: newFilters.subgroup,
            route: newFilters.route
          });
          
          if (roadLayer) {
            roadLayer.definitionExpression = definitionExpression;
            console.log('Applied definition expression:', definitionExpression);
            
            // Update renderer if year changed
            if (yearChanged) {
              const year = newFilters.year || CONFIG.defaultYear;
              // [SPRINT 1 / TASK-001] Also updated here to use createRenderer
              // Use createRenderer as requested
              const renderer = RendererService.createRenderer(activeKpi, year, themeMode, true);
              roadLayer.renderer = renderer;

              // NEW: Update LA layer renderer when year changes
              void updateLALayerRenderer();  // Fire-and-forget async call
            }
          }
        },

        clearAllFilters: async () => {
          const state = get();
          const timerLabel = '[Filters] clearAllFilters';
          console.time(timerLabel);
          const definitionLabel = `${timerLabel}:definition`;
          const extentLabel = `${timerLabel}:extent`;
          const deferredLabel = `${timerLabel}:deferred`;
          const rendererLabel = `${timerLabel}:updateRenderer`;
          const statisticsLabel = `${timerLabel}:statistics`;

          const safeTimeEnd = (label: string) => {
            try {
              console.timeEnd(label);
            } catch {
              // ignore missing timer
            }
          };

          const safeTimeLog = (label: string, message: string) => {
            if (typeof console.timeLog === 'function') {
              console.timeLog(label, message);
            }
          };

          const scheduleDeferred = (callback: () => void) => {
            if (typeof window !== 'undefined') {
              const idle = (window as any).requestIdleCallback;
              if (typeof idle === 'function') {
                return idle(() => callback());
              }
              return window.setTimeout(callback, 0);
            }

            return setTimeout(callback, 0);
          };
          
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
            console.time(definitionLabel);
            if (state.roadLayer) {
              (state.roadLayer as any).definitionExpression = '1=1';
              await state.roadLayer.when();
            }
            safeTimeEnd(definitionLabel);

            console.time(extentLabel);
            if (state.mapView && state.initialExtent) {
              await state.mapView.goTo(state.initialExtent, {
                duration: 1000,
                easing: 'ease-in-out'
              });
            }
            safeTimeEnd(extentLabel);
          } catch (error) {
            console.error('Error resetting filters (immediate phase):', error);
            message.error('Failed to reset filters completely');
            set({ loading: false, loadingMessage: null });
            safeTimeEnd(definitionLabel);
            safeTimeEnd(extentLabel);
            console.timeEnd(timerLabel);
            return;
          }

          await new Promise<void>((resolve) => {
            safeTimeLog(timerLabel, 'Scheduling deferred renderer and statistics work');

            scheduleDeferred(() => {
              console.time(deferredLabel);

              (async () => {
                try {
                  console.time(rendererLabel);
                  state.updateRenderer();
                  safeTimeEnd(rendererLabel);

                  console.time(statisticsLabel);
                  await state.calculateStatistics();
                  safeTimeEnd(statisticsLabel);

                  message.success(
                    `Filters cleared. Showing all ${state.activeKpi.toUpperCase()} data for ${currentYear}`,
                    3
                  );
                } catch (error) {
                  console.error('Error completing filter reset:', error);
                  message.error('Failed to reset filters completely');
                } finally {
                  set({ loading: false, loadingMessage: null });
                  safeTimeEnd(deferredLabel);
                  console.timeEnd(timerLabel);
                  resolve();
                }
              })();
            });
          });
        },

        /**
         * Validates and fixes filter state to ensure data integrity
         * @returns Validated FilterState
         */
        validateAndFixFilters: (): FilterState => {
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

        enterSwipeMode: () => {
          const { roadLayer } = get();
          if (roadLayer) {
            set({ 
              preSwipeDefinitionExpression: (roadLayer as any).definitionExpression || '1=1',
              isSwipeActive: true // Set active flag here
            });
          }
          get().hideRoadNetworkForSwipe();
        },

        /**
         * Restores the application state after exiting swipe mode.
         * It restores the saved filter definition to the main road layer.
         */
        exitSwipeMode: () => {
          const { roadLayer, preSwipeDefinitionExpression } = get();
          if (roadLayer) {
            (roadLayer as any).definitionExpression = preSwipeDefinitionExpression || '1=1'; // Restore filter
            roadLayer.visible = true; // Ensure road layer visibility is restored
          }
          set({ 
            preSwipeDefinitionExpression: null,
            isSwipeActive: false // Clear active flag here
          });
          get().restoreRoadNetworkVisibility();
        },

        initializeMap: async (containerId: string) => {
          const state = get();
          
          // GUARD 1: Check if map is already initialized
          if (state.mapInitialized && state.mapView) {
            console.log('Map already initialized, skipping re-initialization');
            
            // Just ensure the view container is correct
            const container = document.getElementById(containerId);
            if (container && state.mapView.container !== container) {
              console.log('Updating map container');
              (state.mapView as any).container = container;
            }
            
            return; // Early return - map already exists
          }
          
          // GUARD 2: Prevent concurrent initialization attempts
          if (state.loading && state.mapInitialized) {
            console.log('Map initialization already in progress');
            return;
          }
          
          try {
            set({ loading: true, loadingMessage: 'Loading map...', error: null });
            
            // Check if container exists
            const container = document.getElementById(containerId);
            if (!container) {
              throw new Error(`Container element with id "${containerId}" not found`);
            }
            
            // GUARD 3: Check if a map view is already attached to this container
            if ((container as any).__esri_mapview) {
              console.warn('Container already has a map view attached, cleaning up');
              const existingView = (container as any).__esri_mapview;
              if (existingView && existingView.destroy) {
                existingView.destroy();
              }
              delete (container as any).__esri_mapview;
            }
            
            console.log('Initializing new map view...');
            const { view, webmap } = await MapViewService.initializeMapView(
              containerId,
              CONFIG.webMapId
            );

            // Store reference on container for future guard checks
            (container as any).__esri_mapview = view;
            
            const road = webmap.allLayers.find(
              (l: any) => l.title === CONFIG.roadNetworkLayerTitle
            ) as FeatureLayer | undefined;
            
            const roadSwipe = webmap.allLayers.find(
              (l: any) => l.title === CONFIG.roadNetworkLayerSwipeTitle
            ) as FeatureLayer | undefined;

            // Find single LA polygon layer
            const laLayer = webmap.allLayers.find(
              (l: any) => l.title === CONFIG.laPolygonLayerTitle // Use the config variable
            ) as FeatureLayer | undefined;

            if (laLayer) {
              console.log('✓ Found LA layer:', laLayer.title);
              await laLayer.load();
              laLayer.visible = false; // Hidden by default
              laLayer.opacity = 0.7;

              // Position below road network
              if (road) {
                const roadIndex = webmap.layers.indexOf(road as any);
                webmap.reorder(laLayer, roadIndex);
              }
            }

            if (!road) {
              message.warning('Road network layer not found. Check layer title in config.');
            }

            set({
              mapView: view,
              webmap,
              roadLayer: road ?? null,
              roadLayerSwipe: roadSwipe ?? null,
              initialExtent: view.extent ?? null,
              laLayer: laLayer ?? null,
              loading: false,
              loadingMessage: null,
              mapInitialized: true,
              error: null
            });
            
            // Apply initial renderer if layer is available
            if (road) {
              get().updateRenderer();
            }

            // Preload all other renderers in the background during idle time
            // to make subsequent KPI/year changes instantaneous.
            RendererService.preloadAllRenderers(get().themeMode).catch(err =>
              console.warn('Background renderer preloading failed:', err)
            );

            if (state.mapView) { // This destroys the *previous* view, which is correct
              state.mapView.destroy();
            }
            
            console.log('Map initialization completed successfully');
          } catch (e: any) {
            console.error('Map initialization error:', e);
            const errorMsg = e?.message || 'Failed to initialize map';
            set({ 
              error: errorMsg, 
              loading: false,
              loadingMessage: null,
              mapInitialized: false // Reset on error
            });
            message.error(errorMsg);
          }
        },

        applyFilters: async () => {
          const state = get();
          const { roadLayer } = state;

          if (!roadLayer) {
            message.error('Road layer not loaded yet');
            return;
          }

          // Validate filters before applying
          const validatedFilters = state.validateAndFixFilters();
          if (typeof validatedFilters.year !== 'number') {
            console.error('[Filters] Year validation failed, cannot apply filters.');
            message.error('Year filter is invalid. Please refresh the page.');
            set({ 
              currentStats: null,
              showStats: false 
            });
            return;
          }

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
          
          set({ appliedFiltersCount: filterCount });

          try {
            // Apply definition expression
            (roadLayer as any).definitionExpression = where;
            
            // CRITICAL FIX: Wait for layer to process the definition change
            await roadLayer.when();
            
            // THEN zoom to the filtered extent
            await QueryService.zoomToDefinition(state.mapView, roadLayer, where);
            
            // THEN update renderer (this will refresh the layer)
            state.updateRenderer();
            
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
         * Updates the road layer renderer based on current KPI, year, and theme.
         * Uses cached renderers for performance (90-95% faster for cache hits).
         * Applies updates in requestAnimationFrame for non-blocking execution.
         */
        updateRenderer: () => {
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
            // Obtain renderer (cached if possible - major performance win)
            const renderer = RendererService.createRenderer(activeKpi, year, themeMode, true);
            
            // Apply renderer in next animation frame for non-blocking update
            requestAnimationFrame(() => {
              try {
                (roadLayer as any).renderer = renderer;
                
                if (state.roadLayerSwipe) {
                  const swipeRenderer = renderer.clone();
                  (state.roadLayerSwipe as any).renderer = swipeRenderer;
                  state.roadLayerSwipe.refresh();
                }
                
                const duration = performance.now() - startTime;
                const wasCached = duration < 10; // Cache hits are typically <10ms
                
                console.log(
                  `[Renderer] ${wasCached ? 'Cached' : 'New'} - Updated ${activeKpi}/${year} ` +
                  `in ${duration.toFixed(2)}ms`
                );
                
                message.success(`Showing ${KPI_LABELS[activeKpi]} for ${year}`, 2);
              } catch (error) {
                console.error('[Renderer] Failed to apply renderer:', error);
                message.error('Failed to update map visualization');
              }
            });
          } catch (error) {
            console.error('[Renderer] Error creating renderer:', error);
            message.error('Failed to create renderer');
          }
        },

        // ADD THIS NEW METHOD:
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

        // ADD THESE NEW METHODS:
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
            chartFilteredStats: null // ADD: Clear chart stats
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

          // ADD: Auto-calculate chart statistics after selection change
          setTimeout(() => {
            state.calculateChartFilteredStatistics();
          }, 100);
        }, // Fixed: Added missing comma

        // ========================================
        // LA LAYER MANAGEMENT
        // ========================================

        /**
         * Set the LA polygon layer reference
         */
        setLALayer: (layer: __esri.FeatureLayer | null) => {
          console.log('Setting LA layer:', layer?.title);
          set({ laLayer: layer });
          
          // Apply initial renderer if layer exists
          if (layer) {
            const { updateLALayerRenderer } = get();
            void updateLALayerRenderer();  // Fire-and-forget async call
          }
        },

        /**
         * Toggle LA layer visibility
         */
        setLALayerVisible: (visible: boolean) => {
          const { laLayer } = get();
          
          set({ laLayerVisible: visible });
          
          if (laLayer) {
            laLayer.visible = visible;
            console.log(`LA layer visibility set to: ${visible}`);
          }
        },

        /**
         * Change LA layer metric type (average vs fairOrBetter)
         */
        setLAMetricType: (metricType: LAMetricType) => {
          set({ laMetricType: metricType });

          // Update renderer when metric type changes
          const { updateLALayerRenderer } = get();
          void updateLALayerRenderer();  // Fire-and-forget async call
        },

        setSwipeYears: (left, right) => {
          set({ leftSwipeYear: left, rightSwipeYear: right });
        },

        /**
         * Update LA layer renderer based on current KPI, year, and metric type
         * MODIFIED: Now async to support dynamic max value queries
         */
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
      }),
      { 
        name: 'rmo-app',
        // IMPORTANT: Exclude all map-related objects and temporary UI state from persistence
        // Only persist user preferences and selections
        partialize: (state) => ({
          themeMode: state.themeMode, // Persist themeMode
          activeKpi: state.activeKpi,
          currentFilters: state.currentFilters,
          siderCollapsed: state.siderCollapsed,
          // Explicitly exclude: mapView, webmap, roadLayer, roadLayerSwipe, 
          // initialExtent, mapInitialized, loading, error, laPolygonLayers, swipe years/page
        })
      }
    )
  )
);

export default useAppStore;
