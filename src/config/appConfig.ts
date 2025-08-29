export type KPIKey = 'iri' | 'rut' | 'psci' | 'csc' | 'mpd' | 'lpv3';

export const CONFIG = {
  title: 'RMO Pavement Analytics',
  // Placeholder ArcGIS items — replace with real IDs/titles.
  webMapId: 'REPLACE_WITH_RMO_WEBMAP_ID',
  roadNetworkLayerTitle: 'RMO Road Network',
  roadNetworkLayerSwipeTitle: 'RMO Road Network (Swipe)',
  fields: {
    iri: 'IRI',
    rut: 'RutDepth',
    psci: 'PSCI',
    csc: 'CSC',
    mpd: 'MPD',
    lpv3: 'LPV3',
    route: 'Route',
    year: 'SurveyYear',
    la: 'LA_Name',
    subgroup: 'RoadGroupCode',
    lengthKm: 'Length_km'
  },
  filters: {
    localAuthority: { id: 'localAuthority', label: 'Local Authority', field: 'LA_Name', type: 'multi-select' as const },
    subgroup: { id: 'subgroup', label: 'Road Subgroup', field: 'RoadGroupCode', type: 'multi-select' as const, options: [
      { label: 'Former National', value: 10 },
      { label: 'Dublin', value: 20 },
      { label: 'City/Town', value: 30 },
      { label: 'Peat', value: 40 },
      { label: 'Rural', value: 50 }
    ] },
    route: { id: 'route', label: 'Route', field: 'Route', type: 'multi-select' as const },
    year: { id: 'year', label: 'Survey Year', field: 'SurveyYear', type: 'multi-select' as const, options: [
      { label: '2011', value: 2011 },
      { label: '2018', value: 2018 },
      { label: '2025', value: 2025 }
    ] }
  },
  defaultKPI: 'psci' as KPIKey,
  defaultYears: [2025],
  defaultGroupBy: 'LA_Name',
  map: {
    center: [-8.0, 53.3] as [number, number],
    zoom: 7
  }
} as const;

export const KPI_LABELS: Record<KPIKey, string> = {
  iri: 'IRI',
  rut: 'Rut Depth',
  psci: 'PSCI',
  csc: 'CSC',
  mpd: 'MPD',
  lpv3: 'LPV3'
};
