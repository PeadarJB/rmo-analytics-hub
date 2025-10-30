// src/store/slices/filterSlice.ts
/**
 * ============================================================================
 * RMO Analytics Hub - Filter Slice
 * ============================================================================
 * 
 * Manages filter state and application logic for the road network layer.
 * 
 * Responsibilities:
 * - Filter state management (year, subgroup, LA, route)
 * - Active KPI selection
 * - Definition expression generation
 * - Filter application to layers
 * - Filter reset/clear operations
 * 
 * @module store/slices/filterSlice
 */

import type { StateCreator } from 'zustand';
import { message } from 'antd';
import QueryService from '@/services/QueryService';
import { CONFIG } from '@/config/appConfig';
import type { KPIKey } from '@/config/kpiConfig';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Filter state structure
 * Note: Year determines which data fields to query (e.g., AIRI_2025)
 *       but is NOT included in the SQL WHERE clause
 */
export interface FilterState {
  /** Survey year (2011, 2018, or 2025) */
  year: number;
  
  /** Selected subgroup codes (10=Former National, 20=Dublin, 30=City/Town, 40=Peat, 50=Rural) */
  subgroup: number[];
  
  /** Selected local authority names */
  localAuthority: string[];
  
  /** Selected route identifiers */
  route: string[];
}

/**
 * Partial filter update (all fields optional)
 */
export type FilterUpdate = Partial<FilterState>;

// ============================================================================
// STATE INTERFACE
// ============================================================================

export interface FilterSlice {
  // ============================================================================
  // Filter State
  // ============================================================================
  
  /** Current filter state */
  currentFilters: FilterState;
  
  /** Number of active filters (excluding year, which is always set) */
  appliedFiltersCount: number;
  
  /** Currently active KPI for visualization */
  activeKpi: KPIKey;
  
  // ============================================================================
  // Actions - Filter Management
  // ============================================================================
  
  /**
   * Set active KPI
   * Triggers renderer and statistics updates
   * @param kpi - The KPI to activate
   */
  setActiveKpi: (kpi: KPIKey) => void;
  
  /**
   * Update one or more filter values
   * Automatically validates year and applies to layer
   * @param filters - Partial filter update
   */
  setFilters: (filters: FilterUpdate) => void;
  
  /**
   * Set year filter explicitly
   * @param year - Survey year (2011, 2018, or 2025)
   */
  setYear: (year: number) => void;
  
  /**
   * Set subgroup filter
   * @param subgroupCodes - Array of subgroup codes
   */
  setSubgroup: (subgroupCodes: number[]) => void;
  
  /**
   * Set local authority filter
   * @param authorities - Array of LA names
   */
  setLocalAuthority: (authorities: string[]) => void;
  
  /**
   * Set route filter
   * @param routes - Array of route identifiers
   */
  setRoute: (routes: string[]) => void;
  
  /**
   * Clear all filters except year
   * Resets the map and recalculates statistics
   */
  clearAllFilters: () => void;
  
  /**
   * Clear a specific filter type
   * @param filterType - The filter to clear
   */
  clearFilter: (filterType: 'subgroup' | 'localAuthority' | 'route') => void;
  
  /**
   * Apply current filters to the road layer
   * Generates and applies definition expression
   */
  applyFiltersToLayer: () => void;
  
  // ============================================================================
  // Actions - Definition Expression
  // ============================================================================
  
  /**
   * Build SQL WHERE clause from current filters
   * Note: Year is NOT included in the expression
   * @returns SQL WHERE clause string
   */
  buildDefinitionExpression: () => string;
  
  /**
   * Get current definition expression from road layer
   * @returns Current definition expression or '1=1' if none
   */
  getCurrentDefinitionExpression: () => string;
  
  // ============================================================================
  // Actions - Filter Validation
  // ============================================================================
  
  /**
   * Validate and normalize year value
   * Handles string coercion and range validation
   * @param year - Year value to validate (string or number)
   * @returns Normalized year number or default year if invalid
   */
  validateYear: (year: number | string) => number;
  
