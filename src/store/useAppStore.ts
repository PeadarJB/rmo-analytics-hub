import { create } from 'zustand';
import { persist, devtools } from 'zustand/middleware';
import type MapView from '@arcgis/core/views/MapView';
import type WebMap from '@arcgis/core/WebMap';
import type FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import type Extent from '@arcgis/core/geometry/Extent';
import { message } from 'antd';
import { 
  CONFIG, 
  KPI_LABELS, 
  KPIKey,
  SUBGROUP_CODE_TO_FIELD,
  SubgroupOption 
} from '@/config/appConfig';
import MapViewService from '@/services/MapViewService';
import QueryService from '@/services/QueryService';
import StatisticsService from '@/services/StatisticsService';
import RendererService from '@/services/RendererService';
import type { FilterState, SummaryStatistics } from '@/types';

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
  mapInitialized: boolean; // Add flag to track initialization status

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

  // Actions
  initializeMap: (containerId: string) => Promise<void>;
  setError: (err: string | null) => void;
  setThemeMode: (mode: ThemeMode) => void;

  setShowFilters: (b: boolean) => void;
  setShowStats: (b: boolean) => void;
  setShowChart: (b: boolean) => void;
  setShowSwipe: (b: boolean) => void;

  setActiveKpi: (k: KPIKey) => void;
  setFilters: (f: Partial<FilterState>) => void;
  clearAllFilters: () => void;
  applyFilters: () => Promise<void>;
  calculateStatistics: () => Promise<void>;
  updateRenderer: () => void;
  validateAndFixFilters: () => FilterState;
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
        mapInitialized: false, // Initialize as false

        siderCollapsed: true,
        showFilters: true,
        showStats: false,
        showChart: false,
        showSwipe: false,
        isSwipeActive: false,
        themeMode: 'light',

        activeKpi: CONFIG.defaultKPI,
        currentFilters: initialFilters,
        currentStats: null,
        appliedFiltersCount: 0,

        setError: (err) => set({ error: err }),
        setThemeMode: (mode) => set({ themeMode: mode }),

        setShowFilters: (b) => set({ showFilters: b, showChart: b ? false : get().showChart }),
        setShowStats: (b) => set({ showStats: b }),
        setShowChart: (b) => set({ showChart: b, showFilters: b ? false : get().showFilters }),
        setShowSwipe: (b) => set({ showSwipe: b }),

        setActiveKpi: (k) => {
          set({ activeKpi: k });
          get().updateRenderer();
          get().calculateStatistics();
        },

        setFilters: (f) => {
          const currentFilters = get().currentFilters;
          const newFilters = { ...currentFilters, ...f };
          
          // Validate year selection immediately when filters change
          if (newFilters.year.length === 0) {
            // Don't allow empty year selection
            message.warning('At least one survey year must be selected. Defaulting to most recent year.');
            newFilters.year = [CONFIG.defaultYears[0]];
          }
          
          set({ currentFilters: newFilters });
        },

        clearAllFilters: () => {
          set({ 
            currentFilters: { 
              ...initialFilters, 
              year: [CONFIG.defaultYears[0]] // Always keep at least one year selected
            }, 
            currentStats: null,
            appliedFiltersCount: 0 
          });
          message.info('Filters cleared. Showing data for ' + CONFIG.defaultYears[0]);
        },

        validateAndFixFilters: (filters: Partial<FilterState>): Partial<FilterState> => {
  if (filters.year && Array.isArray(filters.year)) {
    const originalYears = [...filters.year];
    let cleanYears: (number | null)[] = originalYears.map(y => {
      if (typeof y === 'string') {
        const numYear = parseInt(y, 10);
        if (!isNaN(numYear)) {
          console.warn(`[Data Validation] Coerced year value from string "${y}" to number ${numYear}.`);
          return numYear;
        }
        console.warn(`[Data Validation] Invalid year string "${y}" detected and removed.`);
        return null; // Mark for removal if parsing fails
      }
      return y;
    });

    // Filter out any null values that resulted from failed parsing
    let validYears = cleanYears.filter(y => y !== null) as number[];

    // If the filter resulted in an empty array, default to a valid year
    if (validYears.length === 0) {
      const defaultYear = 2025; // Default from available survey years [cite: 204]
      console.warn(`[Data Validation] Year filter was empty or contained only invalid years. Resetting to default: ${defaultYear}.`);
      validYears = [defaultYear];
    }
    filters.year = validYears;
  }
  return filters;
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
          
          // Validate and fix filters before applying
          const validatedFilters = state.validateAndFixFilters();
          
          if (!roadLayer) {
            message.warning('Road layer not loaded yet. Using placeholder data.');
            set({ showStats: true });
            await state.calculateStatistics();
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
            (validatedFilters.route.length > 0 ? 1 : 0) +
            (validatedFilters.year.length > 1 ? 1 : 0);
          
          set({ appliedFiltersCount: filterCount });

          try {
            await QueryService.zoomToDefinition(state.mapView, roadLayer, where);
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
          
          const validatedFilters = state.validateAndFixFilters();
          
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
            
            const emptyStats: SummaryStatistics = {
              totalSegments: 0,
              totalLengthKm: 0,
              metrics: [{
                metric: activeKpi.toUpperCase(),
                average: 0,
                min: 0,
                max: 0,
                goodCount: 0,
                fairCount: 0,
                poorCount: 0,
                goodPct: 0,
                fairPct: 0,
                poorPct: 0
              }],
              lastUpdated: new Date()
            };
            set({ currentStats: emptyStats });
          }
        },
        
        updateRenderer: () => {
          const state = get();
          const { roadLayer, activeKpi } = state;
          
          if (!roadLayer) {
            console.warn('Cannot update renderer: road layer not loaded');
            return;
          }
          
          const validatedFilters = state.validateAndFixFilters();
          const year = validatedFilters.year[0];
          
          try {
            const renderer = RendererService.createKPIRenderer(activeKpi, year);
            (roadLayer as any).renderer = renderer;
            
            if (state.roadLayerSwipe) {
              if (!(state.roadLayerSwipe as any).renderer) {
                (state.roadLayerSwipe as any).renderer = renderer;
              }
            }
            
            message.success(`Showing ${KPI_LABELS[activeKpi]} for ${year}`, 2);
          } catch (error) {
            console.error('Error updating renderer:', error);
            message.error('Failed to update map visualization');
          }
        }
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
          // initialExtent, mapInitialized, loading, error
        })
      }
    )
  )
);

export default useAppStore;