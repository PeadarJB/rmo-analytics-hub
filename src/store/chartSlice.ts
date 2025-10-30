// src/store/slices/chartSlice.ts
/**
 * ============================================================================
 * RMO Analytics Hub - Chart Slice
 * ============================================================================
 * 
 * Manages chart-specific state including selections, filtering, and highlights.
 * 
 * Responsibilities:
 * - Chart selection management (add/remove/toggle/clear)
 * - Multi-select support (Ctrl/Cmd/Shift key handling)
 * - Chart-based map filtering
 * - Segment highlighting in charts
 * - Chart filter statistics
 * - WHERE clause generation for chart selections
 * 
 * @module store/slices/chartSlice
 */

import type { StateCreator } from 'zustand';
import { message } from 'antd';
import type { KPIKey } from '@/config/kpiConfig';
import { getKPIFieldName } from '@/config/layerConfig';
import { MAX_CHART_SELECTIONS } from '@/config/constants';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Condition classes for road segments
 */
export type ConditionClass = 'veryGood' | 'good' | 'fair' | 'poor' | 'veryPoor';

/**
 * Chart selection representing a clicked chart segment
 * Each selection identifies a specific group and condition combination
 */
export interface ChartSelection {
  /** Group identifier (e.g., LA name, subgroup name, route) */
  group: string;
  
  /** Condition class of the selection */
  condition: ConditionClass;
  
  /** KPI for this selection */
  kpi: KPIKey;
  
  /** Survey year for this selection */
  year: number;
}

/**
 * Chart-filtered statistics result
 */
export interface ChartFilteredStats {
  /** Total number of segments matching chart selections */
  totalSegments: number;
  
  /** Total length in kilometers */
  totalLengthKm: number;
  
  /** Average KPI value */
  averageValue: number;
  
  /** Breakdown by condition class */
  conditionBreakdown: Record<ConditionClass, number>;
}

/**
 * Chart grouping options
 */
export type ChartGroupBy = 'LA' | 'subgroup' | 'Route';

// ============================================================================
// STATE INTERFACE
// ============================================================================

export interface ChartSlice {
  // ============================================================================
  // Chart Selection State
  // ============================================================================
  
  /** Active chart selections (clicked bars) */
  chartSelections: ChartSelection[];
  
  /** Whether chart filtering is currently active */
  isChartFilterActive: boolean;
  
  /** Segment IDs from the last chart filter operation */
  lastChartSegmentIds: number[];
  
  /** Statistics for currently filtered chart selections */
  chartFilteredStats: ChartFilteredStats | null;
  
  /** Loading state for chart statistics calculation */
  isCalculatingChartStats: boolean;
  
  // ============================================================================
  // Chart Display State
  // ============================================================================
  
  /** Current chart grouping field */
  chartGroupBy: ChartGroupBy;
  
  /** Whether to show stacked bar chart or average chart */
  chartStackedMode: boolean;
  
  /** Currently highlighted chart bars (for visual feedback) */
  highlightedChartBars: Set<string>;
  
  // ============================================================================
  // Actions - Selection Management
  // ============================================================================
  
  /**
   * Add a chart selection
   * Prevents duplicates and enforces max selection limit
   * @param selection - The selection to add
   */
  addChartSelection: (selection: ChartSelection) => void;
  
  /**
   * Remove a specific chart selection
   * @param selection - The selection to remove
   */
  removeChartSelection: (selection: ChartSelection) => void;
  
  /**
   * Toggle a chart selection
   * Handles single-select and multi-select modes
   * @param selection - The selection to toggle
   * @param isMultiSelect - Whether multi-select mode is active (Ctrl/Cmd/Shift)
   */
  toggleChartSelection: (selection: ChartSelection, isMultiSelect: boolean) => void;
  
  /**
   * Clear all chart selections
   * Resets chart filter state and statistics
   */
  clearChartSelections: () => void;
  
