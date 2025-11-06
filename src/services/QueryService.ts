import type FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import Query from '@arcgis/core/rest/support/Query';
import type MapView from '@arcgis/core/views/MapView';
import { CONFIG } from '@/config/appConfig';
import { ROAD_FIELDS, SUBGROUP_CODE_TO_FIELD } from '@/config/layerConfig';
import type { FilterState } from '@/types';

/**
 * An in-memory cache for storing unique field values to avoid redundant queries.
 * The cache is cleared periodically to prevent stale data.
 */
const uniqueValuesCache = new Map<string, { data: string[]; timestamp: number }>();
const CACHE_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes

export default class QueryService {
  /**
   * Builds a definition expression (SQL WHERE clause) from active filters.
   * NOTE: Year is NOT included - it determines which field to query (e.g., AIRI_2025).
   * @param filters - Active filter state (without year).
   * @returns SQL WHERE clause string
   */
  static buildDefinitionExpression(filters: {
    localAuthority: string[];
    subgroup: number[];
    route: string[];
  }): string {
    const whereClauses: string[] = [];

    // Local Authority filter
    if (filters.localAuthority && filters.localAuthority.length > 0) {
      const laValues = filters.localAuthority.map(la => `'${la}'`).join(', ');
      whereClauses.push(`${ROAD_FIELDS.la} IN (${laValues})`);
    }

    // Route filter
    if (filters.route && filters.route.length > 0) {
      const routeValues = filters.route.map(r => `'${r}'`).join(', ');
      whereClauses.push(`${ROAD_FIELDS.route} IN (${routeValues})`);
    }

    // Subgroup filter
    if (filters.subgroup && filters.subgroup.length > 0) {
      const subgroupClauses = filters.subgroup.map(code => {
        const fieldName = SUBGROUP_CODE_TO_FIELD[code];
        if (!fieldName) {
          console.warn(`Unknown subgroup code: ${code}`);
          return null;
        }
        
        // Rural is the default (absence of other flags)
        if (fieldName === 'Rural') {
          return `(IsFormerNa = 0 AND IsDublin = 0 AND IsCityTown = 0 AND IsPeat = 0)`;
        }
        
        // Other subgroups check for flag = 1
        return `${fieldName} = 1`;
      }).filter(clause => clause !== null);

      if (subgroupClauses.length > 0) {
        whereClauses.push(`(${subgroupClauses.join(' OR ')})`);
      }
    }

    // Combine all clauses
    return whereClauses.length > 0 ? whereClauses.join(' AND ') : '1=1';
  }

  /**
   * Simple wrapper for getting unique values with caching
   * @param layer - Feature layer to query
   * @param fieldName - Field to get unique values from
   * @returns Promise with array of unique values
   */
  static async getUniqueValues(
    layer: __esri.FeatureLayer | null,
    fieldName: string
  ): Promise<string[]> {
    if (!layer) {
      console.warn(`Cannot get unique values: layer is null`);
      return [];
    }
  
    // Check cache first
    const cacheKey = `${layer.id}_${fieldName}`;
    const cached = uniqueValuesCache.get(cacheKey);
    
    if (cached && (Date.now() - cached.timestamp) < CACHE_EXPIRY_MS) {
      console.log(`Using cached values for ${fieldName}`);
      return cached.data;
    }
  
    try {
      // Use queryUniqueValues with empty filters to get all values
      const values = await this.queryUniqueValues(layer, fieldName, {
        localAuthority: [],
        subgroup: [],
        route: []
      });
  
      // Cache the result
      uniqueValuesCache.set(cacheKey, {
        data: values,
        timestamp: Date.now()
      });
  
      return values;
    } catch (error) {
      console.error(`Error getting unique values for ${fieldName}:`, error);
      return [];
    }
  }

