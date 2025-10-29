// src/config/constants.ts

import type { KPIKey } from './kpiConfig';

/**
 * ============================================================================
 * ROAD NETWORK CONSTANTS
 * ============================================================================
 */

/**
 * Standard segment length for Irish regional roads
 * All road segments in the RMO network are exactly 100 meters
 */
export const SEGMENT_LENGTH_METERS = 100;

/**
 * Segment length in kilometers (for area/length calculations)
 * 100 meters = 0.1 kilometers
 */
export const SEGMENT_LENGTH_KM = 0.1;

/**
 * ============================================================================
 * SURVEY YEAR CONSTANTS
 * ============================================================================
 */

/**
 * Available survey years in the dataset
 * These years have complete pavement condition data
 */
export const SURVEY_YEARS = [2011, 2018, 2025] as const;

/**
 * Type for valid survey years (derived from SURVEY_YEARS)
 */
export type SurveyYear = typeof SURVEY_YEARS[number];

/**
 * Default year for initial application load
 * Set to most recent survey year
 */
export const DEFAULT_YEAR: SurveyYear = 2025;

/**
 * Minimum valid year for data queries
 */
export const MIN_YEAR = 2011;

/**
 * Maximum valid year for data queries
 */
export const MAX_YEAR = 2025;

/**
 * ============================================================================
 * KPI DEFAULTS
 * ============================================================================
 */

/**
 * Default KPI to display on application load
 * IRI (International Roughness Index) is the primary pavement condition metric
 */
export const DEFAULT_KPI: KPIKey = 'iri';

/**
 * Default grouping field for statistics and charts
 * Groups data by Local Authority (county)
 */
export const DEFAULT_GROUP_BY = 'LA';

/**
 * ============================================================================
 * MAP CONFIGURATION CONSTANTS
 * ============================================================================
 */

/**
 * Default map center coordinates [longitude, latitude]
 * Centered on Ireland (approximate geographic center)
 */
export const DEFAULT_MAP_CENTER: [number, number] = [-8.0, 53.3];

/**
 * Default map zoom level
 * Level 7 shows the entire island of Ireland
 */
export const DEFAULT_MAP_ZOOM = 7;

/**
 * Map animation duration in milliseconds
 */
export const MAP_ANIMATION_DURATION = 1000;

/**
 * Map animation easing function
 */
export const MAP_ANIMATION_EASING = 'ease-in-out';

/**
 * ============================================================================
 * UI CONFIGURATION CONSTANTS
 * ============================================================================
 */

/**
 * Debounce delay for filter inputs (milliseconds)
 * Prevents excessive re-rendering while user is typing
 */
export const FILTER_DEBOUNCE_DELAY = 300;

/**
 * Debounce delay for search inputs (milliseconds)
 */
export const SEARCH_DEBOUNCE_DELAY = 500;

/**
 * Default sider (sidebar) collapsed state
 */
export const DEFAULT_SIDER_COLLAPSED = true;

/**
 * Sider width when expanded (pixels)
 */
export const SIDER_WIDTH = 280;

/**
 * Sider width when collapsed (pixels)
 */
export const SIDER_COLLAPSED_WIDTH = 0;

/**
 * ============================================================================
 * CHART CONFIGURATION CONSTANTS
 * ============================================================================
 */

/**
 * Maximum number of chart bars to display
 * Prevents overcrowding in grouped charts
 */
export const MAX_CHART_BARS = 50;

/**
 * Default chart height (pixels)
 */
export const CHART_HEIGHT = 400;

/**
 * Chart animation duration (milliseconds)
 */
export const CHART_ANIMATION_DURATION = 750;

/**
 * Maximum number of selected chart items for filtering
 */
export const MAX_CHART_SELECTIONS = 10;

/**
 * ============================================================================
 * STATISTICS CONSTANTS
 * ============================================================================
 */

/**
 * Minimum segment count for valid statistics
 * Statistics are not computed if fewer segments meet filter criteria
 */
export const MIN_SEGMENTS_FOR_STATS = 1;

/**
 * Progress reporting interval for large queries
 * Report progress every N features processed
 */
export const PROGRESS_REPORT_INTERVAL = 10000;

/**
 * Statistics cache timeout (milliseconds)
 * Cached statistics expire after 5 minutes
 */
export const STATS_CACHE_TIMEOUT = 300000; // 5 minutes

/**
 * ============================================================================
 * RENDERER CONFIGURATION CONSTANTS
 * ============================================================================
 */

/**
 * Default line width for road segments (pixels)
 */
export const DEFAULT_LINE_WIDTH = 2;

/**
 * Selected/highlighted line width (pixels)
 */
export const HIGHLIGHTED_LINE_WIDTH = 4;

/**
 * Outline width for road segments (pixels)
 */
export const OUTLINE_WIDTH = 0.5;

/**
 * Renderer cache size (number of cached renderers)
 * Caches up to 36 renderers (6 KPIs × 3 years × 2 themes)
 */
export const RENDERER_CACHE_SIZE = 36;

/**
 * ============================================================================
 * LAYER VISIBILITY CONSTANTS
 * ============================================================================
 */

/**
 * Default visibility state for road network layer
 */
export const DEFAULT_ROAD_LAYER_VISIBLE = true;

/**
 * Default visibility state for LA polygon layers
 */
export const DEFAULT_LA_LAYER_VISIBLE = false;

/**
 * Z-index for road network layer
 */
export const ROAD_LAYER_Z_INDEX = 1;

