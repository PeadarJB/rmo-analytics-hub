import React, { useEffect, useState } from 'react';
import { Card, Select, Button, Space } from 'antd';
import Swipe from '@arcgis/core/widgets/Swipe';
import useAppStore from '@/store/useAppStore';
import { CONFIG } from '@/config/appConfig';

const SimpleSwipePanel: React.FC = () => {
  const { mapView, roadLayer, roadLayerSwipe, setShowSwipe } = useAppStore();
  const [leftYear, setLeftYear] = useState<number>(2025);
  const [rightYear, setRightYear] = useState<number>(2018);
  const [swipe, setSwipe] = useState<Swipe | null>(null);

  useEffect(() => {
    if (!mapView || !roadLayer || !roadLayerSwipe) return;

    const widget = new Swipe({
      view: mapView,
      leadingLayers: [roadLayer],
      trailingLayers: [roadLayerSwipe],
      position: 50
    });
    mapView.ui.add(widget);
    setSwipe(widget);

    return () => {
      mapView.ui.remove(widget);
      widget.destroy();
      setSwipe(null);
    };
  }, [mapView, roadLayer, roadLayerSwipe]);

  useEffect(() => {
    if (roadLayer) (roadLayer as any).definitionExpression = `${CONFIG.fields.year} = ${leftYear}`;
  }, [leftYear, roadLayer]);

  useEffect(() => {
    if (roadLayerSwipe) (roadLayerSwipe as any).definitionExpression = `${CONFIG.fields.year} = ${rightYear}`;
  }, [rightYear, roadLayerSwipe]);

  const yearOptions = CONFIG.filters.year.options?.map(o => ({ label: o.label, value: o.value })) ?? [];

  return (
    <Card size="small" title="Swipe Compare" actions={[
      <Button key="close" onClick={() => setShowSwipe(false)}>Close</Button>
    ]}>
      <Space direction="vertical" style={{ width: '100%' }}>
        <div>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Left Year</div>
          <Select style={{ width: '100%' }} options={yearOptions} value={leftYear} onChange={setLeftYear} />
        </div>
        <div>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Right Year</div>
          <Select style={{ width: '100%' }} options={yearOptions} value={rightYear} onChange={setRightYear} />
        </div>
        <div style={{ fontSize: 12, opacity: 0.7 }}>
          Tip: This uses two copies of the road layer and sets a definitionExpression on each for the chosen year.
          Replace field names and layer titles in <code>appConfig.ts</code> once you have real data.
        </div>
      </Space>
    </Card>
  );
};

export default SimpleSwipePanel;
