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
   */
  private static async calculateStatsWithClassFields(
    layer: __esri.FeatureLayer,
    kpi: KPIKey,
    year: number,
    filters: FilterState
  ): Promise<SummaryStatistics> {
    const classFieldName = getKPIFieldName(kpi, year, true);  // Get class field name
    const where = QueryService.buildDefinitionExpression(filters);

    // Build statistics definition for class field counts
    const statDefinitions = [];

    // Handle KPI-specific class counts
    if (kpi === 'psci') {
      // PSCI: 4 classes (1-4)
      statDefinitions.push(
        { onStatisticField: classFieldName, outStatisticFieldName: 'class1_count', statisticType: 'count' as const },
        { onStatisticField: classFieldName, outStatisticFieldName: 'class2_count', statisticType: 'count' as const },
        { onStatisticField: classFieldName, outStatisticFieldName: 'class3_count', statisticType: 'count' as const },
        { onStatisticField: classFieldName, outStatisticFieldName: 'class4_count', statisticType: 'count' as const }
      );
    } else if (kpi === 'mpd') {
      // MPD: 3 classes (1-3)
      statDefinitions.push(
        { onStatisticField: classFieldName, outStatisticFieldName: 'class1_count', statisticType: 'count' as const },
        { onStatisticField: classFieldName, outStatisticFieldName: 'class2_count', statisticType: 'count' as const },
        { onStatisticField: classFieldName, outStatisticFieldName: 'class3_count', statisticType: 'count' as const }
      );
    } else {
      // Standard 5 classes (1-5)
      statDefinitions.push(
        { onStatisticField: classFieldName, outStatisticFieldName: 'class1_count', statisticType: 'count' as const },
        { onStatisticField: classFieldName, outStatisticFieldName: 'class2_count', statisticType: 'count' as const },
        { onStatisticField: classFieldName, outStatisticFieldName: 'class3_count', statisticType: 'count' as const },
        { onStatisticField: classFieldName, outStatisticFieldName: 'class4_count', statisticType: 'count' as const },
        { onStatisticField: classFieldName, outStatisticFieldName: 'class5_count', statisticType: 'count' as const }
      );
    }

    // Create query with grouping by class value
    const query = layer.createQuery();
    query.where = `${where} AND ${classFieldName} IS NOT NULL`;
    query.outStatistics = statDefinitions;
    query.groupByFieldsForStatistics = [classFieldName];

    const result = await layer.queryFeatures(query);

    // Parse results into counts by class
    let veryGoodCount = 0;
    let goodCount = 0;
    let fairCount = 0;
    let poorCount = 0;
    let veryPoorCount = 0;

    result.features.forEach(feature => {
      const classValue = feature.attributes[classFieldName];
      const count = feature.attributes['class1_count'] || 
                    feature.attributes['class2_count'] || 
                    feature.attributes['class3_count'] || 
                    feature.attributes['class4_count'] || 
                    feature.attributes['class5_count'] || 0;

      if (kpi === 'psci') {
        // PSCI: 4 classes
        if (classValue === 1) veryGoodCount = count;
        else if (classValue === 2) goodCount = count;
        else if (classValue === 3) fairCount = count;
        else if (classValue === 4) poorCount = count;
      } else if (kpi === 'mpd') {
        // MPD: 3 classes (map to 5-class structure)
        if (classValue === 1) veryGoodCount = count;      // Good → Very Good
        else if (classValue === 2) fairCount = count;     // Fair → Fair
        else if (classValue === 3) veryPoorCount = count; // Poor → Very Poor
      } else {
        // Standard 5 classes
        if (classValue === 1) veryGoodCount = count;
        else if (classValue === 2) goodCount = count;
        else if (classValue === 3) fairCount = count;
        else if (classValue === 4) poorCount = count;
        else if (classValue === 5) veryPoorCount = count;
      }
    });

    // Calculate totals and percentages
    const totalSegments = veryGoodCount + goodCount + fairCount + poorCount + veryPoorCount;
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
    };
  }

  /**
   * FALLBACK: Calculate statistics using raw values with threshold calculations
   * Used when class fields are not available
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
      }
    ];

    const query = layer.createQuery();
    query.where = `${where} AND ${kpiField} IS NOT NULL`;
    query.outStatistics = statDefinitions;
    
    const result = await layer.queryFeatures(query);

    if (result.features.length === 0) {
      return this.getEmptyStats(kpi);
    }

    const attrs = result.features[0].attributes;
    const totalSegments = attrs.total_count || 0;
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
    layer: __esri.FeatureLayer,
    filters: FilterState,
    kpi: KPIKey
  ): Promise<SummaryStatistics> {
    const year = filters.year.length > 0 ? filters.year[0] : CONFIG.defaultYears[0];
    
    // Check if the layer has the pre-calculated class field for the given KPI and year
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
   * Compute grouped statistics with condition class breakdowns
   * Returns data suitable for stacked bar charts
   * FIXED: Now properly handles subgroup grouping
   */
  static async computeGroupedStatisticsWithConditions(
    layer: FeatureLayer | null,
    filters: FilterState,
    activeKpi: KPIKey,
    groupByField: string
  ): Promise<GroupedConditionStats[]> {
    if (!layer) {
      return this.getPlaceholderGroupedConditionStats(groupByField);
    }

    try {
      const year = filters.year.length > 0 ? filters.year[0] : CONFIG.defaultYears[0];
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
        };

        return {
          group: stat.group,
          stats: summary,
        };
      });

    } catch (error) {
      console.error('Error computing grouped condition statistics:', error);
      return this.getPlaceholderGroupedConditionStats(groupByField);
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
      kpi: activeKpi.toUpperCase(),
      year: CONFIG.defaultYears[0],
      totalSegments: 200,
      totalLengthKm: 20, // 200 * 0.1km = 20 km
      veryGoodCount: 60,
      goodCount: 60,
      fairCount: 40,
      poorCount: 30,
      veryPoorCount: 10,
      veryGoodPct: 30,
      goodPct: 30,
      fairPct: 20,
      poorPct: 15,
      veryPoorPct: 5,
      fairOrBetterPct: 80,
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

  private static getPlaceholderGroupedConditionStats(groupByField: string): GroupedConditionStats[] {
    const groups = groupByField.includes('LA')
      ? ['Dublin City', 'Cork County', 'Galway County', 'Limerick City']
      : ['R123', 'R456', 'R750', 'R999'];

    return groups.map(g => {
      const stats = this.getPlaceholderStats('iri');
      return { group: g, stats };
    });
  }

  /**
   * Empty stats in case of errors
   */
  private static getEmptyStats(activeKpi: KPIKey): SummaryStatistics {
    return {
      kpi: activeKpi.toUpperCase(),
      year: CONFIG.defaultYears[0],
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
      return this.getEmptyStats('iri'); // Default empty stats
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
      return this.getEmptyStats(chartSelections[0]?.kpi || 'iri');
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
      return this.getEmptyStats(chartSelections[0]?.kpi || 'iri');
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
    const total = stats.veryGoodCount + stats.goodCount + stats.fairCount + 
                  stats.poorCount + stats.veryPoorCount;
    
    const pct = (n: number) => (total > 0 ? (n / total) * 100 : 0);
    const fairOrBetterCount = (stats.veryGoodCount || 0) + (stats.goodCount || 0) + (stats.fairCount || 0);

    return {
      kpi: primaryKpi.toUpperCase(),
      // Note: Year is ambiguous with multiple selections, using primary result's year
      year: primaryResult?.year || CONFIG.defaultYears[0],
      totalSegments,
      totalLengthKm: Math.round(totalLengthKm * 10) / 10,
      veryGoodCount: stats.veryGoodCount || 0,
      goodCount: stats.goodCount || 0,
      fairCount: stats.fairCount || 0,
      poorCount: stats.poorCount || 0,
      veryPoorCount: stats.veryPoorCount || 0,
      veryGoodPct: pct(stats.veryGoodCount || 0),
      goodPct: pct(stats.goodCount || 0),
      fairPct: pct(stats.fairCount || 0),
      poorPct: pct(stats.poorCount || 0),
      veryPoorPct: pct(stats.veryPoorCount || 0),
      fairOrBetterPct: pct(fairOrBetterCount),
    };
  }

  /**
   * Get empty query result structure
   */
  private static getEmptyQueryResult(): any {
    return {
      avgValue: 0,
      minValue: 0,
      maxValue: 0,
      totalSegments: 0,
      veryGoodCount: 0,
      goodCount: 0,
      fairCount: 0,
      poorCount: 0,
      veryPoorCount: 0
    };
  }
}