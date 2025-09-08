import type FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import Query from '@arcgis/core/rest/support/Query';
import { 
  CONFIG, 
  KPIKey, 
  KPI_THRESHOLDS,
  getKPIFieldName,
  getSimplifiedConditionClass 
} from '@/config/appConfig';
import type { FilterState, SummaryStatistics, KPIStats } from '@/types';

/**
 * Service for computing pavement condition statistics.
 * Uses centralized thresholds from appConfig and optimized queries.
 */
export default class StatisticsService {
  /**
   * Compute summary statistics for the selected filters and KPI
   * Focuses on single-year analysis (multi-year display handled in UI)
   */
  static async computeSummary(
    layer: FeatureLayer | null, 
    filters: FilterState, 
    activeKpi: KPIKey
  ): Promise<SummaryStatistics> {
    // Return placeholder when no layer is available
    if (!layer) {
      return this.getPlaceholderStats(activeKpi);
    }

    // --- Task 7 (part 1): validate year early ---
    {
      // Use the first selected year or default
      const year = filters.year.length > 0 ? filters.year[0] : CONFIG.defaultYears[0];

      // Validate year is numeric
      if (typeof year !== 'number') {
        console.error(`[StatisticsService] Year must be a number, received: ${typeof year}`, year);
        return this.getEmptyStats(activeKpi);
      }
      console.log(`[StatisticsService] Computing stats for ${activeKpi} in year ${year}`);
    }

    // --- Task 7 (part 2): replace try-catch block with enhanced logic ---
    try {
      // Use the first selected year or default
      const year = filters.year.length > 0 ? filters.year[0] : CONFIG.defaultYears[0];
      
      // Validate year is numeric
      if (typeof year !== 'number') {
        console.error(`[StatisticsService] Year must be a number, received: ${typeof year}`, year);
        return this.getEmptyStats(activeKpi);
      }
      console.log(`[StatisticsService] Computing stats for ${activeKpi} in year ${year}`);
      
      const kpiField = getKPIFieldName(activeKpi, year);
      const lengthField = CONFIG.fields.lengthKm;
      
      // Build where clause based on current definition expression
      const baseWhere = (layer as any).definitionExpression || '1=1';
      const whereClause = `(${baseWhere}) AND ${kpiField} IS NOT NULL`;
      
      console.log(`[StatisticsService] Query where clause: ${whereClause}`);
      
      // Execute optimized query for both statistics and condition counts
      const results = await this.executeOptimizedQuery(
        layer,
        whereClause,
        kpiField,
        lengthField,
        activeKpi
      );
      
      if (!results) {
        console.warn('[StatisticsService] Query returned no results');
        return this.getEmptyStats(activeKpi);
      }
      
      console.log(`[StatisticsService] Query results:`, results);
      
      // Convert length from meters to kilometers
      const totalLengthKm = (results.totalLength || 0) / 1000;
      
      // Rest of the existing calculation logic...
      // Calculate percentages
      const total = results.goodCount + results.fairCount + results.poorCount;
      const goodPct = total > 0 ? (results.goodCount / total) * 100 : 0;
      const fairPct = total > 0 ? (results.fairCount / total) * 100 : 0;
      const poorPct = total > 0 ? (results.poorCount / total) * 100 : 0;
      
      const kpiStats: KPIStats = {
        metric: activeKpi.toUpperCase(),
        average: results.avgValue || 0,
        min: results.minValue || 0,
        max: results.maxValue || 0,
        goodCount: results.goodCount,
        fairCount: results.fairCount,
        poorCount: results.poorCount,
        goodPct: Math.round(goodPct * 10) / 10,
        fairPct: Math.round(fairPct * 10) / 10,
        poorPct: Math.round(poorPct * 10) / 10
      };
      
      return {
        totalSegments: results.totalSegments || 0,
        totalLengthKm: Math.round(totalLengthKm * 10) / 10,
        metrics: [kpiStats],
        lastUpdated: new Date()
      };
    } catch (error) {
      console.error('Error computing statistics:', error);
      return this.getPlaceholderStats(activeKpi);
    }
  }
  
