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

        validateAndFixFilters: () => {
          const filters = get().currentFilters;
          let modified = false;
          
          // Ensure at least one year is selected
          if (!filters.year || filters.year.length === 0) {
            filters.year = [CONFIG.defaultYears[0]];
            modified = true;
            message.warning(`No year selected. Defaulting to ${CONFIG.defaultYears[0]}.`);
          }
          
          // Validate year values are valid options
          const validYears = (CONFIG.filters.year.options?.map(o => o.value) || CONFIG.defaultYears) as number[];
          filters.year = filters.year.filter(y => validYears.includes(y));
          
          if (filters.year.length === 0) {
            filters.year = [CONFIG.defaultYears[0]];
            modified = true;
            message.warning('Invalid year selection. Defaulting to ' + CONFIG.defaultYears[0]);
          }
          
          if (modified) {
            set({ currentFilters: filters });
          }
          
          return filters;
        },

        initializeMap: async (containerId: string) => {
          try {
            set({ loading: true, error: null });
            
            const { view, webmap } = await MapViewService.initializeMapView(
              containerId, 
              CONFIG.webMapId
            );
            
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
              loading: false
            });
            
            // Apply initial renderer if layer is available
            if (road) {
              get().updateRenderer();
            }
          } catch (e: any) {
            console.error('Map initialization error:', e);
            const errorMsg = e?.message || 'Failed to initialize map';
            set({ 
              error: errorMsg, 
              loading: false 
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
            
            // The filter now contains field names (from the refactored config)
            // We need to handle the values which are now field names, not numeric codes
            for (const fieldNameOrValue of validatedFilters.subgroup) {
              // Check if this is a field name (new format) or numeric code (old format)
              let fieldName: string | undefined;
              
              // First check if it's a string field name from the new format
              const subgroupOption = CONFIG.filters.subgroup.options?.find(
                opt => opt.value === fieldNameOrValue || 
                      (!isNaN(Number(fieldNameOrValue)) && opt.code === Number(fieldNameOrValue))
              );
              
              if (subgroupOption) {
                fieldName = subgroupOption.value as string;
              } else if (typeof fieldNameOrValue === 'number') {
                // Fallback for backward compatibility with numeric codes
                fieldName = SUBGROUP_CODE_TO_FIELD[fieldNameOrValue];
              } else {
                // Direct field name
                fieldName = fieldNameOrValue as string;
              }
              
              if (fieldName === 'Rural') {
                // Rural: all flags must be 0
                subgroupClauses.push(
                  `(Roads_Joined_IsFormerNa = 0 AND Roads_Joined_IsDublin = 0 AND ` +
                  `Roads_Joined_IsCityTown = 0 AND Roads_Joined_IsPeat = 0)`
                );
              } else if (fieldName && fieldName !== 'Rural') {
                // Other subgroups: check if flag = 1
                subgroupClauses.push(`${fieldName} = 1`);
              }
            }
            
            // Use OR between different subgroup selections
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

          // Year is handled in the renderer and statistics, not in the WHERE clause
          // The year is part of the field name (e.g., roads_csv_iri_2025)
          
          const where = clauses.length ? clauses.join(' AND ') : '1=1';
          (roadLayer as any).definitionExpression = where;

          // Count active filters for UI feedback
          const filterCount = 
            (validatedFilters.localAuthority.length > 0 ? 1 : 0) +
            (validatedFilters.subgroup.length > 0 ? 1 : 0) +
            (validatedFilters.route.length > 0 ? 1 : 0) +
            (validatedFilters.year.length > 1 ? 1 : 0); // Only count if not default single year
          
          set({ appliedFiltersCount: filterCount });

          try {
            // Zoom to filtered extent
            await QueryService.zoomToDefinition(state.mapView, roadLayer, where);
            
            // Update renderer for the selected year and KPI
            state.updateRenderer();
            
            // Show statistics panel
            set({ showStats: true });
            
            // Calculate statistics
            await state.calculateStatistics();
            
            // Provide feedback on filter application
            if (filterCount > 0) {
              message.success(`${filterCount} filter${filterCount > 1 ? 's' : ''} applied`);
            } else {
              message.info('Showing all data for ' + validatedFilters.year[0]);
            }
            
          } catch (error) {
            console.error('Error applying filters:', error);
            message.error('Failed to apply filters completely');
            
            // Still try to calculate statistics even if zoom fails
            await state.calculateStatistics();
          }
        },

        calculateStatistics: async () => {
          const state = get();
          const { roadLayer, activeKpi } = state;
          
          // Validate filters before calculating
          const validatedFilters = state.validateAndFixFilters();
          
          try {
            const stats = await StatisticsService.computeSummary(
              roadLayer, 
              validatedFilters, 
              activeKpi
            );
            
            // Check if we got empty results
            if (stats.totalSegments === 0) {
              message.warning('No road segments match the current filters');
              set({ 
                currentStats: stats // Still set the empty stats to show zero values
              });
            } else {
              set({ currentStats: stats });
              
              // Log summary for debugging
              console.log(`Statistics calculated: ${stats.totalSegments} segments, ` +
                        `${stats.totalLengthKm} km total length`);
            }
          } catch (error) {
            console.error('Error calculating statistics:', error);
            message.error('Failed to calculate statistics');
            
            // Set empty stats on error
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
          
          // Validate and get the current year
          const validatedFilters = state.validateAndFixFilters();
          const year = validatedFilters.year[0]; // Always use first year for rendering
          
          try {
            // Create and apply the renderer for the current KPI and year
            const renderer = RendererService.createKPIRenderer(activeKpi, year);
            (roadLayer as any).renderer = renderer;
            
            // Update swipe layer if it exists
            if (state.roadLayerSwipe) {
              // The swipe layer might show a different year, handled by SimpleSwipePanel
              // For now, just ensure it has a renderer
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
        // Don't persist map objects or temporary UI state
        partialize: (state) => ({
          themeMode: state.themeMode,
          activeKpi: state.activeKpi,
          currentFilters: state.currentFilters,
          siderCollapsed: state.siderCollapsed
        })
      }
    )
  )
);

export default useAppStore;