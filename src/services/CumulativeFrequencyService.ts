/**
 * CumulativeFrequencyService.ts
 *
 * Service for computing cumulative frequency distributions using server-side statistics.
 * Dramatically improves performance by using ArcGIS percentile calculations instead of
 * downloading and processing all features client-side.
 */

import type FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import { KPIKey } from '@/config/kpiConfig';
import { getKPIFieldName } from '@/config/layerConfig';
import PaginationService from './PaginationService';

interface CumulativeDataPoint {
  value: number;
  cumulativePercent: number;
}

export interface CumulativeData {
  dataPoints: CumulativeDataPoint[];
  stats: {
    average: number;
    median: number;
    percentile90: number;
    count: number;
    min: number;
    max: number;
  };
}

interface KPIConfig {
  ranges: { min: number; max: number; step: number };
  unit: string;
}

/**
 * Cache for cumulative frequency data
 * Key format: ${kpi}-${year}
 */
const cumulativeCache = new Map<string, CumulativeData>();

export class CumulativeFrequencyService {
  /**
   * Clear the cache (useful when filters change)
   */
  static clearCache(): void {
    cumulativeCache.clear();
    console.log('[CumulativeFrequencyService] Cache cleared');
  }

  /**
   * Clear cache for a specific KPI and year
   */
  static clearCacheForKPI(kpi: KPIKey, year: number): void {
    const cacheKey = `${kpi}-${year}`;
    cumulativeCache.delete(cacheKey);
    console.log(`[CumulativeFrequencyService] Cache cleared for ${cacheKey}`);
  }

  /**
   * Check if server supports percentile statistics
   * ArcGIS Server 10.6.1+ supports percentile_cont
   */
  private static async supportsPercentiles(layer: FeatureLayer): Promise<boolean> {
    try {
      // Try to query with a percentile statistic
      const testField = layer.fields.find(f => f.type === 'double' || f.type === 'integer');
      if (!testField) return false;

      const query = layer.createQuery();
      query.where = '1=1';
      query.outStatistics = [{
        onStatisticField: testField.name,
        outStatisticFieldName: 'test_p50',
        statisticType: 'percentile_cont',
        statisticParameters: { value: 0.5 }
      } as any];
      query.num = 1;

      await layer.queryFeatures(query);
      return true;
    } catch (error) {
      console.log('[CumulativeFrequencyService] Server does not support percentile statistics');
      return false;
    }
  }

  /**
   * Compute cumulative distribution using server-side percentiles
   * This is MUCH faster than downloading all features
   */
  private static async computeWithServerSidePercentiles(
    layer: FeatureLayer,
    kpi: KPIKey,
    year: number,
    config: KPIConfig
  ): Promise<CumulativeData> {
    const fieldName = getKPIFieldName(kpi, year, false);

    console.log(`[CumulativeFrequencyService] Using server-side percentiles for ${kpi} ${year}`);

    // Define percentiles to query (0-100 in steps of 1)
    const percentiles = Array.from({ length: 101 }, (_, i) => i);

    // Build statistics definitions for all percentiles
    const statDefinitions = [
      // Basic stats
      { onStatisticField: fieldName, outStatisticFieldName: 'count', statisticType: 'count' as const },
      { onStatisticField: fieldName, outStatisticFieldName: 'avg', statisticType: 'avg' as const },
      { onStatisticField: fieldName, outStatisticFieldName: 'min', statisticType: 'min' as const },
      { onStatisticField: fieldName, outStatisticFieldName: 'max', statisticType: 'max' as const },
      // Percentiles
      ...percentiles.map(p => ({
        onStatisticField: fieldName,
        outStatisticFieldName: `p${p}`,
        statisticType: 'percentile_cont' as const,
        statisticParameters: { value: p / 100 }
      }))
    ];

    const query = layer.createQuery();
    query.where = `${fieldName} IS NOT NULL`;
    query.outStatistics = statDefinitions as any;

    const result = await layer.queryFeatures(query);

    if (result.features.length === 0 || !result.features[0].attributes) {
      return this.getEmptyData();
    }

    const attrs = result.features[0].attributes;

    // Build data points from percentiles
    const dataPoints: CumulativeDataPoint[] = [];

    // Create data points at regular intervals based on config
    for (let value = config.ranges.min; value <= config.ranges.max; value += config.ranges.step) {
      // Find which percentile this value corresponds to
      let cumulativePercent = 0;

      for (let p = 0; p <= 100; p++) {
        const percentileValue = attrs[`p${p}`];
        if (percentileValue !== null && percentileValue !== undefined) {
          if (percentileValue <= value) {
            cumulativePercent = p;
          } else {
            break;
          }
        }
      }

      dataPoints.push({
        value: Math.round(value * 100) / 100,
        cumulativePercent
      });
    }

    return {
      dataPoints,
      stats: {
        average: attrs.avg || 0,
        median: attrs.p50 || 0,
        percentile90: attrs.p90 || 0,
        count: attrs.count || 0,
        min: attrs.min || 0,
        max: attrs.max || 0
      }
    };
  }

