// src/components/report/section1/NetworkMapSection.tsx
import React, { useEffect, useRef, useState } from 'react';
import { Card, Alert, Spin, theme } from 'antd';
import MapView from '@arcgis/core/views/MapView';
import WebMap from '@arcgis/core/WebMap';
import ReportMapService from '@/services/ReportMapService';
import { CONFIG } from '@/config/appConfig';

interface NetworkMapSectionProps {
  year?: number;
  height?: number;
}

/**
 * Network Map Section for Section 1 of the Regional Report
 *
 * IMPORTANT: This component creates its OWN independent WebMap instance.
 * It does NOT use the shared webmap from useAppStore to prevent conflicts
 * and "map already destroyed" errors when navigating between pages.
 *
 * Architecture:
 * - Overview Dashboard: Uses store's webmap (dynamic symbology)
 * - Section 1 Report: Uses independent webmap (static symbology) ← THIS COMPONENT
 */
const NetworkMapSection: React.FC<NetworkMapSectionProps> = ({
  year = 2025,
  height = 500
}) => {
  const { token } = theme.useToken();
  const mapRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<MapView | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mapContainerId = 'report-network-map-section1';

  useEffect(() => {
    // Guard: Prevent multiple initializations
    if (!mapRef.current) {
      console.log('[NetworkMapSection] Map container ref not ready');
      return;
    }

    if (viewRef.current && !viewRef.current.destroyed) {
      console.log('[NetworkMapSection] Map already initialized');
      return;
    }

    let mounted = true;

    const initializeMap = async () => {
      try {
        setLoading(true);
        setError(null);

        console.log('[NetworkMapSection] Starting map initialization...');
        console.log('[NetworkMapSection] Using WebMap ID:', CONFIG.webMapId);
        console.log('[NetworkMapSection] Container ID:', mapContainerId);

        // ENHANCED: Verify container exists in DOM
        const container = document.getElementById(mapContainerId);
        if (!container) {
          throw new Error(`Container element '${mapContainerId}' not found in DOM`);
        }

        // Clean up any existing map in this container
        ReportMapService.cleanupExistingView(mapContainerId);

        // ENHANCED: Add timeout to prevent indefinite hanging
        const initPromise = ReportMapService.createReportMap(
          mapContainerId,
          CONFIG.webMapId,
          {
            center: CONFIG.map.center,
            zoom: CONFIG.map.zoom,
            showLegend: true,
            showScaleBar: true,
            constraints: {
              minZoom: 6,
              maxZoom: 16
            }
          }
        );

        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Map initialization timeout after 30 seconds')), 30000)
        );

        const { view, webmap, cleanup } = await Promise.race([
          initPromise,
          timeoutPromise
        ]) as any;

        // Only proceed if component is still mounted
        if (!mounted) {
          console.log('[NetworkMapSection] Component unmounted during init, cleaning up...');
          cleanup();
          return;
        }

        // Store references
        viewRef.current = view;
        cleanupRef.current = cleanup;

        console.log('[NetworkMapSection] Map view created successfully');
        console.log('[NetworkMapSection] WebMap layers count:', webmap.layers.length);

        // ENHANCED: Apply simple outline renderer with better error handling
        try {
          const roadLayer = webmap.layers.find(
            l => l.title === CONFIG.roadNetworkLayerTitle
          ) as __esri.FeatureLayer;

          if (!roadLayer) {
            console.warn('[NetworkMapSection] Road layer not found. Available layers:',
              webmap.layers.map(l => l.title).join(', '));
            throw new Error(`Road layer "${CONFIG.roadNetworkLayerTitle}" not found in WebMap`);
          }

          console.log('[NetworkMapSection] Applying simple outline renderer...');

          // Create simple outline renderer
          const simpleRenderer = {
            type: 'simple',
            symbol: {
              type: 'simple-line',
              color: [255, 170, 0, 0.8], // Orange color matching report
              width: 1.5,
              style: 'solid'
            }
          };

          roadLayer.renderer = simpleRenderer as any;
          await roadLayer.when();
          console.log('[NetworkMapSection] Simple renderer applied successfully');
        } catch (rendererError) {
          console.error('[NetworkMapSection] Renderer application failed:', rendererError);
          // Continue anyway - map will show with default symbology
        }

        ReportMapService.storeViewReference(mapContainerId, view, cleanup);

        console.log('[NetworkMapSection] ✅ Map initialized successfully');
        setLoading(false);

      } catch (err) {
        console.error('[NetworkMapSection] ❌ Error initializing map:', err);
        if (mounted) {
          const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
          setError(`Failed to initialize map: ${errorMessage}`);
          setLoading(false);
        }
      }
    };

    initializeMap();

    // Cleanup function - CRITICAL for preventing "map already destroyed" errors
    return () => {
      mounted = false;
      console.log('[NetworkMapSection] Component unmounting, cleaning up map...');

      if (cleanupRef.current) {
        cleanupRef.current();
        cleanupRef.current = null;
      }

      viewRef.current = null;
      ReportMapService.cleanupExistingView(mapContainerId);
    };
  }, []); // Empty deps - only initialize once

  // Loading state
  if (loading) {
    return (
      <Card
        title={`Figure 1.1: Regional Road Network in Ireland (${year})`}
        variant="borderless"
        style={{
          marginBottom: 24,
          boxShadow: token.boxShadow
        }}
      >
        <div style={{
          height,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: token.colorBgContainer
        }}>
          <Spin size="large" tip="Loading map..." />
        </div>
      </Card>
    );
  }

  // Error state
  if (error) {
    return (
      <Card
        title={`Figure 1.1: Regional Road Network in Ireland (${year})`}
        variant="borderless"
        style={{
          marginBottom: 24,
          boxShadow: token.boxShadow
        }}
      >
        <Alert
          message="Map Loading Error"
          description={error}
          type="error"
          showIcon
        />
      </Card>
    );
  }

  // Map display
  return (
    <Card
      title={`Figure 1.1: Regional Road Network in Ireland (${year})`}
      variant="borderless"
      style={{
        marginBottom: 24,
        boxShadow: token.boxShadow
      }}
    >
      <div
        id={mapContainerId}
        ref={mapRef}
        style={{
          height,
          width: '100%',
          borderRadius: token.borderRadius,
          overflow: 'hidden'
        }}
      />
      <div style={{
        marginTop: 16,
        fontSize: 12,
        color: token.colorTextSecondary,
        lineHeight: 1.6
      }}>
        Figure 1.1 shows the Regional road network with over 13,000 centreline
        kilometres of roadway across Ireland's 31 Local Authorities. The roads
        are symbolized by condition rating, with colour indicating pavement quality.
      </div>
    </Card>
  );
};

export default NetworkMapSection;
