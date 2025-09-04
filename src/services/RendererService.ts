import ClassBreaksRenderer from '@arcgis/core/renderers/ClassBreaksRenderer';
import SimpleLineSymbol from '@arcgis/core/symbols/SimpleLineSymbol';
import type { KPIKey } from '@/config/appConfig';

// Color scheme for condition classes
const COLORS = {
  veryGood: [0, 128, 0, 0.8],    // Dark green
  good: [144, 238, 144, 0.8],    // Light green
  fair: [255, 255, 0, 0.8],      // Yellow
  poor: [255, 165, 0, 0.8],      // Orange
  veryPoor: [255, 0, 0, 0.8]     // Red
};

// Simplified 3-class colors for cleaner visualization
const SIMPLE_COLORS = {
  good: [76, 175, 80, 0.9],      // Green
  fair: [255, 193, 7, 0.9],      // Amber
  poor: [244, 67, 54, 0.9]       // Red
};

// KPI thresholds based on 2018 report
const KPI_THRESHOLDS = {
  iri: {
    veryGood: 3,
    good: 4,
    fair: 5,
    poor: 7
  },
  rut: {
    veryGood: 6,
    good: 9,
    fair: 15,
    poor: 20
  },
  csc: {
    veryPoor: 0.35,
    poor: 0.40,
    fair: 0.45,
    good: 0.50
  },
  lpv3: {
    veryGood: 2,
    good: 4,
    fair: 7,
    poor: 10
  },
  psci: {
    veryPoor: 2,
    poor: 4,
    fair: 6,
    good: 8
  },
  mpd: {
    poor: 0.6,
    good: 0.7
  }
};

export default class RendererService {
  /**
   * Creates a class break renderer for a specific KPI and year
   * @param kpi - The KPI type (iri, rut, psci, etc.)
   * @param year - The survey year (2011, 2018, 2025)
   * @returns ClassBreaksRenderer configured for the KPI
   */
  static createKPIRenderer(kpi: KPIKey, year: number): ClassBreaksRenderer {
    // Construct the field name based on KPI and year
    const fieldName = `roads_csv_${kpi}_${year}`;
    
    // Get thresholds for this KPI
    const thresholds = KPI_THRESHOLDS[kpi];
    
    // Create the renderer
    const renderer = new ClassBreaksRenderer({
      field: fieldName,
      defaultSymbol: new SimpleLineSymbol({
        color: [128, 128, 128, 0.5], // Gray for null/undefined values
        width: 2
      })
    });
    
    // Add class breaks based on KPI type
    if (kpi === 'iri' || kpi === 'rut' || kpi === 'lpv3') {
      // Lower values are better
      this.addStandardBreaks(renderer, thresholds, false);
    } else if (kpi === 'csc') {
      // Higher values are better
      this.addInvertedBreaks(renderer, thresholds);
    } else if (kpi === 'psci') {
      // PSCI uses 1-10 scale, higher is better
      this.addPSCIBreaks(renderer);
    } else if (kpi === 'mpd') {
      // MPD has simple poor/good threshold
      this.addMPDBreaks(renderer, thresholds);
    }
    
    return renderer;
  }
  
  /**
   * Add standard class breaks (lower values = better condition)
   */
  private static addStandardBreaks(
    renderer: ClassBreaksRenderer, 
    thresholds: any, 
    use5Classes: boolean = false
  ): void {
    if (use5Classes && thresholds.veryGood !== undefined) {
      // 5-class system
      renderer.addClassBreakInfo({
        minValue: 0,
        maxValue: thresholds.veryGood,
        symbol: new SimpleLineSymbol({
          color: COLORS.veryGood,
          width: 4
        }),
        label: 'Very Good'
      });
      
      renderer.addClassBreakInfo({
        minValue: thresholds.veryGood,
        maxValue: thresholds.good,
        symbol: new SimpleLineSymbol({
          color: COLORS.good,
          width: 4
        }),
        label: 'Good'
      });
      
      renderer.addClassBreakInfo({
        minValue: thresholds.good,
        maxValue: thresholds.fair,
        symbol: new SimpleLineSymbol({
          color: COLORS.fair,
          width: 4
        }),
        label: 'Fair'
      });
      
      renderer.addClassBreakInfo({
        minValue: thresholds.fair,
        maxValue: thresholds.poor,
        symbol: new SimpleLineSymbol({
          color: COLORS.poor,
          width: 4
        }),
        label: 'Poor'
      });
      
      renderer.addClassBreakInfo({
        minValue: thresholds.poor,
        maxValue: 9999999,
        symbol: new SimpleLineSymbol({
          color: COLORS.veryPoor,
          width: 4
        }),
        label: 'Very Poor'
      });
    } else {
      // 3-class simplified system (Good includes Very Good + Good)
      renderer.addClassBreakInfo({
        minValue: 0,
        maxValue: thresholds.good,
        symbol: new SimpleLineSymbol({
          color: SIMPLE_COLORS.good,
          width: 4
        }),
        label: 'Good'
      });
      
      renderer.addClassBreakInfo({
        minValue: thresholds.good,
        maxValue: thresholds.fair,
        symbol: new SimpleLineSymbol({
          color: SIMPLE_COLORS.fair,
          width: 4
        }),
        label: 'Fair'
      });
      
      renderer.addClassBreakInfo({
        minValue: thresholds.fair,
        maxValue: 9999999,
        symbol: new SimpleLineSymbol({
          color: SIMPLE_COLORS.poor,
          width: 4
        }),
        label: 'Poor'
      });
    }
  }
  
