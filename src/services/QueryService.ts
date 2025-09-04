import type FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import Query from '@arcgis/core/rest/support/Query';
import type MapView from '@arcgis/core/views/MapView';
import { CONFIG } from '@/config/appConfig';

/**
 * An in-memory cache for storing unique field values to avoid redundant queries.
 * The cache is cleared periodically to prevent stale data.
 */
const uniqueValuesCache = new Map<string, { data: string[]; timestamp: number }>();
const CACHE_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes

export default class QueryService {
  /**
   * Fetches unique, distinct values for a given field from a FeatureLayer.
   * Implements a simple caching mechanism to improve performance.
   * @param layer - The FeatureLayer to query.
   * @param field - The field name to get unique values for.
   * @returns A promise that resolves to a sorted array of unique string values.
   */
  static async getUniqueValues(layer: FeatureLayer | null, field: string): Promise<string[]> {
    if (!layer) {
      // Placeholder values for local run without data
      if (field.toLowerCase().includes('la')) return ['Dublin City', 'Galway County', 'Limerick City and County'];
      if (field.toLowerCase().includes('route')) return ['R123', 'R456', 'R750'];
      if (field.toLowerCase().includes('year')) return ['2011', '2018', '2025'];
      return [];
    }

    // Check if the value is in the cache and is not expired
    const cached = uniqueValuesCache.get(field);
    if (cached && (Date.now() - cached.timestamp < CACHE_EXPIRY_MS)) {
      console.log(`Using cached unique values for field: ${field}`);
      return cached.data;
    }

    try {
      const q = layer.createQuery();
      q.where = '1=1';
      q.outFields = [field];
      q.returnDistinctValues = true;
      q.returnGeometry = false;

      const res = await layer.queryFeatures(q);
      const vals = new Set<string>();
      res.features.forEach(f => {
        const v = f.attributes[field];
        if (v !== null && v !== undefined) vals.add(String(v));
      });
      const sortedVals = Array.from(vals).sort();

      // Store the result in the cache with the current timestamp
      uniqueValuesCache.set(field, { data: sortedVals, timestamp: Date.now() });

      return sortedVals;
    } catch (error) {
      console.error('Error fetching unique values:', error);
      return [];
    }
  }

  /**
   * Computes grouped statistics (e.g., average KPI by Local Authority).
   * @param layer - The FeatureLayer to query.
   * @param kpiField - The name of the KPI field to aggregate (e.g., 'roads_csv_iri_2025').
   * @param groupByField - The field to group by (e.g., 'Roads_Joined_LA').
   * @param whereClause - The WHERE clause to apply to the query.
   * @returns A promise that resolves to an array of objects with group, avgValue, and count.
   */
  static async computeGroupedStatistics(
    layer: FeatureLayer | null,
    kpiField: string,
    groupByField: string,
    whereClause: string
  ): Promise<any[]> {
    if (!layer) {
      // Placeholder data for local runs without a connected layer
      console.warn('Road layer is not loaded, using placeholder grouped stats.');
      const groups = groupByField.includes('LA') ?
        ['Dublin City', 'Cork County', 'Galway County', 'Limerick City'] :
        ['R123', 'R456', 'R750', 'R999'];
      return groups.map(g => ({
        group: g,
        avgValue: Math.random() * 5 + 2,
        count: Math.floor(Math.random() * 50 + 10)
      }));
    }

    try {
      const query = layer.createQuery();
      query.where = whereClause;
      query.returnGeometry = false;
      query.groupByFieldsForStatistics = [groupByField];
      query.outStatistics = [
        {
          onStatisticField: kpiField,
          outStatisticFieldName: 'avg_value',
          statisticType: 'avg'
        },
        {
          onStatisticField: kpiField,
          outStatisticFieldName: 'count_segments',
          statisticType: 'count'
        }
      ] as any;

      const result = await layer.queryFeatures(query);

      return result.features.map(f => ({
        group: f.attributes[groupByField],
        avgValue: f.attributes.avg_value ? Math.round(f.attributes.avg_value * 100) / 100 : 0,
        count: f.attributes.count_segments || 0
      }));
    } catch (error) {
      console.error('Error computing grouped statistics:', error);
      return [];
    }
  }

  /**
   * Zooms the map to the extent of the currently filtered features.
   * @param view - The MapView instance.
   * @param layer - The FeatureLayer to query.
   * @param where - The WHERE clause (definitionExpression).
   */
  static async zoomToDefinition(view: MapView | null, layer: FeatureLayer | null, where: string) {
    if (!view || !layer) return;
    const q = layer.createQuery();
    q.where = where;
    q.returnGeometry = true;
    q.outFields = ['OBJECTID'];
    q.returnCentroid = true;
    q.num = 1;
    try {
      const res = await layer.queryExtent(q);
      if (res.extent) await view.goTo(res.extent.expand(1.1));
    } catch (error) {
      console.error('Error zooming to definition:', error);
    }
  }
}