  /**
   * FALLBACK: Compute cumulative distribution using client-side processing
   * Downloads all features and processes locally
   */
  private static async computeWithClientSide(
    layer: FeatureLayer,
    kpi: KPIKey,
    year: number,
    config: KPIConfig,
    onProgress?: (current: number, total: number) => void
  ): Promise<CumulativeData> {
    const fieldName = getKPIFieldName(kpi, year, false);

    console.log(`[CumulativeFrequencyService] Using client-side processing for ${kpi} ${year}`);

    // Query all features with progress tracking
    const result = await PaginationService.queryAllFeatures(layer, {
      where: `${fieldName} IS NOT NULL`,
      outFields: [fieldName],
      returnGeometry: false,
      orderByFields: ['OBJECTID ASC'],
      onProgress: onProgress ? (current, total) => onProgress(current, total || 0) : undefined
    });

    // Extract and filter values
    const values = result.features
      .map(f => f.attributes[fieldName] as number)
      .filter(v => v !== null && v !== undefined && !isNaN(v));

    if (values.length === 0) {
      return this.getEmptyData();
    }

    // Sort values for percentile calculations
    const sortedValues = [...values].sort((a, b) => a - b);
    const totalCount = sortedValues.length;

    // Calculate data points
    const dataPoints: CumulativeDataPoint[] = [];
    for (let value = config.ranges.min; value <= config.ranges.max; value += config.ranges.step) {
      const count = sortedValues.filter(v => v <= value).length;
      const cumulativePercent = (count / totalCount) * 100;

      dataPoints.push({
        value: Math.round(value * 100) / 100,
        cumulativePercent: Math.round(cumulativePercent * 100) / 100
      });
    }

    // Calculate statistics
    const sum = values.reduce((acc, val) => acc + val, 0);
    const average = sum / values.length;
    const median = sortedValues[Math.floor(sortedValues.length * 0.5)];
    const percentile90 = sortedValues[Math.floor(sortedValues.length * 0.9)];

    return {
      dataPoints,
      stats: {
        average: Math.round(average * 100) / 100,
        median: Math.round(median * 100) / 100,
        percentile90: Math.round(percentile90 * 100) / 100,
        count: values.length,
        min: sortedValues[0],
        max: sortedValues[sortedValues.length - 1]
      }
    };
  }

  /**
   * Fetch cumulative data for a single KPI
   * Uses cache if available, otherwise queries with server-side or client-side processing
   */
  static async fetchCumulativeDataForKPI(
    layer: FeatureLayer,
    kpi: KPIKey,
    year: number,
    config: KPIConfig,
    onProgress?: (current: number, total: number) => void
  ): Promise<CumulativeData> {
    // Check cache first
    const cacheKey = `${kpi}-${year}`;
    if (cumulativeCache.has(cacheKey)) {
      console.log(`[CumulativeFrequencyService] Cache hit for ${cacheKey}`);
      return cumulativeCache.get(cacheKey)!;
    }

    console.log(`[CumulativeFrequencyService] Cache miss for ${cacheKey}, querying...`);

    try {
      // Try server-side percentiles first (much faster)
      const supportsPercentiles = await this.supportsPercentiles(layer);

      let data: CumulativeData;
      if (supportsPercentiles) {
        data = await this.computeWithServerSidePercentiles(layer, kpi, year, config);
      } else {
        data = await this.computeWithClientSide(layer, kpi, year, config, onProgress);
      }

      // Cache the result
      cumulativeCache.set(cacheKey, data);
      return data;

    } catch (error) {
      console.error(`[CumulativeFrequencyService] Error fetching data for ${kpi}:`, error);
      // Fallback to client-side if server-side fails
      try {
        const data = await this.computeWithClientSide(layer, kpi, year, config, onProgress);
        cumulativeCache.set(cacheKey, data);
        return data;
      } catch (fallbackError) {
        console.error(`[CumulativeFrequencyService] Fallback also failed:`, fallbackError);
        return this.getEmptyData();
      }
    }
  }

  /**
   * Fetch cumulative data for multiple KPIs in parallel
   * This is the main optimization: queries all KPIs at once instead of sequentially
   */
  static async fetchCumulativeDataForAllKPIs(
    layer: FeatureLayer,
    kpis: KPIKey[],
    year: number,
    configs: Record<KPIKey, KPIConfig>,
    onKPIComplete?: (kpi: KPIKey, index: number, total: number) => void
  ): Promise<Record<KPIKey, CumulativeData>> {
    console.log(`[CumulativeFrequencyService] Fetching data for ${kpis.length} KPIs in parallel...`);

    const startTime = performance.now();

    // Query all KPIs in parallel
    const promises = kpis.map(async (kpi, index) => {
      try {
        const data = await this.fetchCumulativeDataForKPI(
          layer,
          kpi,
          year,
          configs[kpi],
          (current, total) => {
            // Progress callback for this specific KPI
            console.log(`[${kpi}] ${current}/${total}`);
          }
        );

        // Notify completion of this KPI
        if (onKPIComplete) {
          onKPIComplete(kpi, index + 1, kpis.length);
        }

        return { kpi, data };
      } catch (error) {
        console.error(`[CumulativeFrequencyService] Failed to fetch ${kpi}:`, error);
        return { kpi, data: this.getEmptyData() };
      }
    });

    // Wait for all queries to complete
    const results = await Promise.all(promises);

    const endTime = performance.now();
    console.log(`[CumulativeFrequencyService] All KPIs fetched in ${Math.round(endTime - startTime)}ms`);

    // Convert array to record
    const dataRecord: Record<string, CumulativeData> = {};
    results.forEach(({ kpi, data }) => {
      dataRecord[kpi] = data;
    });

    return dataRecord as Record<KPIKey, CumulativeData>;
  }

  /**
   * Get empty data structure
   */
  private static getEmptyData(): CumulativeData {
    return {
      dataPoints: [],
      stats: {
        average: 0,
        median: 0,
        percentile90: 0,
        count: 0,
        min: 0,
        max: 0
      }
    };
  }
}

export default CumulativeFrequencyService;
