// src/store/slices/uiSlice.ts
/**
 * ============================================================================
 * RMO Analytics Hub - UI Slice
 * ============================================================================
 * 
 * Manages UI state including panel visibility, theme mode, and loading states.
 * 
 * Responsibilities:
 * - Panel visibility (enhanced panels, summary page)
 * - Sider collapse/expand state
 * - Theme mode (light/dark)
 * - Loading overlays
 * 
 * @module store/slices/uiSlice
 */

import type { StateCreator } from 'zustand';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Theme mode options
 */
export type ThemeMode = 'light' | 'dark';

/**
 * Loading overlay configuration
 */
export interface LoadingOverlay {
  visible: boolean;
  message?: string;
  progress?: number;
}

// ============================================================================
// STATE INTERFACE
// ============================================================================

export interface UiSlice {
  // ============================================================================
  // Panel Visibility State
  // ============================================================================
  
  /** Whether the enhanced chart panel is visible */
  chartPanelVisible: boolean;
  
  /** Whether the condition summary page is visible */
  summaryVisible: boolean;
  
  /** Whether swipe mode is enabled */
  swipeEnabled: boolean;
  
  // ============================================================================
  // Sider State
  // ============================================================================
  
  /** Whether the left sider is collapsed */
  siderCollapsed: boolean;
  
  // ============================================================================
  // Theme State
  // ============================================================================
  
  /** Current theme mode (light or dark) */
  themeMode: ThemeMode;
  
  // ============================================================================
  // Loading State
  // ============================================================================
  
  /** Loading overlay configuration */
  loadingOverlay: LoadingOverlay;
  
  // ============================================================================
  // Actions - Panel Visibility
  // ============================================================================
  
  /**
   * Toggle the chart panel visibility
   */
  toggleChartPanel: () => void;
  
  /**
   * Set chart panel visibility explicitly
   * @param visible - Whether the panel should be visible
   */
  setChartPanelVisible: (visible: boolean) => void;
  
  /**
   * Toggle the condition summary page visibility
   */
  toggleSummaryVisible: () => void;
  
  /**
   * Set summary page visibility explicitly
   * @param visible - Whether the summary should be visible
   */
  setSummaryVisible: (visible: boolean) => void;
  
  /**
   * Toggle swipe mode on/off
   */
  toggleSwipeMode: () => void;
  
  /**
   * Set swipe mode explicitly
   * @param enabled - Whether swipe mode should be enabled
   */
  setSwipeEnabled: (enabled: boolean) => void;
  
  // ============================================================================
  // Actions - Sider
  // ============================================================================
  
  /**
   * Toggle the sider collapsed state
   */
  toggleSider: () => void;
  
  /**
   * Set sider collapsed state explicitly
   * @param collapsed - Whether the sider should be collapsed
   */
  setSiderCollapsed: (collapsed: boolean) => void;
  
  // ============================================================================
  // Actions - Theme
  // ============================================================================
  
  /**
   * Toggle between light and dark theme
   */
  toggleTheme: () => void;
  
  /**
   * Set theme mode explicitly
   * @param mode - The theme mode to set
   */
  setThemeMode: (mode: ThemeMode) => void;
  
  // ============================================================================
  // Actions - Loading
  // ============================================================================
  
  /**
   * Show loading overlay with optional message and progress
   * @param message - Optional loading message
   * @param progress - Optional progress percentage (0-100)
   */
  showLoading: (message?: string, progress?: number) => void;
  
  /**
   * Hide loading overlay
   */
  hideLoading: () => void;
  
  /**
   * Update loading progress
   * @param progress - Progress percentage (0-100)
   */
  updateLoadingProgress: (progress: number) => void;
}

// ============================================================================
// SLICE CREATOR
// ============================================================================

export const createUiSlice: StateCreator<UiSlice> = (set, get) => ({
  // ============================================================================
  // Initial State
  // ============================================================================
  
  chartPanelVisible: false,
  summaryVisible: false,
  swipeEnabled: false,
  siderCollapsed: false,
  themeMode: 'light',
  loadingOverlay: {
    visible: false,
    message: undefined,
    progress: undefined,
  },
  
  // ============================================================================
  // Actions - Panel Visibility
  // ============================================================================
  
  toggleChartPanel: () => {
    set((state) => {
      const newVisible = !state.chartPanelVisible;
      console.log(`[UI] Chart panel ${newVisible ? 'opened' : 'closed'}`);
      return { chartPanelVisible: newVisible };
    });
  },
  
  setChartPanelVisible: (visible: boolean) => {
    set({ chartPanelVisible: visible });
    console.log(`[UI] Chart panel visibility set to: ${visible}`);
  },
  
  toggleSummaryVisible: () => {
    set((state) => {
      const newVisible = !state.summaryVisible;
      console.log(`[UI] Summary page ${newVisible ? 'shown' : 'hidden'}`);
      return { summaryVisible: newVisible };
    });
  },
  
  setSummaryVisible: (visible: boolean) => {
    set({ summaryVisible: visible });
    console.log(`[UI] Summary page visibility set to: ${visible}`);
  },
  
  toggleSwipeMode: () => {
    set((state) => {
      const newEnabled = !state.swipeEnabled;
      console.log(`[UI] Swipe mode ${newEnabled ? 'enabled' : 'disabled'}`);
      return { swipeEnabled: newEnabled };
    });
  },
  
  setSwipeEnabled: (enabled: boolean) => {
    set({ swipeEnabled: enabled });
    console.log(`[UI] Swipe mode set to: ${enabled}`);
  },
  
  // ============================================================================
  // Actions - Sider
  // ============================================================================
  
  toggleSider: () => {
    set((state) => {
      const newCollapsed = !state.siderCollapsed;
      console.log(`[UI] Sider ${newCollapsed ? 'collapsed' : 'expanded'}`);
      return { siderCollapsed: newCollapsed };
    });
  },
  
  setSiderCollapsed: (collapsed: boolean) => {
    set({ siderCollapsed: collapsed });
    console.log(`[UI] Sider collapsed state set to: ${collapsed}`);
  },
  
  // ============================================================================
  // Actions - Theme
  // ============================================================================
  
  toggleTheme: () => {
    set((state) => {
      const newTheme: ThemeMode = state.themeMode === 'light' ? 'dark' : 'light';
      console.log(`[UI] Theme switched to: ${newTheme}`);
      return { themeMode: newTheme };
    });
  },
  
  setThemeMode: (mode: ThemeMode) => {
    set({ themeMode: mode });
    console.log(`[UI] Theme mode set to: ${mode}`);
  },
  
  // ============================================================================
  // Actions - Loading
  // ============================================================================
  
  showLoading: (message?: string, progress?: number) => {
    set({
      loadingOverlay: {
        visible: true,
        message,
        progress,
      },
    });
    console.log(`[UI] Loading overlay shown${message ? `: ${message}` : ''}`);
  },
  
  hideLoading: () => {
    set({
      loadingOverlay: {
        visible: false,
        message: undefined,
        progress: undefined,
      },
    });
    console.log('[UI] Loading overlay hidden');
  },
  
  updateLoadingProgress: (progress: number) => {
    set((state) => ({
      loadingOverlay: {
        ...state.loadingOverlay,
        progress: Math.min(100, Math.max(0, progress)), // Clamp between 0-100
      },
    }));
    console.log(`[UI] Loading progress updated: ${progress}%`);
  },
});