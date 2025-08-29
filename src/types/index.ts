export interface FilterState {
  localAuthority: string[];
  subgroup: number[];
  route: string[];
  year: number[];
}

export interface KPIStats {
  metric: string;
  average: number;
  min: number;
  max: number;
  goodCount: number;
  fairCount: number;
  poorCount: number;
  goodPct: number;
  fairPct: number;
  poorPct: number;
}

export interface SummaryStatistics {
  totalSegments: number;
  totalLengthKm: number;
  metrics: KPIStats[];
  lastUpdated: Date;
}
