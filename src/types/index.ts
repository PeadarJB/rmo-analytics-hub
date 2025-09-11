export interface FilterState {
  localAuthority: string[];
  subgroup: string[];
  route: string[];
  year: number[];
}

export interface KPIStats {
  metric: string;
  average: number;
  min: number;
  max: number;

  // 5-class counts
  veryGoodCount: number;
  goodCount: number;
  fairCount: number;
  poorCount: number;
  veryPoorCount: number;

  // 5-class percentages
  veryGoodPct: number;
  goodPct: number;
  fairPct: number;
  poorPct: number;
  veryPoorPct: number;
}

export interface SummaryStatistics {
  totalSegments: number;
  totalLengthKm: number;
  metrics: KPIStats[];
  lastUpdated: Date;
}
