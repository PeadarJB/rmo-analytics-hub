import React, { useEffect, useState } from 'react';
import { Card, Select, Button, Space, message, theme } from 'antd';
import Swipe from '@arcgis/core/widgets/Swipe';
import useAppStore from '@/store/useAppStore';
import { CONFIG, KPI_LABELS } from '@/config/appConfig';
import RendererService from '@/services/RendererService';
import type { KPIKey } from '@/config/appConfig';

const SimpleSwipePanel: React.FC = () => {
  const { mapView, roadLayer, roadLayerSwipe, setShowSwipe, activeKpi } = useAppStore();
  const { token } = theme.useToken();
  
  // Use a default for the right year based on the available years, prioritizing the second-latest
  const defaultRightYear = CONFIG.filters.year.options?.[1]?.value || 2018;
  const [leftYear, setLeftYear] = useState<number>(CONFIG.defaultYears[0]);
  const [rightYear, setRightYear] = useState<number>(defaultRightYear);
  const [swipe, setSwipe] = useState<Swipe | null>(null);

  // Initialize swipe widget and layers
  useEffect(() => {
    // Guards to ensure map layers are loaded before proceeding
    if (!mapView || !roadLayer || !roadLayerSwipe) {
      if (mapView) {
        // If the layers aren't ready, display a warning
        message.warning('Road layers for swipe comparison are still loading.');
      }
      return;
    }

    // Set the initial renderers for both layers
    try {
      (roadLayer as any).renderer = RendererService.createKPIRenderer(activeKpi, leftYear);
      (roadLayerSwipe as any).renderer = RendererService.createKPIRenderer(activeKpi, rightYear);
    } catch (error) {
      console.error('Error applying initial renderers to swipe layers:', error);
      message.error('Failed to initialize swipe panel renderers.');
      return;
    }

    // Create and add the swipe widget
    const widget = new Swipe({
      view: mapView,
      leadingLayers: [roadLayer],
      trailingLayers: [roadLayerSwipe],
      position: 50
    });
    
    mapView.ui.add(widget);
    setSwipe(widget);

    // Cleanup function to remove the widget on component unmount
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
      message.success(`Left side: ${KPI_LABELS[activeKpi]} for ${leftYear}`, 2);
    } catch (error) {
      console.error('Error updating left layer renderer:', error);
      message.error('Failed to update left layer visualization.');
    }
  }, [leftYear, activeKpi, roadLayer]);

  // Update right layer renderer when year or KPI changes
  useEffect(() => {
    if (!roadLayerSwipe) return;
    
    try {
      const renderer = RendererService.createKPIRenderer(activeKpi, rightYear);
      (roadLayerSwipe as any).renderer = renderer;
      message.success(`Right side: ${KPI_LABELS[activeKpi]} for ${rightYear}`, 2);
    } catch (error) {
      console.error('Error updating right layer renderer:', error);
      message.error('Failed to update right layer visualization.');
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
      style={{
        boxShadow: token.boxShadow,
        borderRadius: token.borderRadius
      }}
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