  /**
   * Execute an optimized single query for all statistics and condition counts
   * Uses SQL CASE expressions to compute condition classes in one pass
   */
  private static async executeOptimizedQuery(
    layer: FeatureLayer,
    whereClause: string,
    kpiField: string,
    lengthField: string,
    activeKpi: KPIKey
  ): Promise<any> {
    const statsQuery = layer.createQuery();
    statsQuery.where = whereClause;
    statsQuery.returnGeometry = false;
    
    // Get thresholds for this KPI
    const thresholds = KPI_THRESHOLDS[activeKpi];
    
    // Build CASE expressions for condition counting based on KPI type
    const conditionExpressions = this.buildConditionExpressions(kpiField, activeKpi, thresholds);
    
    // Define comprehensive statistics in a single query
    statsQuery.outStatistics = [
      // Basic statistics
      {
        onStatisticField: kpiField,
        outStatisticFieldName: 'avg_value',
        statisticType: 'avg'
      },
      {
        onStatisticField: kpiField,
        outStatisticFieldName: 'min_value',
        statisticType: 'min'
      },
      {
        onStatisticField: kpiField,
        outStatisticFieldName: 'max_value',
        statisticType: 'max'
      },
      {
        onStatisticField: kpiField,
        outStatisticFieldName: 'count_segments',
        statisticType: 'count'
      },
      {
        onStatisticField: lengthField,
        outStatisticFieldName: 'total_length',
        statisticType: 'sum'
      },
      // Condition class counts using CASE expressions
      {
        onStatisticField: conditionExpressions.good,
        outStatisticFieldName: 'good_count',
        statisticType: 'sum'
      },
      {
        onStatisticField: conditionExpressions.fair,
        outStatisticFieldName: 'fair_count',
        statisticType: 'sum'
      },
      {
        onStatisticField: conditionExpressions.poor,
        outStatisticFieldName: 'poor_count',
        statisticType: 'sum'
      }
    ] as any;
    
    try {
      const result = await layer.queryFeatures(statsQuery);
      
      if (!result.features.length) {
        return null;
      }
      
      const stats = result.features[0].attributes;
      
      return {
        avgValue: stats.avg_value,
        minValue: stats.min_value,
        maxValue: stats.max_value,
        totalSegments: stats.count_segments,
        totalLength: stats.total_length,
        goodCount: Math.round(stats.good_count || 0),
        fairCount: Math.round(stats.fair_count || 0),
        poorCount: Math.round(stats.poor_count || 0)
      };
    } catch (error) {
      // --- Task 7 (part 3): enhanced error handling and detailed logging ---
      console.error('Error executing optimized query:', error);
      console.log('Query details:', { whereClause, kpiField, activeKpi });
      
      // Fallback to separate queries if CASE expressions are not supported
      return this.executeFallbackQueries(layer, whereClause, kpiField, lengthField, activeKpi);
    }
  }
  
  /**
   * Build SQL CASE expressions for counting condition classes
   * Returns expressions that evaluate to 1 for matching conditions, 0 otherwise
   */
  private static buildConditionExpressions(
    kpiField: string,
    kpi: KPIKey,
    thresholds: typeof KPI_THRESHOLDS[KPIKey]
  ): { good: string; fair: string; poor: string } {
    
    // KPIs where lower values are better (IRI, RUT, LPV3)
    if (kpi === 'iri' || kpi === 'rut' || kpi === 'lpv3') {
      return {
        good: `CASE WHEN ${kpiField} < ${thresholds.good} THEN 1 ELSE 0 END`,
        fair: `CASE WHEN ${kpiField} >= ${thresholds.good} AND ${kpiField} < ${thresholds.fair} THEN 1 ELSE 0 END`,
        poor: `CASE WHEN ${kpiField} >= ${thresholds.fair} THEN 1 ELSE 0 END`
      };
    }
    
    // CSC: higher values are better (inverted)
    if (kpi === 'csc') {
      const poorThreshold = thresholds.veryPoor || thresholds.poor!;
      return {
        good: `CASE WHEN ${kpiField} >= ${thresholds.fair} THEN 1 ELSE 0 END`,
        fair: `CASE WHEN ${kpiField} >= ${poorThreshold} AND ${kpiField} < ${thresholds.fair} THEN 1 ELSE 0 END`,
        poor: `CASE WHEN ${kpiField} < ${poorThreshold} THEN 1 ELSE 0 END`
      };
    }
    
    // PSCI: 1-10 scale, higher is better
    if (kpi === 'psci') {
      return {
        good: `CASE WHEN ${kpiField} > 6 THEN 1 ELSE 0 END`,
        fair: `CASE WHEN ${kpiField} > 4 AND ${kpiField} <= 6 THEN 1 ELSE 0 END`,
        poor: `CASE WHEN ${kpiField} <= 4 THEN 1 ELSE 0 END`
      };
    }
    
    // MPD: specific thresholds for skid resistance
    if (kpi === 'mpd') {
      return {
        good: `CASE WHEN ${kpiField} >= ${thresholds.good} THEN 1 ELSE 0 END`,
        fair: `CASE WHEN ${kpiField} >= ${thresholds.poor} AND ${kpiField} < ${thresholds.good} THEN 1 ELSE 0 END`,
        poor: `CASE WHEN ${kpiField} < ${thresholds.poor} THEN 1 ELSE 0 END`
      };
    }
    
    // Default fallback (shouldn't reach here)
    return {
      good: 'CASE WHEN 1=0 THEN 1 ELSE 0 END',
      fair: 'CASE WHEN 1=0 THEN 1 ELSE 0 END',
      poor: 'CASE WHEN 1=0 THEN 1 ELSE 0 END'
    };
  }
  
