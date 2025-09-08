// src/components/SimpleSwipePanel.tsx

import React, { useEffect, useState, useRef } from 'react';
import { Card, Select, Button, Space, Slider, Radio, Tag, message } from 'antd';
import { SwapOutlined, CloseOutlined } from '@ant-design/icons';
import Swipe from '@arcgis/core/widgets/Swipe';
import useAppStore from '@/store/useAppStore';
import { CONFIG, KPI_LABELS, type KPIKey } from '@/config/appConfig';
import { usePanelStyles } from '@/styles/styled';
import { theme } from 'antd';
import type FeatureLayer from '@arcgis/core/layers/FeatureLayer';

const SimpleSwipePanel: React.FC = () => {
  const {
    mapView,
    webmap,
    activeKpi,
    leftSwipeYear,
    rightSwipeYear,
    setSwipeYears,
    setShowSwipe,
    updateLALayerVisibility,
  } = useAppStore();

  const { styles } = usePanelStyles();
  const { token } = theme.useToken();
  
  const [leftYear, setLeftYear] = useState<number>(leftSwipeYear);
  const [rightYear, setRightYear] = useState<number>(rightSwipeYear);
  const [selectedKpi, setSelectedKpi] = useState<KPIKey>(activeKpi);
  const [swipeWidget, setSwipeWidget] = useState<Swipe | null>(null);
  const [isSwipeActive, setIsSwipeActive] = useState<boolean>(false);
  const [direction, setDirection] = useState<'horizontal' | 'vertical'>('horizontal');
  const [position, setPosition] = useState<number>(50);
  
  // Keep track of current swipe instance for cleanup
  const swipeRef = useRef<Swipe | null>(null);

  // Function to find LA polygon layer by title
  const findLALayer = (kpi: string, year: number): FeatureLayer | null => {
    if (!webmap) return null;
    
    // Construct layer title based on KPI and year
    // Format: "Average [KPI] [YEAR]"
    const kpiUpper = kpi.toUpperCase();
    const layerTitle = `Average ${kpiUpper === 'LPV3' ? 'LPV' : kpiUpper} ${year}`;
    
    const layer = webmap.allLayers.find((l: any) => 
      l.title === layerTitle && l.type === 'feature'
    ) as FeatureLayer;
    
    if (!layer) {
      console.warn(`LA layer not found: ${layerTitle}`);
    }
    
    return layer;
  };

  // Initialize or update swipe widget
  const startSwipe = () => {
    if (!mapView || !webmap) {
      message.error('Map is not ready. Please try again.');
      return;
    }

    // Clean up existing swipe if any
    stopSwipe();

    // Get the LA polygon layers for selected KPI and years
    const leftLayer = findLALayer(selectedKpi, leftYear);
    const rightLayer = findLALayer(selectedKpi, rightYear);

    if (!leftLayer || !rightLayer) {
      message.error(`Could not find LA layers for ${KPI_LABELS[selectedKpi]} comparison`);
      return;
    }

    try {
      // Make both layers visible
      leftLayer.visible = true;
      rightLayer.visible = true;
      
      // Hide other LA layers
      webmap.allLayers.forEach((layer: any) => {
        if (layer.title && layer.title.startsWith('Average ') && 
            layer !== leftLayer && layer !== rightLayer) {
          layer.visible = false;
        }
      });

      // Create swipe widget
      const swipe = new Swipe({
        view: mapView,
        leadingLayers: [leftLayer],
        trailingLayers: [rightLayer],
        direction: direction,
        position: position
      });

      mapView.ui.add(swipe);
      swipeRef.current = swipe;
      setSwipeWidget(swipe);
      setIsSwipeActive(true);
      
      // Update store with current swipe years
      setSwipeYears(leftYear, rightYear);
      
      message.success('Swipe comparison activated');
    } catch (error) {
      console.error('Failed to create swipe:', error);
      message.error('Failed to activate swipe comparison');
    }
  };

  // Stop and clean up swipe widget
  const stopSwipe = () => {
    if (swipeRef.current && mapView) {
      // Hide the layers that were being compared
      if (swipeRef.current.leadingLayers) {
        swipeRef.current.leadingLayers.forEach((layer: any) => {
          if (layer) layer.visible = false;
        });
      }
      if (swipeRef.current.trailingLayers) {
        swipeRef.current.trailingLayers.forEach((layer: any) => {
          if (layer) layer.visible = false;
        });
      }
      
      mapView.ui.remove(swipeRef.current);
      swipeRef.current.destroy();
      swipeRef.current = null;
      setSwipeWidget(null);
      setIsSwipeActive(false);
      
      message.info('Swipe comparison deactivated');
    }
  };

  // Update position when slider changes
  const updatePosition = (value: number) => {
    setPosition(value);
    if (swipeWidget) {
      swipeWidget.position = value;
    }
  };

  // Update direction
  const updateDirection = (value: 'horizontal' | 'vertical') => {
    setDirection(value);
    if (swipeWidget) {
      swipeWidget.direction = value;
    }
  };

  // Restart swipe when KPI changes while active
  useEffect(() => {
    if (isSwipeActive && selectedKpi !== activeKpi) {
      setSelectedKpi(activeKpi);
      startSwipe();
    }
  }, [activeKpi]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopSwipe();
    };
  }, []);

  // Close panel handler
  const handleClose = () => {
    stopSwipe();
    setShowSwipe(false);
  };

  const yearOptions = CONFIG.filters.year.options?.map(o => ({ 
    label: o.label, 
    value: o.value 
  })) ?? [];

  return (
    <Card
      size="small"
      title={
        <Space>
          <SwapOutlined />
          <span>LA Condition Comparison - {KPI_LABELS[selectedKpi]}</span>
          {isSwipeActive && <Tag color="green">Active</Tag>}
        </Space>
      }
      extra={
        <Button 
          type="text" 
          icon={<CloseOutlined />} 
          onClick={handleClose}
          size="small"
        />
      }
      className={styles.swipePanel}
      style={{ 
        boxShadow: token.boxShadow, 
        borderRadius: token.borderRadius 
      }}
    >
      <Space direction="vertical" style={{ width: '100%' }}>
        {/* KPI Selection */}
        <div>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Condition Metric</div>
          <Select
            style={{ width: '100%' }}
            value={selectedKpi}
            onChange={(value) => setSelectedKpi(value)}
            disabled={isSwipeActive}
            options={Object.keys(KPI_LABELS).map(k => ({ 
              label: KPI_LABELS[k as KPIKey], 
              value: k 
            }))}
          />
        </div>

        {/* Year Selection */}
        <div>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Left/Top Year</div>
          <Select
            style={{ width: '100%' }}
            options={yearOptions}
            value={leftYear}
            onChange={setLeftYear}
            disabled={isSwipeActive}
          />
        </div>
        
        <div>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Right/Bottom Year</div>
          <Select
            style={{ width: '100%' }}
            options={yearOptions}
            value={rightYear}
            onChange={setRightYear}
            disabled={isSwipeActive}
          />
        </div>

        {/* Swipe Direction */}
        <div>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Swipe Direction</div>
          <Radio.Group 
            value={direction} 
            onChange={(e) => updateDirection(e.target.value)}
            disabled={!isSwipeActive}
          >
            <Radio.Button value="horizontal">Horizontal</Radio.Button>
            <Radio.Button value="vertical">Vertical</Radio.Button>
          </Radio.Group>
        </div>

        {/* Position Slider - only show when active */}
        {isSwipeActive && (
          <div>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>
              Position: {position}%
            </div>
            <Slider 
              value={position} 
              onChange={updatePosition}
              marks={{
                0: '0%',
                50: '50%',
                100: '100%'
              }}
            />
          </div>
        )}

        {/* Activation Button */}
        <Button
          type={isSwipeActive ? 'default' : 'primary'}
          icon={isSwipeActive ? <CloseOutlined /> : <SwapOutlined />}
          onClick={isSwipeActive ? stopSwipe : startSwipe}
          block
          danger={isSwipeActive}
        >
          {isSwipeActive ? 'Stop Comparison' : 'Start Comparison'}
        </Button>

        {/* Info text */}
        <div style={{ fontSize: 12, opacity: 0.7, marginTop: 8 }}>
          <strong>Tip:</strong> Drag the swipe handle to compare {KPI_LABELS[selectedKpi]} averages 
          by Local Authority between {leftYear} and {rightYear}.
        </div>
      </Space>
    </Card>
  );
};

export default SimpleSwipePanel;