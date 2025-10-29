// src/config/kpiConfig.ts

import { RENDERER_CONFIG } from '../config/rendererConfig';

export type KPIKey = 'iri' | 'rut' | 'psci' | 'csc' | 'mpd' | 'lpv3';

export const KPI_LABELS: Record<KPIKey, string> = {
  iri: 'IRI',
  rut: 'Rut Depth',
  psci: 'PSCI',
  csc: 'CSC',
  mpd: 'MPD',
  lpv3: 'LPV'
};

// Consolidated KPI thresholds from RendererService and StatisticsService
// Based on the 2018 Regional Report condition class definitions
export const KPI_THRESHOLDS: Record<KPIKey, {
  veryGood?: number;
  good: number;
  fair: number;
  poor?: number;
  veryPoor?: number;
}> = {
  // International Roughness Index (mm/m) - lower values are better
  iri: {
    veryGood: 3,
    good: 4,
    fair: 5,
    poor: 7
  },
  // Rut Depth (mm) - lower values are better
  rut: {
    veryGood: 6,
    good: 9,
    fair: 15,
    poor: 20
  },
  // Characteristic SCRIM Coefficient - higher values are better (inverted)
  csc: {
    veryPoor: 0.35,
    poor: 0.40,
    fair: 0.45,
    good: 0.50
  },
  // Longitudinal Profile Variance (3m) - lower values are better
  lpv3: {
    veryGood: 2,
    good: 4,
    fair: 7,
    poor: 10
  },
  // Pavement Surface Condition Index (1-10 scale) - higher is better
  psci: {
    veryPoor: 2,
    poor: 4,
    fair: 6,
    good: 8
  },
  // Mean Profile Depth (mm) - specific thresholds for skid resistance
  mpd: {
    poor: 0.6,
    good: 0.7,
    fair: 0.65
  }
};

// Helper function to determine condition class based on KPI value and thresholds
export function getConditionClass(
  kpi: KPIKey,
  value: number,
  use5Classes: boolean = RENDERER_CONFIG.use5ClassRenderers
): 'veryGood' | 'good' | 'fair' | 'poor' | 'veryPoor' | null {
  if (value === null || value === undefined || isNaN(value)) return null;
  const thresholds = KPI_THRESHOLDS[kpi];

  if (kpi === 'iri' || kpi === 'rut' || kpi === 'lpv3') {
    if (use5Classes && thresholds.veryGood !== undefined && value < thresholds.veryGood) return 'veryGood';
    if (value < thresholds.good) return 'good';
    if (value < thresholds.fair) return 'fair';
    if (use5Classes && thresholds.poor !== undefined) {
      if (value < thresholds.poor) return 'poor';
      return 'veryPoor';
    }
    return 'poor';
  } else if (kpi === 'csc') {
    if (use5Classes && thresholds.good !== undefined && value > thresholds.good) return 'veryGood';
    if (value >= thresholds.fair) return 'good';
    if (value >= thresholds.poor! && thresholds.poor !== undefined) return 'fair';
    if (use5Classes && thresholds.veryPoor !== undefined) {
      if (value >= thresholds.veryPoor) return 'poor';
      return 'veryPoor';
    }
    return 'poor';
  } else if (kpi === 'psci') {
    if (use5Classes) {
      if (value > 8) return 'veryGood';
      if (value > thresholds.good) return 'good';
      if (value > thresholds.fair) return 'fair';
      if (value > thresholds.poor!) return 'poor';
      return 'veryPoor';
    }
    if (value > thresholds.fair) return 'good';
    if (value > thresholds.poor!) return 'fair';
    return 'poor';
  } else if (kpi === 'mpd') {
    if (value >= thresholds.good) return 'good';
    if (value >= thresholds.fair) return 'fair';
    return 'poor';
  }
  return null;
}

export function getSimplifiedConditionClass(
  kpi: KPIKey,
  value: number
): 'good' | 'fair' | 'poor' | null {
  const detailed = getConditionClass(kpi, value, true);
  if (!detailed) return null;
  if (detailed === 'veryGood' || detailed === 'good') return 'good';
  if (detailed === 'fair') return 'fair';
  return 'poor';
}