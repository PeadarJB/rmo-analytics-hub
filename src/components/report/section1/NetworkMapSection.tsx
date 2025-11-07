// src/components/report/section1/NetworkMapSection.tsx
import React, { useEffect, useRef, useState } from 'react';
import { Card, Alert, Spin, theme } from 'antd';
import MapView from '@arcgis/core/views/MapView';
import WebMap from '@arcgis/core/WebMap';
import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import Legend from '@arcgis/core/widgets/Legend';
import ScaleBar from '@arcgis/core/widgets/ScaleBar';
import useAppStore from '@/store/useAppStore';
import { CONFIG } from '@/config/appConfig';

interface NetworkMapSectionProps {
  year?: number;
  height?: number;
}

/**
 * Network Map Section for Section 1 of the Regional Report
 *
 * ARCHITECTURE CHANGE (Nov 7, 2025):
 * This component now uses the directly-loaded layers from the store (via initializeLayersDirectly)
 * instead of creating its own WebMap instance. This ensures consistency with the Report page's
 * direct loading strategy and prevents conflicts.
 *
 * - Overview Dashboard: Uses store's webmap (dynamic symbology)
 * - Report Pages: Use directly-loaded layers (static symbology) ← THIS COMPONENT
 */
const NetworkMapSection: React.FC<NetworkMapSectionProps> = ({
  year = 2025,
  height = 500
}) => {
  const { token } = theme.useToken();
  const mapRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<MapView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mapContainerId = 'report-network-map-section1';
  
  // Get the directly-loaded layers from store
  const { roadLayer, laLayer } = useAppStore();

  useEffect(() => {
    // Guard: Wait for layers to be loaded
    if (!roadLayer) {
      console.log('[NetworkMapSection] Waiting for layers to load...');
      return;
    }

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

        console.log('[NetworkMapSection] Starting map initialization with directly-loaded layers...');
        console.log('[NetworkMapSection] Container ID:', mapContainerId);

        // Verify container exists in DOM
        const container = document.getElementById(mapContainerId);
        if (!container) {
          throw new Error(`Container element '${mapContainerId}' not found in DOM`);
        }

        // Create a simple WebMap to hold our layers
        const webmap = new WebMap({
          basemap: 'gray-vector'
        });

        // Clone the road layer for this map view (to avoid sharing layer instances)
        const roadLayerClone = roadLayer.clone() as FeatureLayer;
        
        // Apply simple outline renderer for Figure 1.1
        console.log('[NetworkMapSection] Applying simple outline renderer...');
        roadLayerClone.renderer = {
          type: 'simple',
          symbol: {
            type: 'simple-line',
            color: [255, 170, 0, 0.8], // Orange color matching 2018 report
            width: 1.5,
            style: 'solid'
          }
        } as any;

        // Add the cloned road layer to the webmap
        webmap.add(roadLayerClone);

        // Optionally add LA layer if available
        if (laLayer) {
          const laLayerClone = laLayer.clone();
          laLayerClone.visible = false; // Hidden by default
          laLayerClone.opacity = 0.3;
          webmap.add(laLayerClone);
        }

        // Create map view
        const view = new MapView({
          container: mapContainerId,
          map: webmap,
          center: CONFIG.map.center,
          zoom: CONFIG.map.zoom,
          constraints: {
            minZoom: 6,
            maxZoom: 16,
            snapToZoom: false
          }
        });

        // Wait for view to be ready
        await view.when();

        // Only proceed if component is still mounted
        if (!mounted) {
          console.log('[NetworkMapSection] Component unmounted during init, cleaning up...');
          view.destroy();
          return;
        }

        // Add widgets
        const legend = new Legend({
          view: view,
          container: document.createElement('div')
        });

        const scaleBar = new ScaleBar({
          view: view,
          unit: 'metric'
        });

        view.ui.add(legend, 'bottom-left');
        view.ui.add(scaleBar, 'bottom-right');

        // Store reference
        viewRef.current = view;

        console.log('[NetworkMapSection] ✅ Map initialized successfully with directly-loaded layers');
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

    // Cleanup function
    return () => {
      mounted = false;
      console.log('[NetworkMapSection] Component unmounting, cleaning up map...');

      if (viewRef.current && !viewRef.current.destroyed) {
        viewRef.current.destroy();
        viewRef.current = null;
      }
    };
  }, [roadLayer, laLayer]); // Re-run when layers become available

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