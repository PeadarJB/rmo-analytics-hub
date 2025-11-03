// src/components/report/section1/NetworkMapSection.tsx
import React, { useEffect, useRef, useState } from 'react';
import { Card, Alert, Spin, Select, Space, theme } from 'antd';
import MapView from '@arcgis/core/views/MapView';
import WebMap from '@arcgis/core/WebMap';
import Legend from '@arcgis/core/widgets/Legend';
import ScaleBar from '@arcgis/core/widgets/ScaleBar';
import useAppStore from '@/store/useAppStore';
import { CONFIG } from '@/config/appConfig';

interface NetworkMapSectionProps {
  year?: number;
  height?: number;
}

const NetworkMapSection: React.FC<NetworkMapSectionProps> = ({
  year = 2025,
  height = 500
}) => {
  const { token } = theme.useToken();
  const { webmap, themeMode } = useAppStore();
  const mapRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<MapView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState(year);

  useEffect(() => {
    if (!mapRef.current || !webmap) return;

    const initializeMap = async () => {
      try {
        setLoading(true);
        setError(null);

        // Create map view
        const view = new MapView({
          map: webmap,
          container: mapRef.current!,
          center: CONFIG.map.center,
          zoom: CONFIG.map.zoom,
          constraints: {
            minZoom: 6,
            maxZoom: 16
          }
        });

        // Add Legend widget
        const legend = new Legend({
          view: view,
          container: document.createElement('div')
        });

        // Add ScaleBar widget
        const scaleBar = new ScaleBar({
          view: view,
          unit: 'metric'
        });
        view.ui.add(scaleBar, 'bottom-left');

        // Wait for view to be ready
        await view.when();

        viewRef.current = view;
        setLoading(false);
      } catch (err) {
        console.error('Error initializing map:', err);
        setError('Failed to initialize map');
        setLoading(false);
      }
    };

    initializeMap();

    // Cleanup
    return () => {
      if (viewRef.current) {
        viewRef.current.destroy();
        viewRef.current = null;
      }
    };
  }, [webmap]);

  // Update layer visibility when year changes
  useEffect(() => {
    if (!viewRef.current || !webmap) return;

    const updateLayers = async () => {
      try {
        // Find road layer
        const roadLayer = webmap.layers.find(
          layer => layer.title?.includes('RoadNetwork') === true
        );

        if (roadLayer) {
          // Update definition expression to show only selected year's data
          // @ts-ignore - FeatureLayer has definitionExpression
          roadLayer.definitionExpression = `HasData_${selectedYear} = 1`;
        }
      } catch (err) {
        console.error('Error updating layers:', err);
      }
    };

    updateLayers();
  }, [selectedYear, webmap]);

  const handleYearChange = (value: number) => {
    setSelectedYear(value);
  };

  if (error) {
    return (
      <Card
        title="Figure 1.1: Regional Road Network in Ireland"
        variant="borderless"
      >
        <Alert
          message="Error"
          description={error}
          type="error"
          showIcon
        />
      </Card>
    );
  }

  return (
    <Card
      title="Figure 1.1: Regional Road Network in Ireland"
      variant="borderless"
      extra={
        <Space>
          <span style={{ fontSize: 12, color: token.colorTextSecondary }}>
            Survey Year:
          </span>
          <Select
            value={selectedYear}
            onChange={handleYearChange}
            style={{ width: 100 }}
            size="small"
            options={[
              { label: '2011', value: 2011 },
              { label: '2018', value: 2018 },
              { label: '2025', value: 2025 }
            ]}
          />
        </Space>
      }
    >
      <div style={{ position: 'relative', height }}>
        {loading && (
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: token.colorBgContainer,
            zIndex: 1000
          }}>
            <Spin size="large" tip="Loading map..." />
          </div>
        )}
        <div
          ref={mapRef}
          style={{
            width: '100%',
            height: '100%',
            border: `1px solid ${token.colorBorder}`,
            borderRadius: token.borderRadius
          }}
        />
      </div>
      <div style={{
        marginTop: 16,
        fontSize: 12,
        color: token.colorTextSecondary
      }}>
        This map shows the full regional road network in Ireland, comprising over
        13,000 centreline kilometres surveyed across 31 Local Authorities. The roads
        are symbolized by condition rating, with colour indicating pavement quality.
      </div>
    </Card>
  );
};

export default NetworkMapSection;