  /**
   * Set chart selections explicitly (batch operation)
   * @param selections - Array of selections to set
   */
  setChartSelections: (selections: ChartSelection[]) => void;
  
  // ============================================================================
  // Actions - Filtering
  // ============================================================================
  
  /**
   * Check if a specific selection exists
   * @param selection - The selection to check
   * @returns True if the selection exists
   */
  hasChartSelection: (selection: ChartSelection) => boolean;
  
  /**
   * Build WHERE clause for current chart selections
   * Used to filter map features based on chart clicks
   * @param groupByField - The field name used for grouping (e.g., 'LA', 'Route')
   * @returns SQL WHERE clause string
   */
  buildChartFilterWhereClause: (groupByField: string) => string;
  
  /**
   * Build WHERE clause for a single chart selection
   * @param selection - The selection to build clause for
   * @param groupByField - The field name used for grouping
   * @returns SQL WHERE clause string for this selection
   */
  buildSingleSelectionWhereClause: (selection: ChartSelection, groupByField: string) => string;
  
  /**
   * Store segment IDs from the last chart filter operation
   * Used for maintaining selection state
   * @param segmentIds - Array of segment IDs
   */
  setLastChartSegmentIds: (segmentIds: number[]) => void;
  
  // ============================================================================
  // Actions - Display
  // ============================================================================
  
  /**
   * Set the chart grouping field
   * @param groupBy - The field to group by
   */
  setChartGroupBy: (groupBy: ChartGroupBy) => void;
  
  /**
   * Toggle chart stacked mode
   */
  toggleChartStackedMode: () => void;
  
  /**
   * Set chart stacked mode explicitly
   * @param stacked - Whether to show stacked chart
   */
  setChartStackedMode: (stacked: boolean) => void;
  
  /**
   * Update highlighted chart bars for visual feedback
   * @param barKeys - Set of bar keys to highlight (format: "group_condition")
   */
  setHighlightedChartBars: (barKeys: Set<string>) => void;
  
  /**
   * Get bar key for a selection (used for highlighting)
   * @param selection - The selection
   * @returns Bar key string
   */
  getBarKey: (selection: ChartSelection) => string;
  
  // ============================================================================
  // Actions - Statistics
  // ============================================================================
  
  /**
   * Update chart-filtered statistics
   * @param stats - The statistics to set
   */
  setChartFilteredStats: (stats: ChartFilteredStats | null) => void;
  
