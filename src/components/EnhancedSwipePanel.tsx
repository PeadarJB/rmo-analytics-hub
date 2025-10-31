import React, { useState, useEffect, useCallback, FC } from 'react';
import { Card, Select, Button, Space, Radio, Divider, Typography, message } from 'antd';
import { SwapOutlined, CloseOutlined } from '@ant-design/icons';
import useAppStore from '@/store/useAppStore';
import type { KPIKey } from '@/config/kpiConfig';
import type { LAMetricType } from '@/config/appConfig';
import type Swipe from '@arcgis/core/widgets/Swipe';
import type FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import { usePanelStyles } from '@/styles/styled';

const { Text } = Typography;

const YEAR_OPTIONS = [
  { label: '2011', value: 2011 },
  { label: '2018', value: 2018 },
  { label: '2025', value: 2025 }
];

const EnhancedSwipePanel: FC = () => {
  const { styles } = usePanelStyles();
  const {
    mapView,
    activeKpi,
    laLayerCache,
    leftSwipeYear,
    rightSwipeYear,
    setSwipeYears,
    isSwipeActive,
    laMetricType,
    setLAMetricType,
    enterSwipeMode,
    exitSwipeMode,
    setShowSwipe,
  } = useAppStore();

  const [swipeWidget, setSwipeWidget] = useState<Swipe | null>(null);
  const [direction, setDirection] = useState<'horizontal' | 'vertical'>('horizontal');

  /**
   * Helper function to find a layer from the cache
   * Key format: e.g., "iri_2025_average"
   */
  const findLayer = useCallback((kpi: KPIKey, year: number, metric: LAMetricType): FeatureLayer | null => {
    if (!laLayerCache) return null;
    const key = `${kpi.toLowerCase()}_${year}_${metric}`;
    const layer = laLayerCache.get(key);
    
    if (layer) {
      console.log(`[Swipe] Found layer: ${key}`);
      return layer;
    }
    
    console.warn(`[Swipe] Layer not found in cache: ${key}`);
    return null;
  }, [laLayerCache]);

  /**
   * Deactivates and destroys the swipe widget
   */
  const deactivateSwipe = useCallback(() => {
    if (swipeWidget) {
      // Hide layers and reset opacity to default
      swipeWidget.leadingLayers.forEach(layer => {
        if (layer) {
          layer.visible = false;
          layer.opacity = 0.7; // Reset to default
        }
      });
      swipeWidget.trailingLayers.forEach(layer => {
        if (layer) {
          layer.visible = false;
          layer.opacity = 0.7; // Reset to default
        }
      });

      mapView?.ui.remove(swipeWidget);
      swipeWidget.destroy();
      setSwipeWidget(null);
    }
    exitSwipeMode(); // Restores road network
    message.info('Compare mode deactivated');
  }, [swipeWidget, mapView, exitSwipeMode]);

  /**
   * Activates the swipe widget with current settings
   */
  const activateSwipe = useCallback(async () => {
    if (!mapView) {
      message.error('Map not initialized');
      return;
    }
    if (leftSwipeYear === rightSwipeYear) {
      message.warning('Please select different years to compare');
      return;
    }

    // Dynamically import the Swipe widget
    try {
      const { default: Swipe } = await import('@arcgis/core/widgets/Swipe');
      
      const leftLayer = findLayer(activeKpi, leftSwipeYear, laMetricType);
      const rightLayer = findLayer(activeKpi, rightSwipeYear, laMetricType);
      
      if (!leftLayer || !rightLayer) {
        message.error(`Required LA layers for ${laMetricType} not found.`);
        return;
      }
      
      // Store calls now handle hiding road network & setting state
      enterSwipeMode(); 
      
      // Hide all LA layers first
      laLayerCache.forEach(layer => layer.visible = false);
      
      // Set opacity to 1.0 (fully opaque) as per requirements [cite: RMO_SPRINT_ROADMAP.md]
      leftLayer.visible = true;
      leftLayer.opacity = 1.0;
      rightLayer.visible = true;
      rightLayer.opacity = 1.0;
      
      const swipe = new Swipe({
        view: mapView,
        leadingLayers: [leftLayer],
        trailingLayers: [rightLayer],
        direction: direction,
        position: 50,
        id: 'rmo-swipe-widget' // Set ID for store to find
      });
      
      mapView.ui.add(swipe);
      setSwipeWidget(swipe);
      message.success('Compare mode activated');

    } catch (error) {
      console.error('Failed to create swipe:', error);
      message.error('Failed to activate comparison');
      exitSwipeMode();
    }
  }, [
    mapView, 
    activeKpi, 
    leftSwipeYear, 
    rightSwipeYear, 
    laMetricType, 
    direction, 
    laLayerCache, 
    findLayer, 
    enterSwipeMode, 
    exitSwipeMode
  ]);

  // Effect to clean up widget on unmount
  useEffect(() => {
    return () => {
      if (swipeWidget) {
        deactivateSwipe();
      }
    };
  }, [swipeWidget, deactivateSwipe]);

  // Effect to update swipe widget layers if settings change while active
  useEffect(() => {
    if (!isSwipeActive || !swipeWidget) return;

    const leftLayer = findLayer(activeKpi, leftSwipeYear, laMetricType);
    const rightLayer = findLayer(activeKpi, rightSwipeYear, laMetricType);

    if (leftLayer && rightLayer) {
      // Hide all layers
      laLayerCache.forEach(layer => layer.visible = false);
      
      // Update widget layers
      swipeWidget.leadingLayers.removeAll();
      swipeWidget.trailingLayers.removeAll();
      swipeWidget.leadingLayers.add(leftLayer);
      swipeWidget.trailingLayers.add(rightLayer);
      
      // Ensure visibility and opacity
      leftLayer.visible = true;
      leftLayer.opacity = 1.0;
      rightLayer.visible = true;
      rightLayer.opacity = 1.0;
    }
  }, [isSwipeActive, swipeWidget, activeKpi, leftSwipeYear, rightSwipeYear, laMetricType, findLayer, laLayerCache]);

  // Effect to update swipe widget direction if it changes
  useEffect(() => {
    if (swipeWidget) {
      swipeWidget.direction = direction;
    }
  }, [swipeWidget, direction]);

  return (
    <div className={styles.filterPanel}>
      <Card
        title={
          <Space>
            <SwapOutlined />
            <span>Compare Survey Years</span>
          </Space>
        }
        size="small"
        extra={
          <Button
            type="text"
            icon={<CloseOutlined />}
            onClick={() => setShowSwipe(false)}
            size="small"
            aria-label="Close compare panel"
          />
        }
      >
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          {/* Year Selectors */}
          <div>
            <Text strong>Left/Top Year:</Text>
            <Select
              value={leftSwipeYear}
              onChange={(year) => setSwipeYears(year, rightSwipeYear)}
              style={{ width: '100%', marginTop: 8 }}
              options={YEAR_OPTIONS}
              disabled={isSwipeActive}
            />
          </div>
          
          <div>
            <Text strong>Right/Bottom Year:</Text>
            <Select
              value={rightSwipeYear}
              onChange={(year) => setSwipeYears(leftSwipeYear, year)}
              style={{ width: '100%', marginTop: 8 }}
              options={YEAR_OPTIONS}
              disabled={isSwipeActive}
            />
          </div>
          
          <Divider style={{ margin: '8px 0' }} />
          
          {/* Visualization Mode (from LALayerControl) [cite: RMO_SPRINT_ROADMAP.md] */}
          <div>
            <Text strong>Visualization Mode:</Text>
            <Radio.Group 
              value={laMetricType}
              onChange={(e) => setLAMetricType(e.target.value)}
              style={{ marginTop: 8, width: '100%' }}
            >
              <Space direction="vertical" style={{ width: '100%' }}>
                <Radio value="average">
                  <Space direction="vertical" size={0}>
                    <Text>Average Values</Text>
                    <Text type="secondary" style={{ fontSize: '12px' }}>
                      County average KPI values
                    </Text>
                  </Space>
                </Radio>
                <Radio value="fairOrBetter">
                  <Space direction="vertical" size={0}>
                    <Text>Fair or Better %</Text>
                    <Text type="secondary" style={{ fontSize: '12px' }}>
                      % of roads in acceptable condition
                    </Text>
                  </Space>
                </Radio>
              </Space>
            </Radio.Group>
          </div>
          
          <Divider style={{ margin: '8px 0' }} />
          
          {/* Swipe Direction */}
          <div>
            <Text strong>Swipe Direction:</Text>
            <Select
              value={direction}
              onChange={setDirection}
              style={{ width: '100%', marginTop: 8 }}
              options={[
                { label: 'Horizontal (Left/Right)', value: 'horizontal' },
                { label: 'Vertical (Top/Bottom)', value: 'vertical' }
              ]}
            />
          </div>
          
          {/* Action Buttons */}
          {!isSwipeActive ? (
            <Button 
              type="primary" 
              block 
              onClick={activateSwipe}
              disabled={leftSwipeYear === rightSwipeYear}
              icon={<SwapOutlined />}
            >
              Start Comparison
            </Button>
          ) : (
            <Button 
              danger 
              block 
              onClick={deactivateSwipe}
              icon={<CloseOutlined />}
            >
              Stop Comparison
            </Button>
          )}
        </Space>
      </Card>
    </div>
  );
};

export default EnhancedSwipePanel;
