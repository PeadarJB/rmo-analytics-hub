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

        setError: (err) => set({ error: err }),
        setThemeMode: (mode) => set({ themeMode: mode }),

        setShowFilters: (b) => set({ showFilters: b, showChart: b ? false : get().showChart }),
        setShowStats: (b) => set({ showStats: b }),
        setShowChart: (b) => set({ showChart: b, showFilters: b ? false : get().showFilters }),
        setShowSwipe: (b) => set({ showSwipe: b }),

        setActiveKpi: (k) => set({ activeKpi: k }),

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
          const fields = CONFIG.fields;

          if (f.localAuthority.length) {
            const inVals = f.localAuthority.map(v => `'${v.replace("'", "''")}'`).join(',');
            clauses.push(`${fields.la} IN (${inVals})`);
          }
          if (f.subgroup.length) {
            clauses.push(`${fields.subgroup} IN (${f.subgroup.join(',')})`);
          }
          if (f.route.length) {
            const inVals = f.route.map(v => `'${v.replace("'", "''")}'`).join(',');
            clauses.push(`${fields.route} IN (${inVals})`);
          }
          if (f.year.length) {
            clauses.push(`${fields.year} IN (${f.year.join(',')})`);
          }
          const where = clauses.length ? clauses.join(' AND ') : '1=1';
          (roadLayer as any).definitionExpression = where;

          // Zoom to selection (placeholder extent if empty)
          await QueryService.zoomToDefinition(get().mapView, roadLayer, where);
          set({ showStats: true });
          await get().calculateStatistics();
        },

        calculateStatistics: async () => {
          const { roadLayer, currentFilters, activeKpi } = get();
          const stats = await StatisticsService.computeSummary(roadLayer, currentFilters, activeKpi);
          set({ currentStats: stats });
        }
      }),
      { name: 'rmo-app' }
    )
  )
);

export default useAppStore;
