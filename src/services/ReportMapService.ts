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

    const container = document.getElementById(containerId) as HTMLDivElement;
    if (!container) {
      throw new Error(`Container element '${containerId}' not found`);
    }

    console.log(`[ReportMap] Creating independent map instance for ${containerId}`);

    // Create a NEW WebMap instance (not shared with store)
    const webmap = new WebMap({
      portalItem: { id: webMapId }
    });

    // Create a NEW MapView instance
    const view = new MapView({
      map: webmap,
      container: container,
      center: options?.center || CONFIG.map.center,
      zoom: options?.zoom || CONFIG.map.zoom,
      constraints: {
        minZoom: options?.constraints?.minZoom || 6,
        maxZoom: options?.constraints?.maxZoom || 16,
        snapToZoom: false
      },
      padding: { top: 0 }
    });

    // Wait for map to load
    try {
      await view.when();
      console.log(`[ReportMap] Map loaded successfully for ${containerId}`);
    } catch (error) {
      console.error(`[ReportMap] Failed to load map for ${containerId}:`, error);
      throw new Error(`Failed to load report map: ${error}`);
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
