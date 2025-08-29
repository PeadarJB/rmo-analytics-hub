import type FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import { CONFIG, type KPIKey } from '@/config/appConfig';
import type { FilterState, SummaryStatistics, KPIStats } from '@/types';

export default class StatisticsService {
  static async computeSummary(layer: FeatureLayer | null, filters: FilterState, activeKpi: KPIKey): Promise<SummaryStatistics> {
    // Placeholder when no ArcGIS layer is available
    if (!layer) {
      const metrics: KPIStats[] = Object.keys(CONFIG.fields)
        .filter(k => ['iri','rut','psci','csc','mpd','lpv3'].includes(k))
        .map((k) => ({
          metric: k.toUpperCase(),
          average: Math.random() * 10,
          min: Math.random() * 2,
          max: 8 + Math.random() * 2,
          goodCount: 120,
          fairCount: 60,
          poorCount: 20,
          goodPct: 60,
          fairPct: 30,
          poorPct: 10
        })) as any;
      return {
        totalSegments: 200,
        totalLengthKm: 150.5,
        metrics,
        lastUpdated: new Date()
      };
    }

    // Minimal implementation: just return stub with zeros to keep app functional without full schema.
    // Developers can replace with real outStatistics queries per KPI.
    return {
      totalSegments: 0,
      totalLengthKm: 0,
      metrics: [{
        metric: activeKpi.toUpperCase(),
        average: 0, min: 0, max: 0,
        goodCount: 0, fairCount: 0, poorCount: 0,
        goodPct: 0, fairPct: 0, poorPct: 0
      }],
      lastUpdated: new Date()
    };
  }
}