  /**
   * Fallback method using separate queries if CASE expressions are not supported
   * This is less efficient but ensures compatibility
   */
  private static async executeFallbackQueries(
    layer: FeatureLayer,
    baseWhere: string,
    kpiField: string,
    lengthField: string,
    activeKpi: KPIKey
  ): Promise<any> {
    // First query: basic statistics
    const statsQuery = layer.createQuery();
    statsQuery.where = baseWhere;
    statsQuery.returnGeometry = false;
    statsQuery.outStatistics = [
      {
        onStatisticField: kpiField,
        outStatisticFieldName: 'avg_value',
        statisticType: 'avg'
      },
      {
        onStatisticField: kpiField,
        outStatisticFieldName: 'min_value',
        statisticType: 'min'
      },
      {
        onStatisticField: kpiField,
        outStatisticFieldName: 'max_value',
        statisticType: 'max'
      },
      {
        onStatisticField: kpiField,
        outStatisticFieldName: 'count_segments',
        statisticType: 'count'
      },
      {
        onStatisticField: lengthField,
        outStatisticFieldName: 'total_length',
        statisticType: 'sum'
      }
    ] as any;
    
    const statsResult = await layer.queryFeatures(statsQuery);
    const stats = statsResult.features[0]?.attributes || {};
    
    // Second set of queries: condition counts
    const conditionCounts = await this.getConditionCountsFallback(
      layer,
      baseWhere,
      kpiField,
      activeKpi
    );
    
    return {
      avgValue: stats.avg_value,
      minValue: stats.min_value,
      maxValue: stats.max_value,
      totalSegments: stats.count_segments,
      totalLength: stats.total_length,
      goodCount: conditionCounts.good,
      fairCount: conditionCounts.fair,
      poorCount: conditionCounts.poor
    };
  }
  
  /**
   * Fallback: Get counts of segments in each condition class using separate queries
   */
  private static async getConditionCountsFallback(
    layer: FeatureLayer,
    baseWhere: string,
    kpiField: string,
    activeKpi: KPIKey
  ): Promise<{ good: number; fair: number; poor: number }> {
    const thresholds = KPI_THRESHOLDS[activeKpi];
    
    // Build WHERE clauses for each condition class
    const whereGood = this.buildConditionWhere(baseWhere, kpiField, activeKpi, 'good', thresholds);
    const whereFair = this.buildConditionWhere(baseWhere, kpiField, activeKpi, 'fair', thresholds);
    const wherePoor = this.buildConditionWhere(baseWhere, kpiField, activeKpi, 'poor', thresholds);
    
    // Execute count queries in parallel
    const [goodResult, fairResult, poorResult] = await Promise.all([
      this.executeCountQuery(layer, whereGood),
      this.executeCountQuery(layer, whereFair),
      this.executeCountQuery(layer, wherePoor)
    ]);
    
    return {
      good: goodResult,
      fair: fairResult,
      poor: poorResult
    };
  }
  
  /**
   * Execute a count query
   */
  private static async executeCountQuery(layer: FeatureLayer, where: string): Promise<number> {
    try {
      const query = layer.createQuery();
      query.where = where;
      query.returnGeometry = false;
      const result = await layer.queryFeatureCount(query);
      return result || 0;
    } catch (error) {
      console.error('Count query error:', error);
      return 0;
    }
  }
  