  /**
   * Set loading state for chart statistics
   * @param loading - Whether statistics are being calculated
   */
  setCalculatingChartStats: (loading: boolean) => void;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Condition class to numeric value mapping (for WHERE clauses)
 */
const CONDITION_CLASS_VALUES: Record<ConditionClass, number> = {
  veryGood: 1,
  good: 2,
  fair: 3,
  poor: 4,
  veryPoor: 5,
};

/**
 * Subgroup field mapping for WHERE clause generation
 */
const SUBGROUP_FIELDS: Record<string, string> = {
  'Former National': 'IsFormerNa',
  'Dublin': 'IsDublin',
  'City/Town': 'IsCityTown',
  'Peat': 'IsPeat',
  'Rural': 'Rural',
};

// ============================================================================
// SLICE CREATOR
// ============================================================================

export const createChartSlice: StateCreator<ChartSlice> = (set, get) => ({
  // ============================================================================
  // Initial State
  // ============================================================================
  
  chartSelections: [],
  isChartFilterActive: false,
  lastChartSegmentIds: [],
  chartFilteredStats: null,
  isCalculatingChartStats: false,
  chartGroupBy: 'LA',
  chartStackedMode: true,
  highlightedChartBars: new Set<string>(),
  
  // ============================================================================
  // Actions - Selection Management
  // ============================================================================
  
  addChartSelection: (selection: ChartSelection) => {
    const state = get();
    
    // Check if selection already exists
    const exists = state.hasChartSelection(selection);
    
    if (exists) {
      console.log('[Chart Selection] Selection already exists, skipping');
      return;
    }
    
    // Check max selections limit
    if (state.chartSelections.length >= MAX_CHART_SELECTIONS) {
      message.warning(`Maximum ${MAX_CHART_SELECTIONS} chart selections allowed`);
      console.warn(`[Chart Selection] Max limit (${MAX_CHART_SELECTIONS}) reached`);
      return;
    }
    
    // Add selection
    const newSelections = [...state.chartSelections, selection];
    
    set({
      chartSelections: newSelections,
      isChartFilterActive: true,
    });
    
    // Update highlighted bars
    const barKey = get().getBarKey(selection);
    const newHighlights = new Set(state.highlightedChartBars);
    newHighlights.add(barKey);
    set({ highlightedChartBars: newHighlights });
    
    console.log('[Chart Selection] Added:', selection);
    console.log(`[Chart Selection] Total selections: ${newSelections.length}`);
  },
  
  removeChartSelection: (selection: ChartSelection) => {
    const state = get();
    
    const filtered = state.chartSelections.filter(s => !(
      s.group === selection.group && 
      s.condition === selection.condition &&
      s.kpi === selection.kpi &&
      s.year === selection.year
    ));
    
    set({
      chartSelections: filtered,
      isChartFilterActive: filtered.length > 0,
    });
    
    // Update highlighted bars
    const barKey = get().getBarKey(selection);
    const newHighlights = new Set(state.highlightedChartBars);
    newHighlights.delete(barKey);
    set({ highlightedChartBars: newHighlights });
    
    console.log('[Chart Selection] Removed:', selection);
    console.log(`[Chart Selection] Total selections: ${filtered.length}`);
  },
  
  toggleChartSelection: (selection: ChartSelection, isMultiSelect: boolean) => {
    const state = get();
    const exists = state.hasChartSelection(selection);
    
    if (isMultiSelect) {
      // Multi-select mode: add or remove
      if (exists) {
        state.removeChartSelection(selection);
        message.info('Selection removed');
      } else {
        state.addChartSelection(selection);
        message.success('Selection added');
      }
    } else {
      // Single-select mode: replace or clear
      if (exists && state.chartSelections.length === 1) {
        // If clicking the only selection, clear it
        state.clearChartSelections();
        message.info('Selection cleared');
      } else {
        // Replace all selections with this one
        set({
          chartSelections: [selection],
          isChartFilterActive: true,
        });
        
        // Update highlights to only show this selection
        const barKey = get().getBarKey(selection);
        set({ highlightedChartBars: new Set([barKey]) });
        
        console.log('[Chart Selection] Replaced with:', selection);
        message.success('Selection applied');
      }
    }
  },
  
  clearChartSelections: () => {
    set({
      chartSelections: [],
      isChartFilterActive: false,
      chartFilteredStats: null,
      lastChartSegmentIds: [],
      highlightedChartBars: new Set(),
    });
    
    console.log('[Chart Selection] Cleared all selections');
  },
  
  setChartSelections: (selections: ChartSelection[]) => {
    // Enforce max limit
    const limitedSelections = selections.slice(0, MAX_CHART_SELECTIONS);
    
    if (selections.length > MAX_CHART_SELECTIONS) {
      message.warning(`Only the first ${MAX_CHART_SELECTIONS} selections will be applied`);
    }
    
    set({
      chartSelections: limitedSelections,
      isChartFilterActive: limitedSelections.length > 0,
    });
    
    // Update highlights
    const barKeys = new Set(limitedSelections.map(s => get().getBarKey(s)));
    set({ highlightedChartBars: barKeys });
    
    console.log(`[Chart Selection] Set ${limitedSelections.length} selections`);
  },
  
  // ============================================================================
  // Actions - Filtering
  // ============================================================================
  
  hasChartSelection: (selection: ChartSelection) => {
    const state = get();
    return state.chartSelections.some(s => 
      s.group === selection.group && 
      s.condition === selection.condition &&
      s.kpi === selection.kpi &&
      s.year === selection.year
    );
  },
  
  buildChartFilterWhereClause: (groupByField: string) => {
    const state = get();
    
    if (state.chartSelections.length === 0) {
      return '1=1';
    }
    
    // Build WHERE clause for each selection
    const whereClauses = state.chartSelections.map(selection => 
      state.buildSingleSelectionWhereClause(selection, groupByField)
    );
    
    // Combine with OR (any of the selections matches)
    const combinedWhere = whereClauses.join(' OR ');
    
    console.log('[Chart Filter] Built WHERE clause:', combinedWhere);
    return `(${combinedWhere})`;
  },
  
  buildSingleSelectionWhereClause: (selection: ChartSelection, groupByField: string) => {
    const { group, condition, kpi, year } = selection;
    
    // Build group clause
    let groupClause: string;
    
    if (groupByField === 'subgroup') {
      // Special handling for subgroup filtering
      const subgroupField = SUBGROUP_FIELDS[group];
      
      if (group === 'Rural') {
        // Rural is absence of other flags
        groupClause = '(IsFormerNa = 0 AND IsDublin = 0 AND IsCityTown = 0 AND IsPeat = 0)';
      } else if (subgroupField) {
        groupClause = `${subgroupField} = 1`;
      } else {
        console.warn(`[Chart Filter] Unknown subgroup: ${group}`);
        groupClause = '1=1';
      }
    } else {
      // Standard field equality
      // Escape single quotes in group name
      const escapedGroup = group.replace(/'/g, "''");
      groupClause = `${groupByField} = '${escapedGroup}'`;
    }
    
    // Build condition clause using class field
    const kpiField = getKPIFieldName(kpi, year);
    const classValue = CONDITION_CLASS_VALUES[condition];
    
    // Get base class field name (e.g., "IRI_Class" from "IRI_Class_2025")
    const classFieldBase = kpiField.replace(`_${year}`, '');
    const classFieldName = `${classFieldBase}_Class`;
    
    const conditionClause = `${classFieldName} = ${classValue}`;
    
    return `(${groupClause} AND ${conditionClause})`;
  },
  
  setLastChartSegmentIds: (segmentIds: number[]) => {
    set({ lastChartSegmentIds: segmentIds });
    console.log(`[Chart Filter] Stored ${segmentIds.length} segment IDs`);
  },
  
  // ============================================================================
  // Actions - Display
  // ============================================================================
  
  setChartGroupBy: (groupBy: ChartGroupBy) => {
    set({ chartGroupBy: groupBy });
    console.log(`[Chart Display] Group by changed to: ${groupBy}`);
  },
  
  toggleChartStackedMode: () => {
    set((state) => {
      const newMode = !state.chartStackedMode;
      console.log(`[Chart Display] Stacked mode: ${newMode ? 'ON' : 'OFF'}`);
      return { chartStackedMode: newMode };
    });
  },
  
  setChartStackedMode: (stacked: boolean) => {
    set({ chartStackedMode: stacked });
    console.log(`[Chart Display] Stacked mode set to: ${stacked}`);
  },
  
  setHighlightedChartBars: (barKeys: Set<string>) => {
    set({ highlightedChartBars: barKeys });
    console.log(`[Chart Display] Highlighted ${barKeys.size} bars`);
  },
  
  getBarKey: (selection: ChartSelection) => {
    return `${selection.group}_${selection.condition}`;
  },
  
  // ============================================================================
  // Actions - Statistics
  // ============================================================================
  
  setChartFilteredStats: (stats: ChartFilteredStats | null) => {
    set({ chartFilteredStats: stats });
    
    if (stats) {
      console.log('[Chart Stats] Updated:', {
        segments: stats.totalSegments,
        lengthKm: stats.totalLengthKm.toFixed(2),
        avgValue: stats.averageValue.toFixed(2),
      });
    } else {
      console.log('[Chart Stats] Cleared');
    }
  },
  
  setCalculatingChartStats: (loading: boolean) => {
    set({ isCalculatingChartStats: loading });
  },
});