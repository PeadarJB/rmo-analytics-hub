// src/services/ReportMapService.ts

import WebMap from '@arcgis/core/WebMap';
import MapView from '@arcgis/core/views/MapView';
import Legend from '@arcgis/core/widgets/Legend';
import ScaleBar from '@arcgis/core/widgets/ScaleBar';
import { CONFIG } from '@/config/appConfig';

/**
 * Service for creating independent map instances for report pages
 *
 * Unlike the main dashboard map (managed by useAppStore), report maps:
 * - Create their own WebMap instances (not shared)
 * - Use static symbology (no dynamic renderer changes)
 * - Clean up completely on component unmount
 * - Don't interfere with the main dashboard map
 *
 * This prevents "map already destroyed" errors when navigating between pages.
 */
export class ReportMapService {
  /**
   * Create an independent map view for a report page
   *
   * @param containerId - DOM element ID for the map container
   * @param webMapId - ArcGIS Online web map item ID
   * @param options - Optional configuration
   * @returns MapView and WebMap instances
   */
  static async createReportMap(
    containerId: string,
    webMapId: string,
    options?: {
      center?: [number, number];
      zoom?: number;
      showLegend?: boolean;
      showScaleBar?: boolean;
      constraints?: {
        minZoom?: number;
        maxZoom?: number;
      };
    }
  ): Promise<{ view: MapView; webmap: WebMap; cleanup: () => void }> {
    console.log(`[ReportMapService] Creating report map for container: ${containerId}`);
    console.log(`[ReportMapService] WebMap ID: ${webMapId}`);

    // ENHANCED: Verify WebMap ID is valid
    if (!webMapId || webMapId === 'YOUR_WEBMAP_ID_HERE') {
      throw new Error('Invalid WebMap ID. Please configure CONFIG.webMapId in appConfig.ts');
    }

    // ENHANCED: Verify container exists
    const container = document.getElementById(containerId);
    if (!container) {
      throw new Error(`Container element with ID '${containerId}' not found in DOM`);
    }

    console.log('[ReportMapService] Container verified, creating WebMap...');

    // Create a NEW WebMap instance (not shared with store)
    const webmap = new WebMap({
      portalItem: { id: webMapId }
    });

    // ENHANCED: Wait for WebMap to load with timeout
    console.log('[ReportMapService] Loading WebMap...');
    try {
      const loadPromise = webmap.load();
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('WebMap load timeout')), 20000)
      );

      await Promise.race([loadPromise, timeoutPromise]);
      console.log('[ReportMapService] ✅ WebMap loaded successfully');
    } catch (error) {
      console.error(`[ReportMapService] ❌ Failed to load WebMap:`, error);
      throw new Error(`Failed to load WebMap: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // Create a NEW MapView instance
    console.log('[ReportMapService] Creating MapView...');
    const view = new MapView({
      map: webmap,
      container: container as HTMLDivElement,
      center: options?.center || CONFIG.map.center,
      zoom: options?.zoom || CONFIG.map.zoom,
      constraints: {
        minZoom: options?.constraints?.minZoom || 6,
        maxZoom: options?.constraints?.maxZoom || 16,
        snapToZoom: false
      },
      padding: { top: 0 }
    });

    // Wait for view to load
    try {
      await view.when();
      console.log(`[ReportMapService] ✅ Map view created successfully for ${containerId}`);
    } catch (error) {
      console.error(`[ReportMapService] ❌ Failed to create MapView:`, error);
      throw new Error(`Failed to create MapView: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // Add optional widgets
    const widgets: any[] = [];

    if (options?.showLegend !== false) {
      const legend = new Legend({
        view: view
      });
      view.ui.add(legend, 'bottom-right');
      widgets.push(legend);
    }

    if (options?.showScaleBar !== false) {
      const scaleBar = new ScaleBar({
        view: view,
        unit: 'metric'
      });
      view.ui.add(scaleBar, 'bottom-left');
      widgets.push(scaleBar);
    }

    // Create cleanup function
    const cleanup = () => {
      console.log(`[ReportMap] Cleaning up map instance for ${containerId}`);

      // Remove widgets
      widgets.forEach(widget => {
        try {
          view.ui.remove(widget);
          if (widget.destroy) {
            widget.destroy();
          }
        } catch (err) {
          console.warn('[ReportMap] Error removing widget:', err);
        }
      });

      // Destroy view
      if (view && !view.destroyed) {
        try {
          view.container = null;
          view.destroy();
        } catch (err) {
          console.warn('[ReportMap] Error destroying view:', err);
        }
      }

      // Destroy webmap
      if (webmap && !webmap.destroyed) {
        try {
          webmap.destroy();
        } catch (err) {
          console.warn('[ReportMap] Error destroying webmap:', err);
        }
      }
    };

    return { view, webmap, cleanup };
  }

  /**
   * Check if a container already has a map view attached
   */
  static hasExistingView(containerId: string): boolean {
    const container = document.getElementById(containerId);
    return !!(container && (container as any).__esri_report_mapview);
  }

  /**
   * Clean up any existing map view in a container
   */
  static cleanupExistingView(containerId: string): void {
    const container = document.getElementById(containerId);
    if (container && (container as any).__esri_report_mapview) {
      const cleanup = (container as any).__esri_report_mapview_cleanup;
      if (cleanup) {
        cleanup();
      }
      delete (container as any).__esri_report_mapview;
      delete (container as any).__esri_report_mapview_cleanup;
    }
  }

  /**
   * Store view reference on container for future cleanup
   */
  static storeViewReference(containerId: string, view: MapView, cleanup: () => void): void {
    const container = document.getElementById(containerId);
    if (container) {
      (container as any).__esri_report_mapview = view;
      (container as any).__esri_report_mapview_cleanup = cleanup;
    }
  }
}

export default ReportMapService;
