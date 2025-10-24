import { create } from 'zustand';
import { persist, devtools } from 'zustand/middleware';
import type MapView from '@arcgis/core/views/MapView';
import type WebMap from '@arcgis/core/WebMap';
import type FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import type Extent from '@arcgis/core/geometry/Extent';
import { message } from 'antd'; // ADD LAMetricType
import { 
  CONFIG, 
  KPI_LABELS, 
  KPIKey,
  LA_LAYER_CONFIG,
  SUBGROUP_CODE_TO_FIELD, 
  SubgroupOption 
  , LAMetricType
} from '@/config/appConfig';
import MapViewService from '@/services/MapViewService';
import LARendererService from '@/services/LARendererService';
import QueryService from '@/services/QueryService';
import StatisticsService from '@/services/StatisticsService';
import RendererService from '@/services/RendererService';
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
  mapView: MapView | null;
  webmap: WebMap | null;
  roadLayer: FeatureLayer | null;
  roadLayerSwipe: FeatureLayer | null;
  initialExtent: Extent | null;
  error: string | null;
  preSwipeDefinitionExpression: string | null;
  mapInitialized: boolean;

  // Swipe / LA polygon layers
  laPolygonLayers: Map<string, FeatureLayer> | null;
  currentPage: 'overview' | 'condition-summary';
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
  setCurrentPage: (page: 'overview' | 'condition-summary') => void;
  setSwipeYears: (left: number, right: number) => void;
  updateLALayerVisibility: () => void;
  setLaLayersVisibility: (visible: boolean) => void;

  // NEW: LA Layer Methods
  setLALayer: (layer: __esri.FeatureLayer | null) => void;
  setLALayerVisible: (visible: boolean) => void;
  setLAMetricType: (metricType: LAMetricType) => void;
  updateLALayerRenderer: () => void;
  enterSwipeMode: () => void;
  exitSwipeMode: () => void;
}

const initialFilters: FilterState = {
  localAuthority: [],
  subgroup: [],
  route: [],
  year: CONFIG.defaultYears.slice()
};

