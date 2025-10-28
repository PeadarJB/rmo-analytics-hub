import type { KPIKey } from "@/config/appConfig";

export interface FilterState {
  localAuthority: string[];
  subgroup: number[];
  route: string[];
  year: number;
}

export interface SummaryStatistics {
  kpi: string;
  year: number;
  totalSegments: number;
  totalLengthKm: number;
  veryGoodCount: number;
  goodCount: number;
  fairCount: number;
  poorCount: number;
  veryPoorCount: number;
  veryGoodPct: number;
  goodPct: number;
  fairPct: number;
  poorPct: number;
  veryPoorPct: number;
  fairOrBetterPct: number;
}

export interface GroupedConditionStats {
  group: string;
  stats: SummaryStatistics;
}

export interface ChartSelection {
  kpi: KPIKey;
  year: number;
  group: string;
  condition: string;
}

// NOTE: The following types are no longer used after refactoring
// but are kept here for reference or potential future use.
//
// export interface KPIStats { ... }
// export interface ExtendedStatistics { ... }
// export interface ConditionBreakdown { ... }
