import type FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import Query from '@arcgis/core/rest/support/Query';
import {
  CONFIG,
  KPIKey,
  KPI_THRESHOLDS,
  getKPIFieldName,
  SEGMENT_LENGTH_KM
} from '@/config/appConfig';
import QueryService from './QueryService';
import type { FilterState, SummaryStatistics, GroupedConditionStats } from '@/types';

interface ChartSelection {
  group: string;
  condition: string;
  kpi: KPIKey;
  year: number;
}

/**
 * Service for computing pavement condition statistics.
 * Uses centralized thresholds from appConfig and optimized queries.
 */
export default class StatisticsService {

  /**
   * Helper: Get CASE expressions for classifying KPI values
   * Updated with correct PSCI classification (4 classes)
   */
  private static getClassificationExpressions(
    kpi: KPIKey,
    kpiField: string
  ): { veryGood: string; good: string; fair: string; poor: string; veryPoor: string } {
    const thresholds = KPI_THRESHOLDS[kpi];

    // Lower-is-better KPIs
    if (kpi === 'iri' || kpi === 'rut' || kpi === 'lpv3') {
      const vg = thresholds.veryGood || thresholds.good;
      const g = thresholds.good;
      const f = thresholds.fair;
      const p = thresholds.poor || f;
      return {
        veryGood: `CASE WHEN ${kpiField} < ${vg} THEN 1 ELSE 0 END`,
        good:     `CASE WHEN ${kpiField} >= ${vg} AND ${kpiField} < ${g} THEN 1 ELSE 0 END`,
        fair:     `CASE WHEN ${kpiField} >= ${g} AND ${kpiField} < ${f} THEN 1 ELSE 0 END`,
        poor:     `CASE WHEN ${kpiField} >= ${f} AND ${kpiField} < ${p} THEN 1 ELSE 0 END`,
        veryPoor: `CASE WHEN ${kpiField} >= ${p} THEN 1 ELSE 0 END`,
      };
    }

    // CSC (higher is better, inverted)
    if (kpi === 'csc') {
      const vg = thresholds.good;      // >= 0.50
      const g = thresholds.fair;       // >= 0.45
      const f = thresholds.poor!;      // >= 0.40
      const vp = thresholds.veryPoor!; // <= 0.35
      return {
        veryGood: `CASE WHEN ${kpiField} > ${vg} THEN 1 ELSE 0 END`,
        good:     `CASE WHEN ${kpiField} > ${g}  AND ${kpiField} <= ${vg} THEN 1 ELSE 0 END`,
        fair:     `CASE WHEN ${kpiField} > ${f}  AND ${kpiField} <= ${g}  THEN 1 ELSE 0 END`,
        poor:     `CASE WHEN ${kpiField} > ${vp} AND ${kpiField} <= ${f}  THEN 1 ELSE 0 END`,
        veryPoor: `CASE WHEN ${kpiField} <= ${vp} THEN 1 ELSE 0 END`,
      };
    }

    // PSCI (4 classes: 9-10, 7-8, 5-6, 1-4)
    if (kpi === 'psci') {
      return {
        veryGood: `CASE WHEN ${kpiField} >= 9 THEN 1 ELSE 0 END`,
        good:     `CASE WHEN ${kpiField} >= 7 AND ${kpiField} < 9 THEN 1 ELSE 0 END`,
        fair:     `CASE WHEN ${kpiField} >= 5 AND ${kpiField} < 7 THEN 1 ELSE 0 END`,
        poor:     `CASE WHEN ${kpiField} >= 1 AND ${kpiField} < 5 THEN 1 ELSE 0 END`,
        veryPoor: `CASE WHEN 1=0 THEN 1 ELSE 0 END`  // No class 5 for PSCI
      };
    }

    // MPD (3 classes: Good, Fair, Poor)
    if (kpi === 'mpd') {
      const good = thresholds.good; // >= 0.7
      const poor = thresholds.poor!; // < 0.6
      return {
        veryGood: `CASE WHEN ${kpiField} >= ${good} THEN 1 ELSE 0 END`,
        good:     `CASE WHEN 1=0 THEN 1 ELSE 0 END`,  // No separate good class
        fair:     `CASE WHEN ${kpiField} >= ${poor} AND ${kpiField} < ${good} THEN 1 ELSE 0 END`,
        poor:     `CASE WHEN 1=0 THEN 1 ELSE 0 END`,  // No separate poor class
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
   * NEW: Calculate statistics using pre-calculated class fields
   * Much faster than raw value calculations
   * UPDATED: Now performs a single query for counts AND avg/min/max
   */
  private static async calculateStatsWithClassFields(
    layer: __esri.FeatureLayer,
    kpi: KPIKey,
    year: number,
    filters: FilterState
  ): Promise<SummaryStatistics> {
    const classFieldName = getKPIFieldName(kpi, year, true);  // Get class field name
    const rawKpiField = getKPIFieldName(kpi, year, false); // Get raw field name
    const where = QueryService.buildDefinitionExpression(filters);

    // Build statistics definition for class field counts
    const statDefinitions = [
      // Overall stats
      { onStatisticField: '1', outStatisticFieldName: 'total_segment_count', statisticType: 'count' as const },
      { onStatisticField: rawKpiField, outStatisticFieldName: 'avg_val', statisticType: 'avg' as const },
      { onStatisticField: rawKpiField, outStatisticFieldName: 'min_val', statisticType: 'min' as const },
      { onStatisticField: rawKpiField, outStatisticFieldName: 'max_val', statisticType: 'max' as const },
      // Class counts
      { onStatisticField: `CASE WHEN ${classFieldName} = 1 THEN 1 ELSE 0 END`, outStatisticFieldName: 'class1_sum', statisticType: 'sum' as const },
      { onStatisticField: `CASE WHEN ${classFieldName} = 2 THEN 1 ELSE 0 END`, outStatisticFieldName: 'class2_sum', statisticType: 'sum' as const },
      { onStatisticField: `CASE WHEN ${classFieldName} = 3 THEN 1 ELSE 0 END`, outStatisticFieldName: 'class3_sum', statisticType: 'sum' as const },
      { onStatisticField: `CASE WHEN ${classFieldName} = 4 THEN 1 ELSE 0 END`, outStatisticFieldName: 'class4_sum', statisticType: 'sum' as const },
      { onStatisticField: `CASE WHEN ${classFieldName} = 5 THEN 1 ELSE 0 END`, outStatisticFieldName: 'class5_sum', statisticType: 'sum' as const }
    ];

    // Create query with grouping by class value
    const query = layer.createQuery();
    query.where = `${where} AND ${classFieldName} IS NOT NULL`;
    query.outStatistics = statDefinitions;
    // NO grouping - we get all stats in one go

    const result = await layer.queryFeatures(query);
    
    if (result.features.length === 0 || !result.features[0].attributes) {
      return this.getEmptyStats(kpi);
    }

    const attrs = result.features[0].attributes;

    // Parse results into counts by class
    let veryGoodCount = 0;
    let goodCount = 0;
    let fairCount = 0;
    let poorCount = 0;
    let veryPoorCount = 0;

    if (kpi === 'psci') {
      // PSCI: 4 classes
      veryGoodCount = attrs.class1_sum || 0;
      goodCount = attrs.class2_sum || 0;
      fairCount = attrs.class3_sum || 0;
      poorCount = attrs.class4_sum || 0;
    } else if (kpi === 'mpd') {
      // MPD: 3 classes (map to 5-class structure)
      veryGoodCount = attrs.class1_sum || 0; // Good → Very Good
      fairCount = attrs.class2_sum || 0;     // Fair → Fair
      veryPoorCount = attrs.class3_sum || 0; // Poor → Very Poor
    } else {
      // Standard 5 classes
      veryGoodCount = attrs.class1_sum || 0;
      goodCount = attrs.class2_sum || 0;
      fairCount = attrs.class3_sum || 0;
      poorCount = attrs.class4_sum || 0;
      veryPoorCount = attrs.class5_sum || 0;
    }

    // Calculate totals and percentages
    const totalSegments = veryGoodCount + goodCount + fairCount + poorCount + veryPoorCount;
    if (totalSegments === 0) {
      return this.getEmptyStats(kpi);
    }
    
    const totalLengthKm = totalSegments * SEGMENT_LENGTH_KM;

    const pct = (count: number) => (totalSegments > 0 ? (count / totalSegments) * 100 : 0);
    const fairOrBetterCount = veryGoodCount + goodCount + fairCount;

    return {
      kpi: kpi.toUpperCase(),
      year,
      totalSegments,
      totalLengthKm,
      veryGoodCount,
      goodCount,
      fairCount,
      poorCount,
      veryPoorCount,
      veryGoodPct: pct(veryGoodCount),
      goodPct: pct(goodCount),
      fairPct: pct(fairCount),
      poorPct: pct(poorCount),
      veryPoorPct: pct(veryPoorCount),
      fairOrBetterPct: pct(fairOrBetterCount),
      // ADDED: Avg/Min/Max/Timestamp
      avgValue: attrs.avg_val || 0,
      minValue: attrs.min_val || 0,
      maxValue: attrs.max_val || 0,
      lastUpdated: new Date().toISOString()
    };
  }

  /**
   * FALLBACK: Calculate statistics using raw values with threshold calculations
   * Used when class fields are not available
   * UPDATED: Now includes avg/min/max
   */
  private static async calculateStatsWithRawValues(
    layer: __esri.FeatureLayer,
    kpi: KPIKey,
    year: number,
    filters: FilterState
  ): Promise<SummaryStatistics> {
    const kpiField = getKPIFieldName(kpi, year, false);  // Get raw field name
    const where = QueryService.buildDefinitionExpression(filters);

    // Get classification expressions
    const classExpressions = this.getClassificationExpressions(kpi, kpiField);

    const statDefinitions = [
      { 
        onStatisticField: '1', 
        outStatisticFieldName: 'total_count', 
        statisticType: 'count' as const 
      },
      { 
        onStatisticField: classExpressions.veryGood, 
        outStatisticFieldName: 'veryGood_sum', 
        statisticType: 'sum' as const 
      },
      { 
        onStatisticField: classExpressions.good, 
        outStatisticFieldName: 'good_sum', 
        statisticType: 'sum' as const 
      },
      { 
        onStatisticField: classExpressions.fair, 
        outStatisticFieldName: 'fair_sum', 
        statisticType: 'sum' as const 
      },
      { 
        onStatisticField: classExpressions.poor, 
        outStatisticFieldName: 'poor_sum', 
        statisticType: 'sum' as const 
      },
      { 
        onStatisticField: classExpressions.veryPoor, 
        outStatisticFieldName: 'veryPoor_sum', 
        statisticType: 'sum' as const 
      },
      // ADDED: Avg/Min/Max
      { 
        onStatisticField: kpiField, 
        outStatisticFieldName: 'avg_val', 
        statisticType: 'avg' as const 
      },
      { 
        onStatisticField: kpiField, 
        outStatisticFieldName: 'min_val', 
        statisticType: 'min' as const 
      },
      { 
        onStatisticField: kpiField, 
        outStatisticFieldName: 'max_val', 
        statisticType: 'max' as const 
      }
    ];

    const query = layer.createQuery();
    query.where = `${where} AND ${kpiField} IS NOT NULL`;
    query.outStatistics = statDefinitions;
    
    const result = await layer.queryFeatures(query);

    if (result.features.length === 0 || !result.features[0].attributes) {
      return this.getEmptyStats(kpi);
    }

    const attrs = result.features[0].attributes;
    const totalSegments = attrs.total_count || 0;
    if (totalSegments === 0) {
      return this.getEmptyStats(kpi);
    }
    
    const totalLengthKm = totalSegments * SEGMENT_LENGTH_KM;

    const veryGoodCount = attrs.veryGood_sum || 0;
    const goodCount = attrs.good_sum || 0;
    const fairCount = attrs.fair_sum || 0;
    const poorCount = attrs.poor_sum || 0;
    const veryPoorCount = attrs.veryPoor_sum || 0;

    const pct = (count: number) => (totalSegments > 0 ? (count / totalSegments) * 100 : 0);
    const fairOrBetterCount = veryGoodCount + goodCount + fairCount;

    return {
      kpi: kpi.toUpperCase(),
      year,
      totalSegments,
      totalLengthKm,
      veryGoodCount,
      goodCount,
      fairCount,
      poorCount,
      veryPoorCount,
      veryGoodPct: pct(veryGoodCount),
      goodPct: pct(goodCount),
      fairPct: pct(fairCount),
      poorPct: pct(poorCount),
      veryPoorPct: pct(veryPoorCount),
      fairOrBetterPct: pct(fairOrBetterCount),
      // ADDED: Avg/Min/Max/Timestamp
      avgValue: attrs.avg_val || 0,
      minValue: attrs.min_val || 0,
      maxValue: attrs.max_val || 0,
      lastUpdated: new Date().toISOString()
    };
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
   * Computes overall summary statistics for a given KPI and filters.
   * This method orchestrates the use of pre-calculated class fields or raw value calculations.
   * @param layer - The FeatureLayer to query.
   * @param filters - The current filter state.
   * @param kpi - The active KPI.
   * @returns A promise that resolves to SummaryStatistics.
   */
  static async computeSummary(
    layer: __esri.FeatureLayer | null,
    filters: FilterState,
    kpi: KPIKey
  ): Promise<SummaryStatistics> {
    if (!layer) {
      console.error('[Statistics] Road layer not loaded - cannot calculate statistics');
      return this.getEmptyStats(kpi, filters.year);
    }

    const year = filters.year || CONFIG.defaultYear;
    const classFieldName = getKPIFieldName(kpi, year, true);
    const hasClassField = layer.fields.some(field => field.name === classFieldName);

    if (hasClassField) {
      console.log(`[StatisticsService] Using class fields for ${kpi} ${year}`);
      return this.calculateStatsWithClassFields(layer, kpi, year, filters);
    } else {
      console.warn(`[StatisticsService] Class field '${classFieldName}' not found. Falling back to raw value calculation for ${kpi} ${year}.`);
      return this.calculateStatsWithRawValues(layer, kpi, year, filters);
    }
  }

  /**
   * Compute grouped statistics for charts (e.g., by Local Authority, Route, etc.)
   */
  static async computeGroupedStatistics( // This method is no longer used by EnhancedChartPanel but is kept for completeness
    layer: __esri.FeatureLayer | null,
    filters: FilterState,
    activeKpi: KPIKey,
    groupByField: string
  ): Promise<any[]> {
    if (!layer) {
      console.error('[Statistics] Road layer not loaded - cannot calculate grouped statistics');
      return [];
    }

    try {
      const year = filters.year || CONFIG.defaultYear;
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
      throw new Error(`Failed to compute grouped statistics for ${groupByField}.`);
    }
  }

  /**
   * Compute grouped statistics with condition class breakdowns
   * Returns data suitable for stacked bar charts
   * FIXED: Now properly handles subgroup grouping
   * UPDATED: Now includes avg/min/max in summary
   */
  static async computeGroupedStatisticsWithConditions(
    layer: __esri.FeatureLayer | null,
    filters: FilterState,
    activeKpi: KPIKey,
    groupByField: string
  ): Promise<GroupedConditionStats[]> {
    if (!layer) {
      console.error('[Statistics] Road layer not loaded - cannot calculate grouped condition statistics');
      return [];
    }

    try {
      const year = filters.year || CONFIG.defaultYear;
      const kpiField = getKPIFieldName(activeKpi, year);
      const baseWhere = (layer as any).definitionExpression || '1=1';
      const whereClause = `(${baseWhere}) AND ${kpiField} IS NOT NULL`;
      
      let groups: string[];
      
      // CRITICAL FIX: Handle subgroup specially
      if (groupByField === 'subgroup') {
        // For subgroups, use predefined categories
        groups = CONFIG.filters.subgroup.options?.map(opt => opt.label) || [];
      } else {
        // For regular fields, query unique values
        const groupQuery = layer.createQuery();
        groupQuery.where = whereClause;
        groupQuery.returnDistinctValues = true;
        groupQuery.outFields = [groupByField];
        groupQuery.returnGeometry = false;
        
        const groupResult = await layer.queryFeatures(groupQuery);
        groups = groupResult.features.map(f => f.attributes[groupByField]).filter(g => g != null);
      }

      // For each group, calculate condition breakdowns
      const groupedStats = await Promise.all(groups.map(async (groupValue) => {
        let groupWhere: string;
        
        // CRITICAL FIX: Build WHERE clause based on group type
        if (groupByField === 'subgroup') {
          // For subgroups, use the special WHERE clause builder
          const subgroupOption = CONFIG.filters.subgroup.options?.find(opt => opt.label === groupValue);
          if (!subgroupOption) {
            console.warn(`No subgroup option found for: ${groupValue}`);
            return null;
          }
          
          if (subgroupOption.value === 'Rural') {
            groupWhere = `${whereClause} AND (Roads_Joined_IsFormerNa = 0 AND Roads_Joined_IsDublin = 0 AND Roads_Joined_IsCityTown = 0 AND Roads_Joined_IsPeat = 0)`;
          } else {
            groupWhere = `${whereClause} AND ${subgroupOption.value} = 1`;
          }
        } else {
          // For regular fields, use simple equality
          groupWhere = `${whereClause} AND ${groupByField} = '${groupValue.toString().replace(/'/g, "''")}'`;
        }
        
        // Build condition expressions for this KPI
        const conditionExpressions = this.getClassificationExpressions(activeKpi, kpiField);
        
        // Query for condition counts
        const statsQuery = layer.createQuery();
        statsQuery.where = groupWhere;
        statsQuery.returnGeometry = false;
        statsQuery.outStatistics = [
          { onStatisticField: kpiField, outStatisticFieldName: 'avg_value', statisticType: 'avg' },
          { onStatisticField: kpiField, outStatisticFieldName: 'min_value', statisticType: 'min' },
          { onStatisticField: kpiField, outStatisticFieldName: 'max_value', statisticType: 'max' },
          { onStatisticField: kpiField, outStatisticFieldName: 'total_count', statisticType: 'count' },
          { onStatisticField: conditionExpressions.veryGood, outStatisticFieldName: 'veryGood_sum', statisticType: 'sum' },
          { onStatisticField: conditionExpressions.good, outStatisticFieldName: 'good_sum', statisticType: 'sum' },
          { onStatisticField: conditionExpressions.fair, outStatisticFieldName: 'fair_sum', statisticType: 'sum' },
          { onStatisticField: conditionExpressions.poor, outStatisticFieldName: 'poor_sum', statisticType: 'sum' },
          { onStatisticField: conditionExpressions.veryPoor, outStatisticFieldName: 'veryPoor_sum', statisticType: 'sum' }
        ] as any;

        const result = await layer.queryFeatures(statsQuery);
        const stats = result.features[0]?.attributes || {};
        
        const total = stats.total_count || 0;
        if (total === 0) return null;
        return {
          group: groupValue,
          avgValue: stats.avg_value || 0,
          minValue: stats.min_value || 0,
          maxValue: stats.max_value || 0,
          totalCount: total,
          conditions: {
            veryGood: { count: stats.veryGood_sum || 0, percentage: 0 },
            good: { count: stats.good_sum || 0, percentage: 0 },
            fair: { count: stats.fair_sum || 0, percentage: 0 },
            poor: { count: stats.poor_sum || 0, percentage: 0 },
            veryPoor: { count: stats.veryPoor_sum || 0, percentage: 0 }
          }
        };
      }));

      // Filter out null results and calculate percentages
      const validStats = groupedStats.filter((stat): stat is NonNullable<typeof stat> => stat !== null);
      
      return validStats.map(stat => {
        const total = stat.totalCount;
        const pct = (count: number) => (total > 0 ? (count / total) * 100 : 0);
        const fairOrBetterCount = stat.conditions.veryGood.count + stat.conditions.good.count + stat.conditions.fair.count;

        const summary: SummaryStatistics = {
          kpi: activeKpi.toUpperCase(),
          year: year,
          totalSegments: total,
          totalLengthKm: total * SEGMENT_LENGTH_KM,
          veryGoodCount: stat.conditions.veryGood.count,
          goodCount: stat.conditions.good.count,
          fairCount: stat.conditions.fair.count,
          poorCount: stat.conditions.poor.count,
          veryPoorCount: stat.conditions.veryPoor.count,
          veryGoodPct: pct(stat.conditions.veryGood.count),
          goodPct: pct(stat.conditions.good.count),
          fairPct: pct(stat.conditions.fair.count),
          poorPct: pct(stat.conditions.poor.count),
          veryPoorPct: pct(stat.conditions.veryPoor.count),
          fairOrBetterPct: pct(fairOrBetterCount),
          // ADDED
          avgValue: stat.avgValue,
          minValue: stat.minValue,
          maxValue: stat.maxValue,
          lastUpdated: new Date().toISOString()
        };

        return {
          group: stat.group,
          stats: summary,
        };
      });

    } catch (error) {
      console.error('Error computing grouped condition statistics:', error);
      throw new Error(`Failed to compute grouped condition statistics for ${groupByField}.`);
    }
  }

  /**
   * Returns empty statistics structure for error cases.
   * Used when calculation fails or no data is available.
   */
  private static getEmptyStats(
    activeKpi: KPIKey,
    year: number = CONFIG.defaultYear
  ): SummaryStatistics {
    return {
      kpi: activeKpi.toUpperCase(),
      year,
      totalSegments: 0,
      totalLengthKm: 0,
      veryGoodCount: 0,
      goodCount: 0,
      fairCount: 0,
      poorCount: 0,
      veryPoorCount: 0,
      veryGoodPct: 0,
      goodPct: 0,
      fairPct: 0,
      poorPct: 0,
      veryPoorPct: 0,
      fairOrBetterPct: 0,
      avgValue: 0,
      minValue: 0,
      maxValue: 0,
      lastUpdated: new Date().toISOString()
    };
  }

  /**
   * Compute statistics for chart-filtered selections
   * Combines multiple chart selections into a single statistics result
   */
  static async computeChartFilteredStatistics(
    layer: FeatureLayer | null,
    chartSelections: ChartSelection[],
    baseFilters: FilterState
  ): Promise<SummaryStatistics> {
    if (!layer || chartSelections.length === 0) {
      return this.getEmptyStats('iri', baseFilters.year); // Default empty stats
    }

    console.log('[Chart Stats] Computing for selections:', chartSelections);

    try {
      // Group selections by KPI and year for efficient querying
      const groupedSelections = new Map<string, ChartSelection[]>();
      chartSelections.forEach(selection => {
        const key = `${selection.kpi}_${selection.year}`;
        if (!groupedSelections.has(key)) {
          groupedSelections.set(key, []);
        }
        groupedSelections.get(key)!.push(selection);
      });

      // Process each KPI/year group and combine results
      const allResults: Array<{
        kpi: KPIKey;
        year: number;
        totalSegments: number;
        totalLengthKm: number;
        stats: any;
      }> = [];

      for (const [key, selections] of groupedSelections) {
        const [kpi, yearStr] = key.split('_');
        const year = parseInt(yearStr, 10);
        
        const result = await this.processChartSelectionGroup(
          layer, 
          selections, 
          kpi as KPIKey, 
          year, 
          baseFilters
        );
        
        if (result) {
          allResults.push(result);
        }
      }

      // Aggregate all results
      return this.aggregateChartResults(allResults, chartSelections);

    } catch (error) {
      console.error('Error computing chart-filtered statistics:', error);
      return this.getEmptyStats(chartSelections[0]?.kpi || 'iri', baseFilters.year);
    }
  }

  /**
   * Process a group of chart selections for the same KPI/year
   */
  private static async processChartSelectionGroup(
    layer: FeatureLayer,
    selections: ChartSelection[],
    kpi: KPIKey,
    year: number,
    baseFilters: FilterState
  ): Promise<any> {
    const kpiField = getKPIFieldName(kpi, year);
    
    // Build WHERE clauses for each selection
    const selectionClauses = selections.map(selection => {
      const groupClause = this.buildGroupWhereClause(selection.group);
      const conditionClause = StatisticsService.buildConditionWhereClause(kpiField, kpi, selection.condition);
      return `(${groupClause} AND ${conditionClause})`;
    });

    // Combine with OR (any of the selections)
    const combinedWhere = `(${selectionClauses.join(' OR ')}) AND ${kpiField} IS NOT NULL`;
    
    console.log('[Chart Stats] Query WHERE:', combinedWhere);
    
    // Execute the aggregated query
    const query = layer.createQuery();
    query.where = combinedWhere;
    query.outStatistics = [
      { onStatisticField: kpiField, outStatisticFieldName: 'avg_value', statisticType: 'avg' },
      { onStatisticField: kpiField, outStatisticFieldName: 'min_value', statisticType: 'min' },
      { onStatisticField: kpiField, outStatisticFieldName: 'max_value', statisticType: 'max' },
      { onStatisticField: kpiField, outStatisticFieldName: 'count_segments', statisticType: 'count' },
      { onStatisticField: this.getClassificationExpressions(kpi, kpiField).veryGood, outStatisticFieldName: 'very_good_count', statisticType: 'sum' },
      { onStatisticField: this.getClassificationExpressions(kpi, kpiField).good, outStatisticFieldName: 'good_count', statisticType: 'sum' },
      { onStatisticField: this.getClassificationExpressions(kpi, kpiField).fair, outStatisticFieldName: 'fair_count', statisticType: 'sum' },
      { onStatisticField: this.getClassificationExpressions(kpi, kpiField).poor, outStatisticFieldName: 'poor_count', statisticType: 'sum' },
      { onStatisticField: this.getClassificationExpressions(kpi, kpiField).veryPoor, outStatisticFieldName: 'very_poor_count', statisticType: 'sum' }
    ] as any;

    const queryResult = await layer.queryFeatures(query);
    const stats = queryResult.features[0]?.attributes;

    const results = stats ? {
      totalSegments: stats.count_segments, ...stats
    } : null;
    
    return {
      kpi,
      year,
      totalSegments: results?.totalSegments || 0,
      totalLengthKm: (results?.totalSegments || 0) * SEGMENT_LENGTH_KM,
      stats: results
    };
  }

  /**
   * Build WHERE clause for group filtering (handles subgroups)
   */
  private static buildGroupWhereClause(group: string): string {
    // Handle subgroup categories
    const subgroupOption = CONFIG.filters.subgroup.options?.find(opt => 
      opt.label === group
    );
    
    if (subgroupOption) {
      if (subgroupOption.value === 'Rural') {
        return '(Roads_Joined_IsFormerNa = 0 AND Roads_Joined_IsDublin = 0 AND Roads_Joined_IsCityTown = 0 AND Roads_Joined_IsPeat = 0)';
      } else {
        return `${subgroupOption.value} = 1`;
      }
    }
    
    // Handle Local Authority or Route
    if (group.includes('R') && group.length <= 5) {
      // Likely a route
      return `${CONFIG.fields.route} = '${group.replace("'", "''")}'`;
    } else {
      // Likely a Local Authority
      return `${CONFIG.fields.la} = '${group.replace("'", "''")}'`;
    }
  }

  /**
   * Build WHERE clause for a specific condition class (5-class system)
   */
  private static buildConditionWhereClause(
    kpiField: string,
    kpi: KPIKey,
    conditionClass: string
  ): string {
    const thresholds = KPI_THRESHOLDS[kpi];
    
    if (kpi === 'iri' || kpi === 'rut' || kpi === 'lpv3') {
      switch(conditionClass) {
        case 'veryGood': 
          return thresholds.veryGood ? `${kpiField} < ${thresholds.veryGood}` : `${kpiField} < ${thresholds.good}`;
        case 'good': 
          return thresholds.veryGood 
            ? `${kpiField} >= ${thresholds.veryGood} AND ${kpiField} < ${thresholds.good}`
            : `${kpiField} >= ${thresholds.good} AND ${kpiField} < ${thresholds.fair}`;
        case 'fair': 
          return `${kpiField} >= ${thresholds.good} AND ${kpiField} < ${thresholds.fair}`;
        case 'poor': 
          return thresholds.poor 
            ? `${kpiField} >= ${thresholds.fair} AND ${kpiField} < ${thresholds.poor}`
            : `${kpiField} >= ${thresholds.fair}`;
        case 'veryPoor': 
          return thresholds.poor ? `${kpiField} >= ${thresholds.poor}` : `${kpiField} >= ${thresholds.fair}`;
        default: 
          return '1=1';
      }
    } else if (kpi === 'csc') {
      // CSC is inverted (higher is better)
      switch(conditionClass) {
        case 'veryGood': 
          return `${kpiField} > ${thresholds.good}`;
        case 'good': 
          return `${kpiField} > ${thresholds.fair} AND ${kpiField} <= ${thresholds.good}`;
        case 'fair': 
          return `${kpiField} > ${thresholds.poor!} AND ${kpiField} <= ${thresholds.fair}`;
        case 'poor': 
          return `${kpiField} > ${thresholds.veryPoor!} AND ${kpiField} <= ${thresholds.poor!}`;
        case 'veryPoor': 
          return `${kpiField} <= ${thresholds.veryPoor!}`;
        default: 
          return '1=1';
      }
    } else if (kpi === 'psci') {
      switch(conditionClass) {
        case 'veryGood': return `${kpiField} > 8`;
        case 'good': return `${kpiField} > 6 AND ${kpiField} <= 8`;
        case 'fair': return `${kpiField} > 4 AND ${kpiField} <= 6`;
        case 'poor': return `${kpiField} > 2 AND ${kpiField} <= 4`;
        case 'veryPoor': return `${kpiField} <= 2`;
        default: return '1=1';
      }
    } else if (kpi === 'mpd') {
      switch(conditionClass) {
        case 'veryGood': 
        case 'good': 
          return `${kpiField} >= ${thresholds.good}`;
        case 'fair': 
          return `${kpiField} >= ${thresholds.poor!} AND ${kpiField} < ${thresholds.good}`;
        case 'poor': 
        case 'veryPoor': 
          return `${kpiField} < ${thresholds.poor!}`;
        default: 
          return '1=1';
      }
    }
    
    return '1=1';
  }

  /**
   * Aggregate results from multiple KPI/year groups
   */
  private static aggregateChartResults(
    results: Array<any>,
    chartSelections: ChartSelection[]
  ): SummaryStatistics {
    if (results.length === 0) {
      return this.getEmptyStats(chartSelections[0]?.kpi || 'iri', chartSelections[0]?.year);
    }

    // For simplicity, use the most common KPI from selections
    const kpiCounts = new Map<KPIKey, number>();
    chartSelections.forEach(sel => {
      kpiCounts.set(sel.kpi, (kpiCounts.get(sel.kpi) || 0) + 1);
    });
    
    const primaryKpi = Array.from(kpiCounts.entries())
      .sort((a, b) => b[1] - a[1])[0][0];

    // Sum up totals across all results
    const totalSegments = results.reduce((sum, r) => sum + r.totalSegments, 0);
    const totalLengthKm = results.reduce((sum, r) => sum + r.totalLengthKm, 0);

    // Find primary KPI stats for detailed breakdown
    const primaryResult = results.find(r => r.kpi === primaryKpi);
    const stats = primaryResult?.stats || this.getEmptyQueryResult();

    // Calculate percentages
    const total = (stats.very_good_count || 0) + (stats.good_count || 0) + (stats.fair_count || 0) + 
                  (stats.poor_count || 0) + (stats.very_poor_count || 0);
    
    const pct = (n: number) => (total > 0 ? (n / total) * 100 : 0);
    const fairOrBetterCount = (stats.very_good_count || 0) + (stats.good_count || 0) + (stats.fair_count || 0);

    return {
      kpi: primaryKpi.toUpperCase(),
      // Note: Year is ambiguous with multiple selections, using primary result's year
      year: primaryResult?.year || CONFIG.defaultYear,
      totalSegments,
      totalLengthKm: Math.round(totalLengthKm * 10) / 10,
      veryGoodCount: stats.very_good_count || 0,
      goodCount: stats.good_count || 0,
      fairCount: stats.fair_count || 0,
      poorCount: stats.poor_count || 0,
      veryPoorCount: stats.very_poor_count || 0,
      veryGoodPct: pct(stats.very_good_count || 0),
      goodPct: pct(stats.good_count || 0),
      fairPct: pct(stats.fair_count || 0),
      poorPct: pct(stats.poor_count || 0),
      veryPoorPct: pct(stats.very_poor_count || 0),
      fairOrBetterPct: pct(fairOrBetterCount),
      // ADDED
      avgValue: stats.avg_value || 0,
      minValue: stats.min_value || 0,
      maxValue: stats.max_value || 0,
      lastUpdated: new Date().toISOString()
    };
  }

  /**
   * Get empty query result structure
   */
  private static getEmptyQueryResult(): any {
    return {
      avg_value: 0,
      min_value: 0,
      max_value: 0,
      count_segments: 0,
      very_good_count: 0,
      good_count: 0,
      fair_count: 0,
      poor_count: 0,
      very_poor_count: 0
    };
  }
}