/**
 * Z-index for LA polygon layers (below road network)
 */
export const LA_LAYER_Z_INDEX = 0;

/**
 * ============================================================================
 * QUERY CONSTANTS
 * ============================================================================
 */

/**
 * Maximum number of features to return in a single query
 * Set to 0 for no limit (return all matching features)
 */
export const MAX_QUERY_FEATURES = 0;

/**
 * Default SQL order by clause for queries
 */
export const DEFAULT_ORDER_BY = 'OBJECTID ASC';

/**
 * Timeout for feature queries (milliseconds)
 */
export const QUERY_TIMEOUT = 30000; // 30 seconds

/**
 * ============================================================================
 * MESSAGE DISPLAY CONSTANTS
 * ============================================================================
 */

/**
 * Duration for success messages (seconds)
 */
export const SUCCESS_MESSAGE_DURATION = 3;

/**
 * Duration for error messages (seconds)
 */
export const ERROR_MESSAGE_DURATION = 5;

/**
 * Duration for info messages (seconds)
 */
export const INFO_MESSAGE_DURATION = 4;

/**
 * Duration for warning messages (seconds)
 */
export const WARNING_MESSAGE_DURATION = 4;

/**
 * ============================================================================
 * SWIPE MODE CONSTANTS
 * ============================================================================
 */

/**
 * Default swipe position (percentage from left)
 */
export const DEFAULT_SWIPE_POSITION = 50;

/**
 * Default swipe direction
 */
export const DEFAULT_SWIPE_DIRECTION = 'horizontal' as const;

/**
 * Left swipe layer default year
 */
export const DEFAULT_LEFT_SWIPE_YEAR: SurveyYear = 2018;

/**
 * Right swipe layer default year
 */
export const DEFAULT_RIGHT_SWIPE_YEAR: SurveyYear = 2025;

/**
 * ============================================================================
 * CONDITION CLASS CONSTANTS
 * ============================================================================
 */

/**
 * Number of condition classes when using simplified classification
 * 3 classes: Good, Fair, Poor
 */
export const SIMPLIFIED_CLASS_COUNT = 3;

/**
 * Number of condition classes when using full classification
 * 5 classes: Very Good, Good, Fair, Poor, Very Poor
 */
export const FULL_CLASS_COUNT = 5;

/**
 * Default classification mode
 * Set to true to use 5-class system, false for 3-class system
 */
export const DEFAULT_USE_5_CLASSES = true;

/**
 * ============================================================================
 * PERCENTAGE CONSTANTS
 * ============================================================================
 */

/**
 * Number of decimal places for percentage display
 */
export const PERCENTAGE_DECIMAL_PLACES = 1;

/**
 * Number of decimal places for KPI value display
 */
export const KPI_VALUE_DECIMAL_PLACES = 2;

/**
 * Number of decimal places for length display (km)
 */
export const LENGTH_DECIMAL_PLACES = 2;

/**
 * ============================================================================
 * PERFORMANCE CONSTANTS
 * ============================================================================
 */

/**
 * Enable renderer preloading on application start
 */
export const ENABLE_RENDERER_PRELOAD = true;

/**
 * Enable statistics caching
 */
export const ENABLE_STATS_CACHE = true;

/**
 * Enable component lazy loading
 */
export const ENABLE_LAZY_LOADING = true;

/**
 * Throttle delay for map extent change events (milliseconds)
 */
export const MAP_EXTENT_THROTTLE = 250;

/**
 * Throttle delay for window resize events (milliseconds)
 */
export const RESIZE_THROTTLE = 100;

/**
 * ============================================================================
 * VALIDATION CONSTANTS
 * ============================================================================
 */

/**
 * Valid year range start (for data validation)
 */
export const VALID_YEAR_START = 2000;

/**
 * Valid year range end (for data validation)
 */
export const VALID_YEAR_END = 2030;

/**
 * Maximum number of filters that can be applied simultaneously
 */
export const MAX_SIMULTANEOUS_FILTERS = 10;

/**
 * Minimum string length for search queries
 */
export const MIN_SEARCH_LENGTH = 2;

/**
 * Maximum string length for text inputs
 */
export const MAX_INPUT_LENGTH = 255;

/**
 * ============================================================================
 * EXPORT GROUPS
 * ============================================================================
 */

/**
 * All map-related constants grouped for convenience
 */
export const MAP_CONSTANTS = {
  center: DEFAULT_MAP_CENTER,
  zoom: DEFAULT_MAP_ZOOM,
  animationDuration: MAP_ANIMATION_DURATION,
  animationEasing: MAP_ANIMATION_EASING,
  extentThrottle: MAP_EXTENT_THROTTLE
} as const;

/**
 * All UI-related constants grouped for convenience
 */
export const UI_CONSTANTS = {
  filterDebounce: FILTER_DEBOUNCE_DELAY,
  searchDebounce: SEARCH_DEBOUNCE_DELAY,
  siderWidth: SIDER_WIDTH,
  siderCollapsedWidth: SIDER_COLLAPSED_WIDTH,
  defaultSiderCollapsed: DEFAULT_SIDER_COLLAPSED
} as const;

/**
 * All message duration constants grouped for convenience
 */
export const MESSAGE_DURATIONS = {
  success: SUCCESS_MESSAGE_DURATION,
  error: ERROR_MESSAGE_DURATION,
  info: INFO_MESSAGE_DURATION,
  warning: WARNING_MESSAGE_DURATION
} as const;