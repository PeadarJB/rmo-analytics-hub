import type FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import Query from '@arcgis/core/rest/support/Query';
import { CONFIG, type KPIKey } from '@/config/appConfig';
import RendererService from '@/services/RendererService';
import type { FilterState, SummaryStatistics, KPIStats } from '@/types';

export default class StatisticsService {
  /**
   * Compute summary statistics for the selected filters and KPI
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

    try {
      // Use the first selected year or default
      const year = filters.year.length > 0 ? filters.year[0] : CONFIG.defaultYears[0];
      const kpiField = `roads_csv_${activeKpi}_${year}`;
      const lengthField = CONFIG.fields.lengthKm;
      
      // Build where clause based on current definition expression
      const whereClause = (layer as any).definitionExpression || '1=1';
      
      // Create query for statistics
      const statsQuery = layer.createQuery();
      statsQuery.where = whereClause;
      statsQuery.returnGeometry = false;
      
      // Define the statistics to calculate
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
      
      // Execute the statistics query
      const statsResult = await layer.queryFeatures(statsQuery);
      
      if (!statsResult.features.length) {
        return this.getEmptyStats(activeKpi);
      }
      
      const stats = statsResult.features[0].attributes;
      
      // Query for condition class counts
      const conditionCounts = await this.getConditionCounts(
        layer, 
        whereClause, 
        kpiField, 
        activeKpi
      );
      
      // Convert length from meters to kilometers
      const totalLengthKm = (stats.total_length || 0) / 1000;
      
      // Calculate percentages
      const total = conditionCounts.good + conditionCounts.fair + conditionCounts.poor;
      const goodPct = total > 0 ? (conditionCounts.good / total) * 100 : 0;
      const fairPct = total > 0 ? (conditionCounts.fair / total) * 100 : 0;
      const poorPct = total > 0 ? (conditionCounts.poor / total) * 100 : 0;
      
      const kpiStats: KPIStats = {
        metric: activeKpi.toUpperCase(),
        average: stats.avg_value || 0,
        min: stats.min_value || 0,
        max: stats.max_value || 0,
        goodCount: conditionCounts.good,
        fairCount: conditionCounts.fair,
        poorCount: conditionCounts.poor,
        goodPct: Math.round(goodPct * 10) / 10,
        fairPct: Math.round(fairPct * 10) / 10,
        poorPct: Math.round(poorPct * 10) / 10
      };
      
      return {
        totalSegments: stats.count_segments || 0,
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
   * Get counts of segments in each condition class
   */
  private static async getConditionCounts(
    layer: FeatureLayer,
    baseWhere: string,
    kpiField: string,
    activeKpi: KPIKey
  ): Promise<{ good: number; fair: number; poor: number }> {
    // Get the thresholds for this KPI
    const thresholds = this.getKPIThresholds(activeKpi);
    
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
   * Build WHERE clause for a specific condition class
   */
  private static buildConditionWhere(
    baseWhere: string,
    kpiField: string,
    kpi: KPIKey,
    conditionClass: 'good' | 'fair' | 'poor',
    thresholds: any
  ): string {
    let conditionClause = '';
    
    // Add NOT NULL check
    const notNullClause = `${kpiField} IS NOT NULL`;
    
    if (kpi === 'iri' || kpi === 'rut' || kpi === 'lpv3') {
      // Lower values are better
      if (conditionClass === 'good') {
        conditionClause = `${kpiField} < ${thresholds.good}`;
      } else if (conditionClass === 'fair') {
        conditionClause = `${kpiField} >= ${thresholds.good} AND ${kpiField} < ${thresholds.fair}`;
      } else {
        conditionClause = `${kpiField} >= ${thresholds.fair}`;
      }
    } else if (kpi === 'csc') {
      // Higher values are better
      if (conditionClass === 'good') {
        conditionClause = `${kpiField} >= ${thresholds.fair}`;
      } else if (conditionClass === 'fair') {
        conditionClause = `${kpiField} >= ${thresholds.veryPoor} AND ${kpiField} < ${thresholds.fair}`;
      } else {
        conditionClause = `${kpiField} < ${thresholds.veryPoor}`;
      }
    } else if (kpi === 'psci') {
      // 1-10 scale, higher is better
      if (conditionClass === 'good') {
        conditionClause = `${kpiField} > 6`;
      } else if (conditionClass === 'fair') {
        conditionClause = `${kpiField} > 4 AND ${kpiField} <= 6`;
      } else {
        conditionClause = `${kpiField} <= 4`;
      }
    } else if (kpi === 'mpd') {
      // MPD thresholds
      if (conditionClass === 'good') {
        conditionClause = `${kpiField} >= ${thresholds.good}`;
      } else if (conditionClass === 'fair') {
        conditionClause = `${kpiField} >= ${thresholds.poor} AND ${kpiField} < ${thresholds.good}`;
      } else {
        conditionClause = `${kpiField} < ${thresholds.poor}`;
      }
    }
    
    // Combine base WHERE with condition clause
    if (baseWhere && baseWhere !== '1=1') {
      return `(${baseWhere}) AND ${notNullClause} AND ${conditionClause}`;
    }
    return `${notNullClause} AND ${conditionClause}`;
  }
  
  /**
   * Get KPI thresholds
   */
  private static getKPIThresholds(kpi: KPIKey): any {
    const thresholds: Record<KPIKey, any> = {
      iri: { good: 4, fair: 5 },
      rut: { good: 9, fair: 15 },
      csc: { veryPoor: 0.35, fair: 0.45 },
      lpv3: { good: 4, fair: 7 },
      psci: { poor: 4, fair: 6 },
      mpd: { poor: 0.6, good: 0.7 }
    };
    return thresholds[kpi];
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