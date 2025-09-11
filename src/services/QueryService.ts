import type FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import Query from '@arcgis/core/rest/support/Query';
import type MapView from '@arcgis/core/views/MapView';
import { CONFIG, SUBGROUP_CODE_TO_FIELD } from '@/config/appConfig'; // ADD SUBGROUP_CODE

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
   * Computes statistics grouped by subgroup categories.
   * Handles the special boolean field logic for subgroups.
   * @param layer - The FeatureLayer to query
   * @param kpiField - The KPI field to aggregate
   * @param whereClause - The WHERE clause to apply
   * @returns Promise resolving to array of grouped statistics
   */
  static async computeSubgroupStatistics(
    layer: FeatureLayer | null,
    kpiField: string,
    whereClause: string
  ): Promise<any[]> {
    if (!layer) {
      // Placeholder data for local runs
      console.warn('Road layer is not loaded, using placeholder subgroup stats.');
      const subgroups = ['Former National', 'Dublin', 'City/Town', 'Peat', 'Rural'];
      return subgroups.map(g => ({
        group: g,
        avgValue: Math.random() * 5 + 2,
        count: Math.floor(Math.random() * 50 + 10)
      }));
    }

    try {
      // Create a virtual subgroup field using SQL CASE statement (kept for clarity)
      const subgroupCaseStatement = `
        CASE 
          WHEN Roads_Joined_IsFormerNa = 1 THEN 'Former National'
          WHEN Roads_Joined_IsDublin = 1 THEN 'Dublin'
          WHEN Roads_Joined_IsCityTown = 1 THEN 'City/Town'
          WHEN Roads_Joined_IsPeat = 1 THEN 'Peat'
          WHEN Roads_Joined_IsFormerNa = 0 AND Roads_Joined_IsDublin = 0 
               AND Roads_Joined_IsCityTown = 0 AND Roads_Joined_IsPeat = 0 THEN 'Rural'
          ELSE 'Unknown'
        END
      `;

      // Build queries for each subgroup
      const subgroupQueries = [
        { name: 'Former National', where: `(${whereClause}) AND Roads_Joined_IsFormerNa = 1` },
        { name: 'Dublin',         where: `(${whereClause}) AND Roads_Joined_IsDublin = 1` },
        { name: 'City/Town',      where: `(${whereClause}) AND Roads_Joined_IsCityTown = 1` },
        { name: 'Peat',           where: `(${whereClause}) AND Roads_Joined_IsPeat = 1` },
        { 
          name: 'Rural', 
          where: `(${whereClause}) AND Roads_Joined_IsFormerNa = 0 AND Roads_Joined_IsDublin = 0 
                  AND Roads_Joined_IsCityTown = 0 AND Roads_Joined_IsPeat = 0` 
        }
      ];

      // Execute queries in parallel for each subgroup
      const promises = subgroupQueries.map(async (subgroup) => {
        const query = layer.createQuery();
        query.where = subgroup.where;
        query.returnGeometry = false;
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

        try {
          const result = await layer.queryFeatures(query);
          
          if (result.features.length > 0) {
            const stats = result.features[0].attributes;
            return {
              group: subgroup.name,
              avgValue: stats.avg_value ? Math.round(stats.avg_value * 100) / 100 : 0,
              count: stats.count_segments || 0
            };
          }
          return null;
        } catch (error) {
          console.error(`Error querying ${subgroup.name}:`, error);
          return null;
        }
      });

      const results = await Promise.all(promises);
      
      // Filter out null results and any subgroups with no data
      return results.filter((r: any) => r !== null && r.count > 0) as any[];
      
    } catch (error) {
      console.error('Error computing subgroup statistics:', error);
      
      // Fallback: Try alternative approach using a single grouped query if supported
      try {
        return await this.computeSubgroupStatisticsFallback(layer as FeatureLayer, kpiField, whereClause);
      } catch (fallbackError) {
        console.error('Fallback also failed:', fallbackError);
        return [];
      }
    }
  }

  /**
   * Fallback method for subgroup statistics if CASE statements are supported
   * @private
   */
  private static async computeSubgroupStatisticsFallback(
    layer: FeatureLayer,
    kpiField: string,
    whereClause: string
  ): Promise<any[]> {
    // This approach attempts to use SQL expressions if the service supports them
    const query = layer.createQuery();
    query.where = whereClause;
    query.returnGeometry = false;
    
    // Try to use a calculated field for grouping
    const sqlExpression = {
      name: 'subgroup_category',
      expression: `
        CASE 
          WHEN Roads_Joined_IsFormerNa = 1 THEN 'Former National'
          WHEN Roads_Joined_IsDublin = 1 THEN 'Dublin'
          WHEN Roads_Joined_IsCityTown = 1 THEN 'City/Town'
          WHEN Roads_Joined_IsPeat = 1 THEN 'Peat'
          ELSE 'Rural'
        END
      `
    };
    
    // Note: This approach may not work with all ArcGIS Server versions
    // If it fails, the primary method with parallel queries will be used
    query.outFields = ['*'];
    query.sqlFormat = 'standard';
    
    const result = await layer.queryFeatures(query);
    
    // Manual aggregation if SQL expressions aren't supported
    const aggregated = new Map<string, { sum: number; count: number }>();
    
    result.features.forEach(feature => {
      const attrs = feature.attributes as Record<string, any>;
      let subgroup = 'Rural';
      
      if (attrs.Roads_Joined_IsFormerNa === 1) subgroup = 'Former National';
      else if (attrs.Roads_Joined_IsDublin === 1) subgroup = 'Dublin';
      else if (attrs.Roads_Joined_IsCityTown === 1) subgroup = 'City/Town';
      else if (attrs.Roads_Joined_IsPeat === 1) subgroup = 'Peat';
      
      const kpiValue = attrs[kpiField];
      if (kpiValue !== null && kpiValue !== undefined) {
        if (!aggregated.has(subgroup)) {
          aggregated.set(subgroup, { sum: 0, count: 0 });
        }
        const stats = aggregated.get(subgroup)!;
        stats.sum += kpiValue;
        stats.count += 1;
      }
    });
    
    return Array.from(aggregated.entries()).map(([group, stats]) => ({
      group,
      avgValue: Math.round((stats.sum / stats.count) * 100) / 100,
      count: stats.count
    }));
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
    try {
      const res = await layer.queryExtent(q);
      if (res.extent) await view.goTo(res.extent.expand(1.1));
    } catch (error) {
      console.error('Error zooming to definition:', error);
    }
  }
}
