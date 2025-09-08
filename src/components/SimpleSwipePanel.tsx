import React, { useEffect, useState } from 'react';
import { Card, Select, Button, Space, message, theme } from 'antd';
import Swipe from '@arcgis/core/widgets/Swipe';
import useAppStore from '@/store/useAppStore';
import { CONFIG, KPI_LABELS } from '@/config/appConfig';

const SimpleSwipePanel: React.FC = () => {
  const {
    mapView,
    laPolygonLayers,
    activeKpi,
    leftSwipeYear,
    rightSwipeYear,
    setSwipeYears,
    setShowSwipe,
    updateLALayerVisibility,
  } = useAppStore();

  const { token } = theme.useToken();

  const [leftYear, setLeftYear] = useState<number>(leftSwipeYear);
  const [rightYear, setRightYear] = useState<number>(rightSwipeYear);
  const [swipe, setSwipe] = useState<Swipe | null>(null);

  // Initialize / update swipe widget when inputs change
  useEffect(() => {
    if (!mapView || !laPolygonLayers) return;

    // Ensure only the two selected LA layers are visible based on KPI + years
    updateLALayerVisibility();

    const leftLayerName = `LA_${activeKpi.toUpperCase()}_${leftYear}`;
    const rightLayerName = `LA_${activeKpi.toUpperCase()}_${rightYear}`;

    const leftLayer = laPolygonLayers.get(leftLayerName);
    const rightLayer = laPolygonLayers.get(rightLayerName);

    if (!leftLayer || !rightLayer) {
      message.warning(`LA layers for ${activeKpi} comparison not found`);
      return;
    }

    const widget = new Swipe({
      view: mapView,
      leadingLayers: [leftLayer],
      trailingLayers: [rightLayer],
      position: 50,
    });

    mapView.ui.add(widget);
    setSwipe(widget);

    return () => {
      mapView.ui.remove(widget);
      widget.destroy();
      setSwipe(null);
    };
  }, [mapView, laPolygonLayers, activeKpi, leftYear, rightYear, updateLALayerVisibility]);

  const handleLeftYearChange = (year: number) => {
    setLeftYear(year);
    setSwipeYears(year, rightYear);
  };

  const handleRightYearChange = (year: number) => {
    setRightYear(year);
    setSwipeYears(leftYear, year);
  };

  const yearOptions =
    CONFIG.filters.year.options?.map(o => ({ label: o.label, value: o.value })) ?? [];

  return (
    <Card
      size="small"
      title={`Swipe Compare - ${KPI_LABELS[activeKpi]}`}
      actions={[
        <Button key="close" onClick={() => setShowSwipe(false)}>Close</Button>
      ]}
      style={{ boxShadow: token.boxShadow, borderRadius: token.borderRadius }}
    >
      <Space direction="vertical" style={{ width: '100%' }}>
        <div>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Left Year</div>
          <Select
            style={{ width: '100%' }}
            options={yearOptions}
            value={leftYear}
            onChange={handleLeftYearChange}
          />
        </div>
        <div>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Right Year</div>
          <Select
            style={{ width: '100%' }}
            options={yearOptions}
            value={rightYear}
            onChange={handleRightYearChange}
          />
        </div>
        <div style={{ fontSize: 12, opacity: 0.7, marginTop: 8 }}>
          <strong>Tip:</strong> Drag the swipe handle to compare {KPI_LABELS[activeKpi]} condition
          between {leftYear} and {rightYear}. Change the KPI using the selector in the header to
          compare different metrics.
        </div>
        <div style={{ fontSize: 12, opacity: 0.7 }}>
          <strong>Color Legend:</strong><br />
          🟢 Green = Good condition<br />
          🟡 Yellow = Fair condition<br />
          🔴 Red = Poor condition
        </div>
      </Space>
    </Card>
  );
};

export default SimpleSwipePanel;