  /**
   * Build WHERE clause for a specific condition class (fallback method)
   */
  private static buildConditionWhere(
    baseWhere: string,
    kpiField: string,
    kpi: KPIKey,
    conditionClass: 'good' | 'fair' | 'poor',
    thresholds: typeof KPI_THRESHOLDS[KPIKey]
  ): string {
    let conditionClause = '';
    
    // KPIs where lower values are better
    if (kpi === 'iri' || kpi === 'rut' || kpi === 'lpv3') {
      if (conditionClass === 'good') {
        conditionClause = `${kpiField} < ${thresholds.good}`;
      } else if (conditionClass === 'fair') {
        conditionClause = `${kpiField} >= ${thresholds.good} AND ${kpiField} < ${thresholds.fair}`;
      } else {
        conditionClause = `${kpiField} >= ${thresholds.fair}`;
      }
    }
    // CSC: higher values are better
    else if (kpi === 'csc') {
      const poorThreshold = thresholds.veryPoor || thresholds.poor!;
      if (conditionClass === 'good') {
        conditionClause = `${kpiField} >= ${thresholds.fair}`;
      } else if (conditionClass === 'fair') {
        conditionClause = `${kpiField} >= ${poorThreshold} AND ${kpiField} < ${thresholds.fair}`;
      } else {
        conditionClause = `${kpiField} < ${poorThreshold}`;
      }
    }
    // PSCI: 1-10 scale, higher is better
    else if (kpi === 'psci') {
      if (conditionClass === 'good') {
        conditionClause = `${kpiField} > 6`;
      } else if (conditionClass === 'fair') {
        conditionClause = `${kpiField} > 4 AND ${kpiField} <= 6`;
      } else {
        conditionClause = `${kpiField} <= 4`;
      }
    }
    // MPD thresholds
    else if (kpi === 'mpd') {
      if (conditionClass === 'good') {
        conditionClause = `${kpiField} >= ${thresholds.good}`;
      } else if (conditionClass === 'fair') {
        conditionClause = `${kpiField} >= ${thresholds.poor} AND ${kpiField} < ${thresholds.good}`;
      } else {
        conditionClause = `${kpiField} < ${thresholds.poor}`;
      }
    }
    
    // Combine with base WHERE clause
    return `(${baseWhere}) AND ${conditionClause}`;
  }
  
  /**
   * Compute grouped statistics for charts (e.g., by Local Authority, Route, etc.)
   */
  static async computeGroupedStatistics(
    layer: FeatureLayer | null,
    filters: FilterState,
    activeKpi: KPIKey,
    groupByField: string
  ): Promise<any[]> {
    if (!layer) {
      return this.getPlaceholderGroupedStats(groupByField);
    }
    
    try {
      const year = filters.year.length > 0 ? filters.year[0] : CONFIG.defaultYears[0];
      const kpiField = getKPIFieldName(activeKpi, year);
      
      // Build where clause with NULL filter
      const baseWhere = (layer as any).definitionExpression || '1=1';
      const whereClause = `(${baseWhere}) AND ${kpiField} IS NOT NULL`;
      
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
        avgValue: Math.round(f.attributes.avg_value * 100) / 100,
        count: f.attributes.count_segments
      }));
      
    } catch (error) {
      console.error('Error computing grouped statistics:', error);
      return this.getPlaceholderGroupedStats(groupByField);
    }
  }
  
  /**
   * Get placeholder statistics for development
   */
  private static getPlaceholderStats(activeKpi: KPIKey): SummaryStatistics {
    const mockValues = {
      iri: { avg: 4.5, min: 2.1, max: 8.3 },
      rut: { avg: 8.2, min: 3.5, max: 18.1 },
      psci: { avg: 6.8, min: 3, max: 9 },
      csc: { avg: 0.45, min: 0.32, max: 0.58 },
      mpd: { avg: 0.75, min: 0.4, max: 1.2 },
      lpv3: { avg: 4.8, min: 1.5, max: 9.2 }
    };
    
    const values = mockValues[activeKpi];
    
    return {
      totalSegments: 200,
      totalLengthKm: 150.5,
      metrics: [{
        metric: activeKpi.toUpperCase(),
        average: values.avg,
        min: values.min,
        max: values.max,
        goodCount: 120,
        fairCount: 60,
        poorCount: 20,
        goodPct: 60,
        fairPct: 30,
        poorPct: 10
      }],
      lastUpdated: new Date()
    };
  }
  
  /**
   * Get placeholder grouped statistics for development
   */
  private static getPlaceholderGroupedStats(groupByField: string): any[] {
    const groups = groupByField.includes('LA') ? 
      ['Dublin City', 'Cork County', 'Galway County', 'Limerick City'] :
      ['R123', 'R456', 'R750', 'R999'];
    
    return groups.map(g => ({
      group: g,
      avgValue: Math.random() * 5 + 2,
      count: Math.floor(Math.random() * 50 + 10)
    }));
  }
  
  /**
   * Get empty statistics when no data is available
   */
  private static getEmptyStats(activeKpi: KPIKey): SummaryStatistics {
    return {
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
  }
}