  /**
   * Calculate the number of active filters (excluding year)
   * @returns Count of non-empty filters
   */
  calculateAppliedFiltersCount: () => number;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const VALID_YEARS = [2011, 2018, 2025] as const;
const MIN_YEAR = 2000;
const MAX_YEAR = 2030;

// ============================================================================
// SLICE CREATOR
// ============================================================================

export const createFilterSlice: StateCreator<FilterSlice> = (set, get) => ({
  // ============================================================================
  // Initial State
  // ============================================================================
  
  currentFilters: {
    year: CONFIG.defaultYear,
    subgroup: [],
    localAuthority: [],
    route: [],
  },
  
  appliedFiltersCount: 0,
  
  activeKpi: CONFIG.defaultKPI,
  
  // ============================================================================
  // Actions - Filter Management
  // ============================================================================
  
  setActiveKpi: (kpi: KPIKey) => {
    set({ activeKpi: kpi });
    console.log(`[Filter] Active KPI changed to: ${kpi}`);
  },
  
  setFilters: (filters: FilterUpdate) => {
    const currentFilters = get().currentFilters;
    const newFilters = { ...currentFilters };
    
    // Track if year changed (affects which data fields to query)
    let yearChanged = false;
    
    // Validate and apply year if provided
    if (filters.year !== undefined) {
      const validatedYear = get().validateYear(filters.year);
      if (validatedYear !== currentFilters.year) {
        newFilters.year = validatedYear;
        yearChanged = true;
      }
    }
    
    // Apply other filter updates
    if (filters.subgroup !== undefined) {
      newFilters.subgroup = filters.subgroup;
    }
    if (filters.localAuthority !== undefined) {
      newFilters.localAuthority = filters.localAuthority;
    }
    if (filters.route !== undefined) {
      newFilters.route = filters.route;
    }
    
    // Calculate applied filters count (excluding year)
    const appliedFiltersCount = 
      newFilters.subgroup.length +
      newFilters.localAuthority.length +
      newFilters.route.length;
    
    // Update state
    set({ 
      currentFilters: newFilters,
      appliedFiltersCount
    });
    
    // Apply to layer
    get().applyFiltersToLayer();
    
    console.log(
      `[Filter] Updated - Year: ${newFilters.year}, ` +
      `Subgroups: ${newFilters.subgroup.length}, ` +
      `LAs: ${newFilters.localAuthority.length}, ` +
      `Routes: ${newFilters.route.length}` +
      (yearChanged ? ' (year changed - renderer update required)' : '')
    );
  },
  
  setYear: (year: number) => {
    get().setFilters({ year });
  },
  
  setSubgroup: (subgroupCodes: number[]) => {
    get().setFilters({ subgroup: subgroupCodes });
  },
  
  setLocalAuthority: (authorities: string[]) => {
    get().setFilters({ localAuthority: authorities });
  },
  
  setRoute: (routes: string[]) => {
    get().setFilters({ route: routes });
  },
  
  clearAllFilters: () => {
    const currentYear = get().currentFilters.year;
    
    const resetFilters: FilterState = {
      year: currentYear,
      subgroup: [],
      localAuthority: [],
      route: [],
    };
    
    set({ 
      currentFilters: resetFilters,
      appliedFiltersCount: 0
    });
    
    // Apply to layer (will set definition expression to '1=1')
    get().applyFiltersToLayer();
    
    message.success('All filters cleared');
    console.log('[Filter] All filters cleared, maintaining year:', currentYear);
  },
  
  clearFilter: (filterType: 'subgroup' | 'localAuthority' | 'route') => {
    const currentFilters = get().currentFilters;
    
    const update: FilterUpdate = {
      [filterType]: [],
    };
    
    get().setFilters(update);
    
    const filterLabels = {
      subgroup: 'Subgroup',
      localAuthority: 'Local Authority',
      route: 'Route',
    };
    
    message.info(`${filterLabels[filterType]} filter cleared`);
    console.log(`[Filter] Cleared ${filterType} filter`);
  },
  
  applyFiltersToLayer: () => {
    const definitionExpression = get().buildDefinitionExpression();
    
    // Note: Actual layer application happens in mapSlice or via store integration
    // This method just generates the expression - the store coordinator will apply it
    
    console.log('[Filter] Generated definition expression:', definitionExpression);
    
    // Return the expression so it can be used by other slices
    return definitionExpression;
  },
  
  // ============================================================================
  // Actions - Definition Expression
  // ============================================================================
  
  buildDefinitionExpression: () => {
    const { currentFilters } = get();
    
    // Use QueryService to build the WHERE clause
    // Note: Year is explicitly NOT included - it determines field names, not filtering
    const expression = QueryService.buildDefinitionExpression({
      localAuthority: currentFilters.localAuthority,
      subgroup: currentFilters.subgroup,
      route: currentFilters.route,
    });
    
    return expression;
  },
  
  getCurrentDefinitionExpression: () => {
    // This will be implemented by the store coordinator
    // For now, return a placeholder
    return '1=1';
  },
  
  // ============================================================================
  // Actions - Filter Validation
  // ============================================================================
  
  validateYear: (year: number | string): number => {
    // Handle string coercion
    if (typeof year === 'string') {
      const parsed = parseInt(year, 10);
      if (!isNaN(parsed) && parsed >= MIN_YEAR && parsed <= MAX_YEAR) {
        console.warn(`[Filter] Coerced year from string to number: "${year}" → ${parsed}`);
        return parsed;
      } else {
        console.warn(`[Filter] Invalid year string "${year}", using default: ${CONFIG.defaultYear}`);
        return CONFIG.defaultYear;
      }
    }
    
    // Handle number validation
    if (typeof year === 'number' && year >= MIN_YEAR && year <= MAX_YEAR) {
      return year;
    }
    
    console.warn(`[Filter] Invalid year value ${year}, using default: ${CONFIG.defaultYear}`);
    return CONFIG.defaultYear;
  },
  
  calculateAppliedFiltersCount: () => {
    const { currentFilters } = get();
    
    return (
      currentFilters.subgroup.length +
      currentFilters.localAuthority.length +
      currentFilters.route.length
    );
  },
});