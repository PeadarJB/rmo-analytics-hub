import React, { useEffect, useState } from 'react';
import { Card, Select, Button, Space, message } from 'antd';
import Swipe from '@arcgis/core/widgets/Swipe';
import useAppStore from '@/store/useAppStore';
import { CONFIG, KPI_LABELS } from '@/config/appConfig';
import RendererService from '@/services/RendererService';

const SimpleSwipePanel: React.FC = () => {
  const { mapView, roadLayer, roadLayerSwipe, setShowSwipe, activeKpi } = useAppStore();
  const [leftYear, setLeftYear] = useState<number>(2025);
  const [rightYear, setRightYear] = useState<number>(2018);
  const [swipe, setSwipe] = useState<Swipe | null>(null);

  // Initialize swipe widget
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

  // Update left layer renderer when year or KPI changes
  useEffect(() => {
    if (!roadLayer) return;
    
    try {
      const renderer = RendererService.createKPIRenderer(activeKpi, leftYear);
      (roadLayer as any).renderer = renderer;
      message.success(`Left side: ${KPI_LABELS[activeKpi]} for ${leftYear}`);
    } catch (error) {
      console.error('Error updating left layer renderer:', error);
    }
  }, [leftYear, activeKpi, roadLayer]);

  // Update right layer renderer when year or KPI changes
  useEffect(() => {
    if (!roadLayerSwipe) return;
    
    try {
      const renderer = RendererService.createKPIRenderer(activeKpi, rightYear);
      (roadLayerSwipe as any).renderer = renderer;
      message.success(`Right side: ${KPI_LABELS[activeKpi]} for ${rightYear}`);
    } catch (error) {
      console.error('Error updating right layer renderer:', error);
    }
  }, [rightYear, activeKpi, roadLayerSwipe]);

  const yearOptions = CONFIG.filters.year.options?.map(o => ({ 
    label: o.label, 
    value: o.value 
  })) ?? [];

  return (
    <Card 
      size="small" 
      title={`Swipe Compare - ${KPI_LABELS[activeKpi]}`}
      actions={[
        <Button key="close" onClick={() => setShowSwipe(false)}>Close</Button>
      ]}
    >
      <Space direction="vertical" style={{ width: '100%' }}>
        <div>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Left Year</div>
          <Select 
            style={{ width: '100%' }} 
            options={yearOptions} 
            value={leftYear} 
            onChange={setLeftYear} 
          />
        </div>
        <div>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Right Year</div>
          <Select 
            style={{ width: '100%' }} 
            options={yearOptions} 
            value={rightYear} 
            onChange={setRightYear} 
          />
        </div>
        <div style={{ fontSize: 12, opacity: 0.7, marginTop: 8 }}>
          <strong>Tip:</strong> Drag the swipe handle to compare {KPI_LABELS[activeKpi]} condition between {leftYear} and {rightYear}.
          Change the KPI using the selector in the header to compare different metrics.
        </div>
        <div style={{ fontSize: 12, opacity: 0.7 }}>
          <strong>Color Legend:</strong><br/>
          🟢 Green = Good condition<br/>
          🟡 Yellow = Fair condition<br/>
          🔴 Red = Poor condition
        </div>
      </Space>
    </Card>
  );
};

export default SimpleSwipePanel;