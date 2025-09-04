import { create } from 'zustand';
import { persist, devtools } from 'zustand/middleware';
import type MapView from '@arcgis/core/views/MapView';
import type WebMap from '@arcgis/core/WebMap';
import type FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import type Extent from '@arcgis/core/geometry/Extent';
import { message } from 'antd';
import { CONFIG, KPI_LABELS, type KPIKey } from '@/config/appConfig';
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
}

const initialFilters: FilterState = {
  localAuthority: [],
  subgroup: [],
  route: [],
  year: CONFIG.defaultYears.slice()
};

// Map subgroup codes to field names
const SUBGROUP_FIELD_MAP: Record<number, string> = {
  10: 'Roads_Joined_IsFormerNa',  // Former National
  20: 'Roads_Joined_IsDublin',    // Dublin
  30: 'Roads_Joined_IsCityTown',  // City/Town
  40: 'Roads_Joined_IsPeat',      // Peat
  50: 'Rural'  // Special case - all flags = 0
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

        setFilters: (f) => set({ currentFilters: { ...get().currentFilters, ...f } }),
        clearAllFilters: () => set({ currentFilters: { ...initialFilters, year: [] }, currentStats: null }),

        initializeMap: async (containerId: string) => {
          try {
            set({ loading: true });
            const { view, webmap } = await MapViewService.initializeMapView(containerId, CONFIG.webMapId);
            const road = webmap.allLayers.find((l: any) => l.title === CONFIG.roadNetworkLayerTitle) as FeatureLayer | undefined;
            const roadSwipe = webmap.allLayers.find((l: any) => l.title === CONFIG.roadNetworkLayerSwipeTitle) as FeatureLayer | undefined;
            
            set({
              mapView: view,
              webmap,
              roadLayer: road ?? null,
              roadLayerSwipe: roadSwipe ?? null,
              initialExtent: view.extent ?? null,
              loading: false
            });
            
            // Apply initial renderer
            if (road) {
              get().updateRenderer();
            }
          } catch (e: any) {
            console.error(e);
            set({ error: e?.message || 'Failed to initialize map', loading: false });
          }
        },

        applyFilters: async () => {
          const { roadLayer, currentFilters } = get();
          if (!roadLayer) {
            message.warning('Road layer not loaded yet. Using placeholder data.');
            set({ showStats: true });
            await get().calculateStatistics();
            return;
          }
          
          const clauses: string[] = [];
          const f = currentFilters;

          // Local Authority filter
          if (f.localAuthority.length) {
            const inVals = f.localAuthority.map(v => `'${v.replace("'", "''")}'`).join(',');
            clauses.push(`${CONFIG.fields.la} IN (${inVals})`);
          }

          // Subgroup filter - using boolean fields
          if (f.subgroup.length) {
            const subgroupClauses: string[] = [];
            
            for (const code of f.subgroup) {
              const fieldName = SUBGROUP_FIELD_MAP[code];
              
              if (code === 50) {
                // Rural: all flags must be 0
                subgroupClauses.push(
                  `(Roads_Joined_IsFormerNa = 0 AND Roads_Joined_IsDublin = 0 AND Roads_Joined_IsCityTown = 0 AND Roads_Joined_IsPeat = 0)`
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
          if (f.route.length) {
            const inVals = f.route.map(v => `'${v.replace("'", "''")}'`).join(',');
            clauses.push(`${CONFIG.fields.route} IN (${inVals})`);
          }

          // Year filter - will be handled differently for KPI fields
          // Since year is part of the field name (e.g., roads_csv_iri_2025),
          // we'll need to handle this in the renderer and statistics services
          // The definitionExpression won't filter by year directly
          
          const where = clauses.length ? clauses.join(' AND ') : '1=1';
          (roadLayer as any).definitionExpression = where;

          // Zoom to selection
          await QueryService.zoomToDefinition(get().mapView, roadLayer, where);
          
          // Update renderer for the selected year and KPI
          get().updateRenderer();
          
          set({ showStats: true });
          await get().calculateStatistics();
        },

        calculateStatistics: async () => {
          const { roadLayer, currentFilters, activeKpi } = get();
          const stats = await StatisticsService.computeSummary(roadLayer, currentFilters, activeKpi);
          set({ currentStats: stats });
        },
        
        updateRenderer: () => {
          const { roadLayer, activeKpi, currentFilters } = get();
          if (!roadLayer) return;
          
          // Use the first selected year, or default to most recent (2025)
          const year = currentFilters.year.length > 0 
            ? currentFilters.year[0] 
            : CONFIG.defaultYears[0];
          
          try {
            // Create and apply the renderer for the current KPI and year
            const renderer = RendererService.createKPIRenderer(activeKpi, year);
            (roadLayer as any).renderer = renderer;
            
            message.success(`Showing ${KPI_LABELS[activeKpi]} for ${year}`);
          } catch (error) {
            console.error('Error updating renderer:', error);
            message.error('Failed to update map visualization');
          }
        }
      }),
      { name: 'rmo-app' }
    )
  )
);

export default useAppStore;