import type FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import Query from '@arcgis/core/rest/support/Query';
import {
  CONFIG,
  KPIKey,
  KPI_THRESHOLDS,
  getKPIFieldName,
  SEGMENT_LENGTH_METERS
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

    // Validate year early
    {
      const year = filters.year.length > 0 ? filters.year[0] : CONFIG.defaultYears[0];
      if (typeof year !== 'number') {
        console.error(`[StatisticsService] Year must be a number, received: ${typeof year}`, year);
        return this.getEmptyStats(activeKpi);
      }
      console.log(`[StatisticsService] Computing stats for ${activeKpi} in year ${year}`);
    }

    try {
      const year = filters.year.length > 0 ? filters.year[0] : CONFIG.defaultYears[0];
      if (typeof year !== 'number') {
        console.error(`[StatisticsService] Year must be a number, received: ${typeof year}`, year);
        return this.getEmptyStats(activeKpi);
      }
      console.log(`[StatisticsService] Computing stats for ${activeKpi} in year ${year}`);

      const kpiField = getKPIFieldName(activeKpi, year);

      // Build where clause based on current definition expression
      const baseWhere = (layer as any).definitionExpression || '1=1';
      const whereClause = `(${baseWhere}) AND ${kpiField} IS NOT NULL`;

      console.log(`[StatisticsService] Query where clause: ${whereClause}`);

      // Execute optimized query for both statistics and condition counts (5-class)
      const results = await this.executeOptimizedQuery(
        layer,
        whereClause,
        kpiField,
        activeKpi
      );

      if (!results) {
        console.warn('[StatisticsService] Query returned no results');
        return this.getEmptyStats(activeKpi);
      }

      console.log(`[StatisticsService] Query results:`, results);

      // Total length derived from segment count * constant segment length (m -> km)
      const totalLengthKm = (results.totalSegments || 0) * SEGMENT_LENGTH_METERS / 1000;

      // 5-class percentages
      const total =
        results.veryGoodCount +
        results.goodCount +
        results.fairCount +
        results.poorCount +
        results.veryPoorCount;

      const pct = (n: number) => (total > 0 ? (n / total) * 100 : 0);
      const veryGoodPct = pct(results.veryGoodCount);
      const goodPct = pct(results.goodCount);
      const fairPct = pct(results.fairCount);
      const poorPct = pct(results.poorCount);
      const veryPoorPct = pct(results.veryPoorCount);

      const kpiStats: KPIStats = {
        metric: activeKpi.toUpperCase(),
        average: results.avgValue || 0,
        min: results.minValue || 0,
        max: results.maxValue || 0,

        veryGoodCount: results.veryGoodCount,
        goodCount: results.goodCount,
        fairCount: results.fairCount,
        poorCount: results.poorCount,
        veryPoorCount: results.veryPoorCount,

        veryGoodPct: Math.round(veryGoodPct * 10) / 10,
        goodPct: Math.round(goodPct * 10) / 10,
        fairPct: Math.round(fairPct * 10) / 10,
        poorPct: Math.round(poorPct * 10) / 10,
        veryPoorPct: Math.round(veryPoorPct * 10) / 10
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
   * Execute an optimized single query for all statistics and 5-class condition counts
   */
  private static async executeOptimizedQuery(
    layer: FeatureLayer,
    whereClause: string,
    kpiField: string,
    activeKpi: KPIKey
  ): Promise<any> {
    const statsQuery = layer.createQuery();
    statsQuery.where = whereClause;
    statsQuery.returnGeometry = false;

    // Get thresholds for this KPI
    const thresholds = KPI_THRESHOLDS[activeKpi];

    // Build CASE expressions for 5-class counting
    const conditionExpressions = this.buildConditionExpressions(kpiField, activeKpi, thresholds);

    // Define comprehensive statistics in a single query
    statsQuery.outStatistics = [
      // Basic statistics
      { onStatisticField: kpiField, outStatisticFieldName: 'avg_value', statisticType: 'avg' },
      { onStatisticField: kpiField, outStatisticFieldName: 'min_value', statisticType: 'min' },
      { onStatisticField: kpiField, outStatisticFieldName: 'max_value', statisticType: 'max' },
      { onStatisticField: kpiField, outStatisticFieldName: 'count_segments', statisticType: 'count' },

      // 5-class counts
      { onStatisticField: conditionExpressions.veryGood, outStatisticFieldName: 'very_good_count', statisticType: 'sum' },
      { onStatisticField: conditionExpressions.good, outStatisticFieldName: 'good_count', statisticType: 'sum' },
      { onStatisticField: conditionExpressions.fair, outStatisticFieldName: 'fair_count', statisticType: 'sum' },
      { onStatisticField: conditionExpressions.poor, outStatisticFieldName: 'poor_count', statisticType: 'sum' },
      { onStatisticField: conditionExpressions.veryPoor, outStatisticFieldName: 'very_poor_count', statisticType: 'sum' }
    ] as any;

    try {
      const result = await layer.queryFeatures(statsQuery);
      if (!result.features.length) return null;

      const stats = result.features[0].attributes;

      return {
        avgValue: stats.avg_value,
        minValue: stats.min_value,
        maxValue: stats.max_value,
        totalSegments: stats.count_segments,

        veryGoodCount: Math.round(stats.very_good_count || 0),
        goodCount: Math.round(stats.good_count || 0),
        fairCount: Math.round(stats.fair_count || 0),
        poorCount: Math.round(stats.poor_count || 0),
        veryPoorCount: Math.round(stats.very_poor_count || 0)
      };
    } catch (error) {
      console.error('Error executing optimized query:', error);
      console.log('Query details:', { whereClause, kpiField, activeKpi });

      // Fallback to separate queries (kept 3-class for resilience)
      return this.executeFallbackQueries(layer, whereClause, kpiField, activeKpi);
    }
  }

  /**
   * Build SQL CASE expressions for 5-class condition counts.
   * Boundaries are inclusive/exclusive to avoid gaps/overlaps per report definitions.
   */
  private static buildConditionExpressions(
    kpiField: string,
    kpi: KPIKey,
    thresholds: typeof KPI_THRESHOLDS[KPIKey]
  ): { veryGood: string; good: string; fair: string; poor: string; veryPoor: string } {
    // Lower-is-better KPIs
    if (kpi === 'iri' || kpi === 'rut' || kpi === 'lpv3') {
      const vg = thresholds.veryGood!;
      const g = thresholds.good;
      const f = thresholds.fair;
      const p = thresholds.poor!;
      return {
        veryGood: `CASE WHEN ${kpiField} < ${vg} THEN 1 ELSE 0 END`,
        good:     `CASE WHEN ${kpiField} >= ${vg} AND ${kpiField} < ${g} THEN 1 ELSE 0 END`,
        fair:     `CASE WHEN ${kpiField} >= ${g} AND ${kpiField} < ${f} THEN 1 ELSE 0 END`,
        poor:     `CASE WHEN ${kpiField} >= ${f} AND ${kpiField} < ${p} THEN 1 ELSE 0 END`,
        veryPoor: `CASE WHEN ${kpiField} >= ${p} THEN 1 ELSE 0 END`
      };
    }

    // CSC (higher is better, inverted)
    if (kpi === 'csc') {
      const vg = thresholds.good;      // > 0.50
      const g  = thresholds.fair;      // >= 0.45
      const f  = thresholds.poor!;     // >= 0.40
      const vp = thresholds.veryPoor!; // <= 0.35
      return {
        veryGood: `CASE WHEN ${kpiField} > ${vg} THEN 1 ELSE 0 END`,
        good:     `CASE WHEN ${kpiField} > ${g}  AND ${kpiField} <= ${vg} THEN 1 ELSE 0 END`,
        fair:     `CASE WHEN ${kpiField} > ${f}  AND ${kpiField} <= ${g}  THEN 1 ELSE 0 END`,
        poor:     `CASE WHEN ${kpiField} > ${vp} AND ${kpiField} <= ${f}  THEN 1 ELSE 0 END`,
        veryPoor: `CASE WHEN ${kpiField} <= ${vp} THEN 1 ELSE 0 END`
      };
    }

    // PSCI (app 5-bucket convention)
    if (kpi === 'psci') {
      return {
        veryGood: `CASE WHEN ${kpiField} > 8 THEN 1 ELSE 0 END`,
        good:     `CASE WHEN ${kpiField} > 6 AND ${kpiField} <= 8 THEN 1 ELSE 0 END`,
        fair:     `CASE WHEN ${kpiField} > 4 AND ${kpiField} <= 6 THEN 1 ELSE 0 END`,
        poor:     `CASE WHEN ${kpiField} > 2 AND ${kpiField} <= 4 THEN 1 ELSE 0 END`,
        veryPoor: `CASE WHEN ${kpiField} <= 2 THEN 1 ELSE 0 END`
      };
    }

    // MPD (keep 3 buckets but map to 5-class endpoints)
    if (kpi === 'mpd') {
      const good = thresholds.good; // >= 0.7
      const fair = thresholds.fair; // >= 0.65
      const poor = thresholds.poor; // < 0.6
      return {
        // collapse to ends/middle to fit 5 counters
        veryGood: `CASE WHEN ${kpiField} >= ${good} THEN 1 ELSE 0 END`,
        good:     `CASE WHEN 1=0 THEN 1 ELSE 0 END`,
        fair:     `CASE WHEN ${kpiField} >= ${fair} AND ${kpiField} < ${good} THEN 1 ELSE 0 END`,
        poor:     `CASE WHEN 1=0 THEN 1 ELSE 0 END`,
        veryPoor: `CASE WHEN ${kpiField} < ${poor} THEN 1 ELSE 0 END`
      };
    }

    // Default fallback
    return {
      veryGood: 'CASE WHEN 1=0 THEN 1 ELSE 0 END',
      good:     'CASE WHEN 1=0 THEN 1 ELSE 0 END',
      fair:     'CASE WHEN 1=0 THEN 1 ELSE 0 END',
      poor:     'CASE WHEN 1=0 THEN 1 ELSE 0 END',
      veryPoor: 'CASE WHEN 1=0 THEN 1 ELSE 0 END'
    };
  }

  /**
   * Fallback method (3-class) using separate queries if CASE expressions aren't supported.
   * Keeps app functioning, though percentages will reflect 3-class in this code path.
   */
  private static async executeFallbackQueries(
    layer: FeatureLayer,
    baseWhere: string,
    kpiField: string,
    activeKpi: KPIKey
  ): Promise<any> {
    const statsQuery = layer.createQuery();
    statsQuery.where = baseWhere;
    statsQuery.returnGeometry = false;
    statsQuery.outStatistics = [
      { onStatisticField: kpiField, outStatisticFieldName: 'avg_value', statisticType: 'avg' },
      { onStatisticField: kpiField, outStatisticFieldName: 'min_value', statisticType: 'min' },
      { onStatisticField: kpiField, outStatisticFieldName: 'max_value', statisticType: 'max' },
      { onStatisticField: kpiField, outStatisticFieldName: 'count_segments', statisticType: 'count' }
    ] as any;

    const statsResult = await layer.queryFeatures(statsQuery);
    const stats = statsResult.features[0]?.attributes || {};

    const conditionCounts = await this.getConditionCountsFallback(
      layer,
      baseWhere,
      kpiField,
      activeKpi
    );

    // Map 3-class to 5-class shape (collapse ends/middle)
    return {
      avgValue: stats.avg_value,
      minValue: stats.min_value,
      maxValue: stats.max_value,
      totalSegments: stats.count_segments,

      veryGoodCount: 0,
      goodCount: conditionCounts.good,
      fairCount: conditionCounts.fair,
      poorCount: conditionCounts.poor,
      veryPoorCount: 0
    };
  }

  private static async getConditionCountsFallback(
    layer: FeatureLayer,
    baseWhere: string,
    kpiField: string,
    activeKpi: KPIKey
  ): Promise<{ good: number; fair: number; poor: number }> {
    const thresholds = KPI_THRESHOLDS[activeKpi];

    const whereGood = this.buildConditionWhere(baseWhere, kpiField, activeKpi, 'good', thresholds);
    const whereFair = this.buildConditionWhere(baseWhere, kpiField, activeKpi, 'fair', thresholds);
    const wherePoor = this.buildConditionWhere(baseWhere, kpiField, activeKpi, 'poor', thresholds);

    const [goodResult, fairResult, poorResult] = await Promise.all([
      this.executeCountQuery(layer, whereGood),
      this.executeCountQuery(layer, whereFair),
      this.executeCountQuery(layer, wherePoor)
    ]);

    return { good: goodResult, fair: fairResult, poor: poorResult };
  }

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

  private static buildConditionWhere(
    baseWhere: string,
    kpiField: string,
    kpi: KPIKey,
    conditionClass: 'good' | 'fair' | 'poor',
    thresholds: typeof KPI_THRESHOLDS[KPIKey]
  ): string {
    let conditionClause = '';

    if (kpi === 'iri' || kpi === 'rut' || kpi === 'lpv3') {
      if (conditionClass === 'good') {
        conditionClause = `${kpiField} < ${thresholds.good}`;
      } else if (conditionClass === 'fair') {
        conditionClause = `${kpiField} >= ${thresholds.good} AND ${kpiField} < ${thresholds.fair}`;
      } else {
        conditionClause = `${kpiField} >= ${thresholds.fair}`;
      }
    } else if (kpi === 'csc') {
      const poorThreshold = thresholds.veryPoor || thresholds.poor!;
      if (conditionClass === 'good') {
        conditionClause = `${kpiField} >= ${thresholds.fair}`;
      } else if (conditionClass === 'fair') {
        conditionClause = `${kpiField} >= ${poorThreshold} AND ${kpiField} < ${thresholds.fair}`;
      } else {
        conditionClause = `${kpiField} < ${poorThreshold}`;
      }
    } else if (kpi === 'psci') {
      if (conditionClass === 'good') {
        conditionClause = `${kpiField} > 6`;
      } else if (conditionClass === 'fair') {
        conditionClause = `${kpiField} > 4 AND ${kpiField} <= 6`;
      } else {
        conditionClause = `${kpiField} <= 4`;
      }
    } else if (kpi === 'mpd') {
      if (conditionClass === 'good') {
        conditionClause = `${kpiField} >= ${thresholds.good}`;
      } else if (conditionClass === 'fair') {
        conditionClause = `${kpiField} >= ${thresholds.poor} AND ${kpiField} < ${thresholds.good}`;
      } else {
        conditionClause = `${kpiField} < ${thresholds.poor}`;
      }
    }

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

      const baseWhere = (layer as any).definitionExpression || '1=1';
      const whereClause = `(${baseWhere}) AND ${kpiField} IS NOT NULL`;

      const query = layer.createQuery();
      query.where = whereClause;
      query.returnGeometry = false;
      query.groupByFieldsForStatistics = [groupByField];
      query.outStatistics = [
        { onStatisticField: kpiField, outStatisticFieldName: 'avg_value', statisticType: 'avg' },
        { onStatisticField: kpiField, outStatisticFieldName: 'count_segments', statisticType: 'count' }
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
   * Placeholder stats (now 5-class shape)
   */
  private static getPlaceholderStats(activeKpi: KPIKey): SummaryStatistics {
    const mockValues = {
      iri:  { avg: 4.5, min: 2.1, max: 8.3 },
      rut:  { avg: 8.2, min: 3.5, max: 18.1 },
      psci: { avg: 6.8, min: 3,   max: 9 },
      csc:  { avg: 0.45, min: 0.32, max: 0.58 },
      mpd:  { avg: 0.75, min: 0.4,  max: 1.2 },
      lpv3: { avg: 4.8, min: 1.5,   max: 9.2 }
    } as const;

    const v = mockValues[activeKpi];

    return {
      totalSegments: 200,
      totalLengthKm: 20, // 200 * 100m = 20 km
      metrics: [{
        metric: activeKpi.toUpperCase(),
        average: v.avg,
        min: v.min,
        max: v.max,

        veryGoodCount: 60,
        goodCount: 60,
        fairCount: 40,
        poorCount: 30,
        veryPoorCount: 10,

        veryGoodPct: 30,
        goodPct: 30,
        fairPct: 20,
        poorPct: 15,
        veryPoorPct: 5
      }],
      lastUpdated: new Date()
    };
  }

  private static getPlaceholderGroupedStats(groupByField: string): any[] {
    const groups = groupByField.includes('LA')
      ? ['Dublin City', 'Cork County', 'Galway County', 'Limerick City']
      : ['R123', 'R456', 'R750', 'R999'];

    return groups.map(g => ({
      group: g,
      avgValue: Math.random() * 5 + 2,
      count: Math.floor(Math.random() * 50 + 10)
    }));
  }

  /**
   * Empty stats in case of errors
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

        veryGoodCount: 0,
        goodCount: 0,
        fairCount: 0,
        poorCount: 0,
        veryPoorCount: 0,

        veryGoodPct: 0,
        goodPct: 0,
        fairPct: 0,
        poorPct: 0,
        veryPoorPct: 0
      }],
      lastUpdated: new Date()
    };
  }
}