  /**
   * Queries unique values for a specific field
   * @param layer - Feature layer to query
   * @param fieldName - Field to get unique values from
   * @param currentFilters - Current filter state (without year)
   * @returns Promise with array of unique values
   */
  static async queryUniqueValues(
    layer: __esri.FeatureLayer,
    fieldName: string,
    currentFilters: {
      localAuthority: string[];
      subgroup: number[];
      route: string[];
    }
  ): Promise<string[]> {
    try {
      // Build WHERE clause excluding the field being queried
      const tempFilters = { ...currentFilters };
      
      // Clear the filter for the field being queried
      if (fieldName === ROAD_FIELDS.la) {
        tempFilters.localAuthority = [];
      } else if (fieldName === ROAD_FIELDS.route) {
        tempFilters.route = [];
      }

      const where = this.buildDefinitionExpression(tempFilters);

      const query = layer.createQuery();
      query.where = where;
      query.outFields = [fieldName];
      query.returnDistinctValues = true;
      query.returnGeometry = false;
      query.orderByFields = [fieldName];

      const result = await layer.queryFeatures(query);
      
      const uniqueValues = result.features
        .map(feature => feature.attributes[fieldName])
        .filter(value => value != null && value !== '');

      console.log(`Found ${uniqueValues.length} unique values for ${fieldName}`);
      return uniqueValues;

    } catch (error) {
      console.error(`Error querying unique values for ${fieldName}:`, error);
      return [];
    }
  }

  /**
   * Queries routes filtered by selected Local Authorities.
   * If no LAs are selected, returns all routes.
   * If LAs are selected, returns only routes within those LAs.
   * @param layer - Feature layer to query
   * @param selectedLAs - Array of selected Local Authority names
   * @returns Promise with array of route names, sorted alphabetically
   */
  static async queryRoutesForLAs(
    layer: __esri.FeatureLayer | null,
    selectedLAs: string[]
  ): Promise<string[]> {
    if (!layer) {
      console.warn('Cannot query routes: layer is null');
      return [];
    }

    try {
      // Build WHERE clause
      let whereClause = '1=1';
      if (selectedLAs && selectedLAs.length > 0) {
        const laValues = selectedLAs.map(la => `'${la.replace("'", "''")}'`).join(', ');
        whereClause = `${ROAD_FIELDS.la} IN (${laValues})`;
      }

      console.log(`[QueryService] Querying routes for LAs:`, selectedLAs.length > 0 ? selectedLAs : 'ALL');

      const query = layer.createQuery();
      query.where = whereClause;
      query.outFields = [ROAD_FIELDS.route];
      query.returnDistinctValues = true;
      query.returnGeometry = false;
      query.orderByFields = [ROAD_FIELDS.route];

      const result = await layer.queryFeatures(query);

      const routes = result.features
        .map(feature => feature.attributes[ROAD_FIELDS.route])
        .filter(value => value != null && value !== '');

      // Sort alphabetically (case-insensitive)
      routes.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

      console.log(`[QueryService] Found ${routes.length} routes`);
      return routes;

    } catch (error) {
      console.error('Error querying routes for LAs:', error);
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
   * Queries the extent (bounding box) for the current filter selection
   * Used for zooming to filtered features
   * @param layer - Feature layer to query
   * @param filters - Current filter state (without year)
   * @returns Promise with extent
   */
  static async queryExtentForFilters(
    layer: __esri.FeatureLayer,
    filters: {
      localAuthority: string[];
      subgroup: number[];
      route: string[];
    }
  ): Promise<__esri.Extent | null> {
    try {
      const where = this.buildDefinitionExpression(filters);
      
      const query = layer.createQuery();
      query.where = where;
      query.returnGeometry = true;

      const result = await layer.queryExtent(query);
      
      if (result.extent) {
        console.log('Queried extent for filters:', result.extent);
        return result.extent;
      }
      
      return null;
    } catch (error) {
      console.error('Error querying extent:', error);
      return null;
    }
  }

  /**
   * Zooms the map view to the extent of features matching a given definition expression.
   * @param mapView - The MapView instance.
   * @param layer - The FeatureLayer to query.
   * @param whereClause - The definition expression to filter features.
   */
  static async zoomToDefinition(
    mapView: __esri.MapView | null,
    layer: __esri.FeatureLayer | null,
    whereClause: string
  ): Promise<void> {
    if (!mapView || !layer) {
      console.warn('Cannot zoom to definition: MapView or layer is null.');
      return;
    }

    try {
      const query = layer.createQuery();
      query.where = whereClause;
      query.returnGeometry = true;
      query.outFields = []; // No need for fields, just geometry

      const result = await layer.queryExtent(query);

      if (result.extent) {
        await mapView.goTo(result.extent, { duration: 1000, easing: 'ease-in-out' });
        console.log('Zoomed to filtered extent.');
      } else {
        console.log('No features found for the given definition expression, cannot zoom.');
      }
    } catch (error) {
      console.error('Error zooming to definition:', error);
    }
  }
}
