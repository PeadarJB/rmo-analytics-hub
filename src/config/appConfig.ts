export type KPIKey = 'iri' | 'rut' | 'psci' | 'csc' | 'mpd' | 'lpv3';

export const CONFIG = {
  // Application title shown in the header
  title: 'RMO Pavement Analytics',
  // Set to the actual web map ID published on ArcGIS Online for the RMO analytics hub
  webMapId: '9aff0a681f67430cad396dc9cac99e05',
  // The title of the feature layer representing the road network in the web map.
  // This must exactly match the layer name in the AGOL item otherwise the layer lookup will fail.
  roadNetworkLayerTitle: 'RMO NM 2025',
  // Title of the swipe layer shown when the swipe panel is activated.
  // Use the same underlying layer so that a cloned layer can be used for side‑by‑side year comparison.
  roadNetworkLayerSwipeTitle: 'RMO NM 2025',
  /**
   * Field names used throughout the app.  These keys map logical KPI names to the
   * corresponding attribute field names in the underlying feature service.
   *
   * Note: the RMO road network contains separate fields for each year (e.g.
   * `roads_csv_iri_2011`, `roads_csv_iri_2018`, `roads_csv_iri_2025`).  When constructing
   * renderers or statistics queries you should append the selected year to these base names
   * (see `StatisticsService` for an example).  For example, selecting the 2025 survey year and the
   * IRI KPI would map to `roads_csv_iri_2025`.
   */
  fields: {
    // Base field name for International Roughness Index. Append `_2011`, `_2018` or `_2025` as needed.
    iri: 'roads_csv_iri',
    // Base field name for Rut Depth
    rut: 'roads_csv_rut',
    // Base field name for Pavement Surface Condition Index
    psci: 'roads_csv_psci',
    // Base field name for Condition Surveyed Cracking
    csc: 'roads_csv_csc',
    // Base field name for Mean Profile Depth
    mpd: 'roads_csv_mpd',
    // Base field name for Lane Position Variance (LPV).  The RMO schema does not include a
    // “lpv3” field, so point to the LPV fields provided by the CSV.
    lpv3: 'roads_csv_lpv',
    // Route identifier.  Prefer the joined route value over the CSV version so filters work across
    // the entire dataset.
    route: 'Roads_Joined_Route',
    // There is no explicit SurveyYear field on the network; the year is encoded in the KPI fields.
    // This key remains for UI purposes and should map to a synthetic 'year' property in queries.
    year: 'SurveyYear',
    // Local authority name as stored on the joined feature layer.
    la: 'Roads_Joined_LA',
    // Road subgroup code.  The dataset stores individual boolean flags (IsFormerNa, IsDublin, etc.);
    // use these to derive the numeric codes defined in the UI.  This placeholder name is retained
    // for consistency but is not present on the service.
    subgroup: 'RoadGroupCode',
    // Polyline length in metres; use to compute total kilometres by dividing by 1000.
    lengthKm: 'Shape_Length'
  },
  filters: {
    localAuthority: { id: 'localAuthority', label: 'Local Authority', field: 'Roads_Joined_LA', type: 'multi-select' as const },
    subgroup: { id: 'subgroup', label: 'Road Subgroup', field: 'RoadGroupCode', type: 'multi-select' as const, options: [
      { label: 'Former National', value: 10 },
      { label: 'Dublin', value: 20 },
      { label: 'City/Town', value: 30 },
      { label: 'Peat', value: 40 },
      { label: 'Rural', value: 50 }
    ] },
    route: { id: 'route', label: 'Route', field: 'Roads_Joined_Route', type: 'multi-select' as const },
    year: { id: 'year', label: 'Survey Year', field: 'SurveyYear', type: 'multi-select' as const, options: [
      { label: '2011', value: 2011 },
      { label: '2018', value: 2018 },
      { label: '2025', value: 2025 }
    ] }
  },
  defaultKPI: 'psci' as KPIKey,
  defaultYears: [2025],
  defaultGroupBy: 'Roads_Joined_LA',
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
  lpv3: 'LPV'
};