  /**
   * Add inverted class breaks for CSC (higher values = better condition)
   */
  private static addInvertedBreaks(renderer: ClassBreaksRenderer, thresholds: any): void {
    // For CSC: higher values are better
    renderer.addClassBreakInfo({
      minValue: 0,
      maxValue: thresholds.veryPoor,
      symbol: new SimpleLineSymbol({
        color: SIMPLE_COLORS.poor,
        width: 4
      }),
      label: 'Poor'
    });
    
    renderer.addClassBreakInfo({
      minValue: thresholds.veryPoor,
      maxValue: thresholds.fair,
      symbol: new SimpleLineSymbol({
        color: SIMPLE_COLORS.fair,
        width: 4
      }),
      label: 'Fair'
    });
    
    renderer.addClassBreakInfo({
      minValue: thresholds.fair,
      maxValue: 1,
      symbol: new SimpleLineSymbol({
        color: SIMPLE_COLORS.good,
        width: 4
      }),
      label: 'Good'
    });
  }
  
  /**
   * Add PSCI-specific breaks (1-10 scale)
   */
  private static addPSCIBreaks(renderer: ClassBreaksRenderer): void {
    // PSCI: 1-4 = Poor, 5-6 = Fair, 7-10 = Good
    renderer.addClassBreakInfo({
      minValue: 0,
      maxValue: 4,
      symbol: new SimpleLineSymbol({
        color: SIMPLE_COLORS.poor,
        width: 4
      }),
      label: 'Poor (Reconstruction/Structural)'
    });
    
    renderer.addClassBreakInfo({
      minValue: 4,
      maxValue: 6,
      symbol: new SimpleLineSymbol({
        color: SIMPLE_COLORS.fair,
        width: 4
      }),
      label: 'Fair (Surface Restoration)'
    });
    
    renderer.addClassBreakInfo({
      minValue: 6,
      maxValue: 10,
      symbol: new SimpleLineSymbol({
        color: SIMPLE_COLORS.good,
        width: 4
      }),
      label: 'Good (Routine Maintenance)'
    });
  }
  
  /**
   * Add MPD-specific breaks
   */
  private static addMPDBreaks(renderer: ClassBreaksRenderer, thresholds: any): void {
    // MPD: <0.6 = Poor, >0.7 = Good, 0.6-0.7 = Fair
    renderer.addClassBreakInfo({
      minValue: 0,
      maxValue: thresholds.poor,
      symbol: new SimpleLineSymbol({
        color: SIMPLE_COLORS.poor,
        width: 4
      }),
      label: 'Poor Skid Resistance'
    });
    
    renderer.addClassBreakInfo({
      minValue: thresholds.poor,
      maxValue: thresholds.good,
      symbol: new SimpleLineSymbol({
        color: SIMPLE_COLORS.fair,
        width: 4
      }),
      label: 'Fair'
    });
    
    renderer.addClassBreakInfo({
      minValue: thresholds.good,
      maxValue: 9999999,
      symbol: new SimpleLineSymbol({
        color: SIMPLE_COLORS.good,
        width: 4
      }),
      label: 'Good Skid Resistance'
    });
  }
  
  /**
   * Get the condition class for a value based on KPI type and thresholds
   * Used for statistics calculations
   */
  static getConditionClass(kpi: KPIKey, value: number): 'good' | 'fair' | 'poor' | null {
    if (value === null || value === undefined || isNaN(value)) return null;
    
    const thresholds = KPI_THRESHOLDS[kpi];
    
    if (kpi === 'iri' || kpi === 'rut' || kpi === 'lpv3') {
      // Lower is better
      if (value < thresholds.good) return 'good';
      if (value < thresholds.fair) return 'fair';
      return 'poor';
    } else if (kpi === 'csc') {
      // Higher is better
      if (value >= thresholds.fair) return 'good';
      if (value >= thresholds.veryPoor) return 'fair';
      return 'poor';
    } else if (kpi === 'psci') {
      // 1-10 scale, higher is better
      if (value > 6) return 'good';
      if (value > 4) return 'fair';
      return 'poor';
    } else if (kpi === 'mpd') {
      // MPD thresholds
      if (value >= thresholds.good) return 'good';
      if (value >= thresholds.poor) return 'fair';
      return 'poor';
    }
    
    return null;
  }
}