const useAppStore = create<AppState>()(
  devtools(
    persist(
      (set, get) => ({
        loading: true,
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

        // Task 13: initial state
        laPolygonLayers: null,
        currentPage: 'overview',
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
            const year = currentFilters.year[0] || CONFIG.defaultYears[0];
            const renderer = RendererService.createRenderer(activeKpi, year, mode);
            roadLayer.renderer = renderer;
          }
    
          // NEW: Update LA layer renderer when theme changes
          updateLALayerRenderer();
    
          console.log('Theme mode changed to:', mode);
        },

        setShowFilters: (b) => set({ showFilters: b, showChart: b ? false : get().showChart }),
        setShowStats: (b) => set({ showStats: b }),
        setShowChart: (b) => set({ showChart: b, showFilters: b ? false : get().showFilters }),
        setShowSwipe: (b) => set({ showSwipe: b }),

        // Task 13: actions
        setCurrentPage: (page) => {
          const state = get();
          if (page === 'condition-summary') {
            // Hide road layers and enable auto-start for swipe
            state.hideRoadNetworkForSwipe();
            set({ currentPage: page, swipePanelAutoStart: true, showSwipe: true });
            // Ensure the correct LA layers become visible
            state.updateLALayerVisibility();
          } else {
            // Restore road layers when leaving condition summary
            state.restoreRoadNetworkVisibility();
            // MODIFICATION: Explicitly hide all LA polygon layers
            state.setLaLayersVisibility(false);
            set({ currentPage: page, swipePanelAutoStart: false });
          }
        },
        setSwipeYears: (left, right) => {
          set({ leftSwipeYear: left, rightSwipeYear: right });
          get().updateLALayerVisibility();
        },
        updateLALayerVisibility: () => {
          const { laPolygonLayers, activeKpi, leftSwipeYear, rightSwipeYear, currentPage } = get();
          if (!laPolygonLayers || currentPage !== 'condition-summary') return;
        
          // Use the LA_LAYER_CONFIG to generate the correct layer names
          const leftLayerName = LA_LAYER_CONFIG.layerTitlePattern(activeKpi, leftSwipeYear);
          const rightLayerName = LA_LAYER_CONFIG.layerTitlePattern(activeKpi, rightSwipeYear);
        
          console.log('Looking for layers:', leftLayerName, rightLayerName);
          console.log('Available layers:', Array.from(laPolygonLayers.keys()));
        
          laPolygonLayers.forEach((layer, name) => {
            layer.visible = (name === leftLayerName || name === rightLayerName);
          });
        },
        // ADD THIS NEW HELPER METHOD:
        setLaLayersVisibility: (visible) => {
          const { laPolygonLayers } = get();
          if (laPolygonLayers) {
            laPolygonLayers.forEach(layer => {
              layer.visible = visible;
            });
            console.log(`All LA polygon layers set to visible: ${visible}`);
          }
        },
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
          // Optionally ensure LA layers reflect KPI change:
          get().updateLALayerRenderer(); // NEW: Update LA layer renderer when KPI changes
          get().updateLALayerVisibility();
        },

        setFilters: (f) => {
          const currentFilters = get().currentFilters;
          const newFilters = { ...currentFilters, ...f };
          
          // Check if year changed
          const yearChanged = f.year && 
            JSON.stringify(f.year) !== JSON.stringify(currentFilters.year);

          // Type-check years immediately when set
          if (newFilters.year && Array.isArray(newFilters.year)) {
            newFilters.year = newFilters.year
              .map(y => {
                if (typeof y === 'string') {
                  const parsed = parseInt(y, 10);
                  if (!isNaN(parsed)) {
                    console.warn(`[SetFilters] Coerced year from string to number: "${y}" → ${parsed}`);
                    return parsed;
                  }
                }
                return y;
              })
              .filter(y => typeof y === 'number' && y >= 2000 && y <= 2030);
          }

          // Validate year selection immediately when filters change
          if (!newFilters.year || newFilters.year.length === 0) {
            // Don't allow empty year selection
            message.warning('At least one survey year must be selected. Defaulting to most recent year.');
            newFilters.year = [CONFIG.defaultYears[0]];
          }
          
          set({ currentFilters: newFilters });
          
          const { roadLayer, activeKpi, themeMode, updateLALayerRenderer } = get();
          
          // Apply definition expression
          const definitionExpression = QueryService.buildDefinitionExpression(newFilters);
          
          if (roadLayer) {
            roadLayer.definitionExpression = definitionExpression;
            console.log('Applied definition expression:', definitionExpression);
            
            // Update renderer if year changed
            if (yearChanged) {
              const year = newFilters.year[0] || CONFIG.defaultYears[0];
              // Use createRenderer as requested
              const renderer = RendererService.createRenderer(activeKpi, year, themeMode);
              roadLayer.renderer = renderer;
              
              // NEW: Update LA layer renderer when year changes
              updateLALayerRenderer();
            }
          }
        },

        clearAllFilters: async () => {
          const state = get();
          
          // Preserve current year selection
          const currentYear = state.currentFilters.year.length > 0 
            ? state.currentFilters.year 
            : [CONFIG.defaultYears[0]];
          
          // Reset filters while maintaining year
          const resetFilters = { 
            localAuthority: [],
            subgroup: [],
            route: [],
            year: currentYear
          };
          
          set({ 
            currentFilters: resetFilters,
            currentStats: null,
            appliedFiltersCount: 0,
            loading: true
          });
          
          try {
            // CRITICAL FIX: Proper sequencing
            // 1. Reset layer definition expression FIRST
            if (state.roadLayer) {
              (state.roadLayer as any).definitionExpression = '1=1';
              // Wait for layer to process the definition change
              await state.roadLayer.when();
            }
            
            // 2. THEN update renderer (this will refresh the layer internally)
            state.updateRenderer();
            
            // 3. THEN reset map extent
            if (state.mapView && state.initialExtent) {
              await state.mapView.goTo(state.initialExtent, {
                duration: 1000,
                easing: 'ease-in-out'
              });
            }
            
            // 4. Finally recalculate statistics
            await state.calculateStatistics();
            
            message.success(
              `Filters cleared. Showing all ${state.activeKpi.toUpperCase()} data for ${currentYear[0]}`,
              3
            );
            
          } catch (error) {
            console.error('Error resetting filters:', error);
            message.error('Failed to reset filters completely');
          } finally {
            set({ loading: false });
          }
        },

        // (1) Enhanced validator replacing the previous implementation
        validateAndFixFilters: (): FilterState => {
          const state = get();
          const currentFilters = { ...state.currentFilters };
          
          // Ensure year array exists and contains only numbers
          if (!currentFilters.year || !Array.isArray(currentFilters.year)) {
            console.warn('[Data Validation] Year filter missing or invalid, resetting to default');
            currentFilters.year = [CONFIG.defaultYears[0]];
          } else {
            // Convert all year values to numbers and filter out invalid ones
            const validatedYears = currentFilters.year
              .map(y => {
                if (typeof y === 'string') {
                  const numYear = parseInt(y, 10);
                  if (!isNaN(numYear) && numYear >= 2000 && numYear <= 2030) {
                    console.warn(`[Data Validation] Converted year from string "${y}" to number ${numYear}`);
                    return numYear;
                  }
                  console.warn(`[Data Validation] Invalid year value "${y}" removed from filter`);
                  return null;
                }
                if (typeof y === 'number' && y >= 2000 && y <= 2030) {
                  return y;
                }
                console.warn(`[Data Validation] Invalid year value ${y} removed from filter`);
                return null;
              })
              .filter((y): y is number => y !== null);
            
            // Ensure at least one valid year remains
            if (validatedYears.length === 0) {
              console.warn('[Data Validation] No valid years after validation, using default');
              currentFilters.year = [CONFIG.defaultYears[0]];
            } else {
              currentFilters.year = validatedYears;
            }
          }
          
          // Log the final validated years for debugging
          console.log('[Data Validation] Final year filter:', currentFilters.year);
          
          // Update state with validated filters
          set({ currentFilters });
          return currentFilters;
        },

        enterSwipeMode: () => {
          const { roadLayer } = get();
          if (roadLayer) {
            set({ preSwipeDefinitionExpression: (roadLayer as any).definitionExpression || '1=1' });
          }
        },

        /**
         * Restores the application state after exiting swipe mode.
         * It restores the saved filter definition to the main road layer.
         */
        exitSwipeMode: () => {
          const { roadLayer, preSwipeDefinitionExpression } = get();
          if (roadLayer) {
            (roadLayer as any).definitionExpression = preSwipeDefinitionExpression || '1=1';
            // Make the layer visible only if a filter was active before swiping
            roadLayer.visible = preSwipeDefinitionExpression !== '1=1';
          }
          set({ preSwipeDefinitionExpression: null });
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
            set({ loading: true, error: null });
            
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

            // Task 13: Find and store LA polygon layers
            const laLayers = new Map<string, FeatureLayer>();
            webmap.allLayers.forEach((layer: any) => {
              if (layer.title && typeof layer.title === 'string') {
                // Check if this is an Average KPI layer (e.g., "Average IRI 2018")
                if (layer.title.startsWith('Average ')) {
                  console.log('Found LA polygon layer:', layer.title);
                  laLayers.set(layer.title, layer as FeatureLayer);
                  (layer as FeatureLayer).visible = false; // Hide all initially
                }
              }
            });
            
            console.log(`Found ${laLayers.size} LA polygon layers`);
            set({ laPolygonLayers: laLayers });
            
            if (!road) {
              message.warning('Road network layer not found. Check layer title in config.');
            }
            
            set({
              mapView: view,
              webmap,
              roadLayer: road ?? null,
              roadLayerSwipe: roadSwipe ?? null,
              initialExtent: view.extent ?? null,
              loading: false,
              mapInitialized: true, // Mark as initialized
              error: null
            });
            
            // Apply initial renderer if layer is available
            if (road) {
              get().updateRenderer();
            }

            // Ensure LA layers visibility aligns with current state (likely all hidden initially)
            get().updateLALayerVisibility();

            if (state.mapView) {
              state.mapView.destroy();
            }
            
            console.log('Map initialization completed successfully');
          } catch (e: any) {
            console.error('Map initialization error:', e);
            const errorMsg = e?.message || 'Failed to initialize map';
            set({ 
              error: errorMsg, 
              loading: false,
              mapInitialized: false // Reset on error
            });
            message.error(errorMsg);
          }
        },

        applyFilters: async () => {
          const state = get();
          const { roadLayer } = state;
          
          // (2) Validate and log filters before applying
          const validatedFilters = state.validateAndFixFilters();
          console.log('[ApplyFilters] Using validated filters with years:', validatedFilters.year);
          
          if (!roadLayer) {
            message.error('Road layer is not loaded yet. Please wait a moment and try again.');
            set({ 
              currentStats: null,
              showStats: false 
            });
            return;
          }
          
          const clauses: string[] = [];

          

          // Local Authority filter
          if (validatedFilters.localAuthority.length) {
            const inVals = validatedFilters.localAuthority
              .map(v => `'${v.replace("'", "''")}'`)
              .join(',');
            clauses.push(`${CONFIG.fields.la} IN (${inVals})`);
          }

          // Subgroup filter - using centralized mapping from appConfig
          if (validatedFilters.subgroup.length) {
            const subgroupClauses: string[] = [];
            
            for (const fieldNameOrValue of validatedFilters.subgroup) {
              let fieldName: string | undefined;
              
              const subgroupOption = CONFIG.filters.subgroup.options?.find(opt => {
              if (typeof fieldNameOrValue === 'string') {
                return opt.value === fieldNameOrValue;
              } else if (typeof fieldNameOrValue === 'number') {
                return opt.code === fieldNameOrValue;
              }
              return false;
            });
              
              if (subgroupOption) {
                fieldName = subgroupOption.value as string;
              } else if (typeof fieldNameOrValue === 'number') {
                fieldName = SUBGROUP_CODE_TO_FIELD[fieldNameOrValue];
              } else {
                fieldName = fieldNameOrValue as string;
              }
              
              if (fieldName === 'Rural') {
                subgroupClauses.push(
                  `(Roads_Joined_IsFormerNa = 0 AND Roads_Joined_IsDublin = 0 AND ` +
                  `Roads_Joined_IsCityTown = 0 AND Roads_Joined_IsPeat = 0)`
                );
              } else if (fieldName && fieldName !== 'Rural') {
                subgroupClauses.push(`${fieldName} = 1`);
              }
            }
            
            if (subgroupClauses.length > 0) {
              clauses.push(`(${subgroupClauses.join(' OR ')})`);
            }
          }

          // Route filter
          if (validatedFilters.route.length) {
            const inVals = validatedFilters.route
              .map(v => `'${v.replace("'", "''")}'`)
              .join(',');
            clauses.push(`${CONFIG.fields.route} IN (${inVals})`);
          }
          
          const where = clauses.length ? clauses.join(' AND ') : '1=1';
          (roadLayer as any).definitionExpression = where;

          const filterCount = 
            (validatedFilters.localAuthority.length > 0 ? 1 : 0) +
            (validatedFilters.subgroup.length > 0 ? 1 : 0) +
            (validatedFilters.route.length > 0 ? 1 : 0)
          
          set({ appliedFiltersCount: filterCount });

          try {
            // Apply definition expression
            (roadLayer as any).definitionExpression = where;
            
            // CRITICAL FIX: Wait for layer to process the definition change
            await roadLayer.when();
            
            // THEN zoom to the filtered extent
            await QueryService.zoomToDefinition(state.mapView, roadLayer, where); // Fixed: Added zoomToDefinition to QueryService
            
            // THEN update renderer (this will refresh the layer)
            state.updateRenderer();
            
            set({ showStats: true });
            await state.calculateStatistics();
            
            if (filterCount > 0) {
              message.success(`${filterCount} filter${filterCount > 1 ? 's' : ''} applied`);
            } else {
              message.info('Showing all data for ' + validatedFilters.year[0]);
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

          // (3) Validate and guard before stats
          const validatedFilters = state.validateAndFixFilters();
          if (!validatedFilters.year.length || validatedFilters.year.some(y => typeof y !== 'number')) {
            console.error('[Statistics] Year validation failed, cannot calculate statistics');
            return;
          }
          
          try {
            const stats = await StatisticsService.computeSummary(
              roadLayer, // Fixed: Added computeSummary to StatisticsService
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
            
            const year = state.currentFilters.year[0] || CONFIG.defaultYears[0];
            const emptyStats: SummaryStatistics = {
              kpi: activeKpi.toUpperCase(),
              year: year,
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
              fairOrBetterPct: 0
            };
            set({ currentStats: emptyStats });
          }
        },
        
        updateRenderer: () => {
          const state = get();
          const { roadLayer, activeKpi, themeMode } = state;
          
          if (!roadLayer) {
            console.warn('Cannot update renderer: road layer not loaded');
            return;
          }
          
          const validatedFilters = state.validateAndFixFilters();
          const year = validatedFilters.year[0];
          
          try {
            const renderer = RendererService.createKPIRenderer(activeKpi, year, themeMode);
            (roadLayer as any).renderer = renderer;
            
            // CRITICAL FIX: Force layer to refresh with new renderer
            roadLayer.refresh();
            
            if (state.roadLayerSwipe) {
              if (!(state.roadLayerSwipe as any).renderer) {
                (state.roadLayerSwipe as any).renderer = renderer;
                // CRITICAL FIX: Also refresh swipe layer
                state.roadLayerSwipe.refresh();
              }
            }
            
            message.success(`Showing ${KPI_LABELS[activeKpi]} for ${year}`, 2);
          } catch (error) {
            console.error('Error updating renderer:', error);
            message.error('Failed to update map visualization');
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
            updateLALayerRenderer();
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
          updateLALayerRenderer();
        },

        /**
         * Update LA layer renderer based on current KPI, year, and metric type
         * This method will be implemented in Phase 6 when we integrate the renderer
         */
        updateLALayerRenderer: () => {
          const { laLayer, activeKpi, currentFilters, laMetricType, themeMode } = get();
          
          if (!laLayer) {
            console.warn('Cannot update renderer: LA layer not set');
            return;
          }
          // Get the active year (use first selected year)
          const year = currentFilters.year[0] || 2025; // default to 2025

          console.log(`Updating LA renderer: ${activeKpi}/${year}/${laMetricType}/${themeMode}`);
          
          try {
            // Create renderer using LARendererService
            const renderer = LARendererService.createLARenderer(activeKpi, year, laMetricType, themeMode);
            
            // Apply renderer to layer
            laLayer.renderer = renderer;
            
            console.log('✓ LA layer renderer updated successfully');
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
          themeMode: state.themeMode,
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
