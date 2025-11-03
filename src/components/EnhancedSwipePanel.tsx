import React, { useState, useEffect, useCallback, FC, useMemo } from 'react';
import { Card, Select, Button, Space, Radio, Divider, Typography, message } from 'antd';
import { SwapOutlined, CloseOutlined } from '@ant-design/icons';
import useAppStore from '@/store/useAppStore';
import type { LAMetricType } from '@/config/appConfig';
import type Swipe from '@arcgis/core/widgets/Swipe';
import type FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import { usePanelStyles } from '@/styles/styled';
import { cloneLALayer, removeClonedLayer } from '@/utils/layerCloneHelper';

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
    webmap,
    laLayer,
    activeKpi,
    leftSwipeYear,
    rightSwipeYear,
    setSwipeYears,
    isSwipeActive,
    laMetricType,
    setLAMetricType,
    enterSwipeMode,
    exitSwipeMode,
    setShowSwipe,
    themeMode,
  } = useAppStore();

  const [swipeWidget, setSwipeWidget] = useState<Swipe | null>(null);
  const [leftClone, setLeftClone] = useState<FeatureLayer | null>(null);
  const [rightClone, setRightClone] = useState<FeatureLayer | null>(null);
  const [direction, setDirection] = useState<'horizontal' | 'vertical'>('horizontal');

  /**
   * Deactivates and destroys the swipe widget
   */
  const deactivateSwipe = useCallback(() => {
    // Remove widget
    if (swipeWidget && mapView) {
      mapView.ui.remove(swipeWidget);
      swipeWidget.destroy();
      setSwipeWidget(null);
    }

    // Remove clones
    if (webmap) {
      if (leftClone) {
        removeClonedLayer(webmap, leftClone);
        setLeftClone(null);
      }
      if (rightClone) {
        removeClonedLayer(webmap, rightClone);
        setRightClone(null);
      }
    }

    // Show original
    if (laLayer) {
      laLayer.visible = true;
    }

    exitSwipeMode();
    message.info('Comparison stopped');
  }, [swipeWidget, mapView, webmap, leftClone, rightClone, laLayer, exitSwipeMode]);

  /**
   * Activates the swipe widget with current settings
   * MODIFIED: Now awaits async cloneLALayer calls for continuous gradient support
   */
  const activateSwipe = useCallback(async () => {
    if (!mapView || !webmap || !laLayer) {
      message.error('Map not initialized');
      return;
    }

    if (leftSwipeYear === rightSwipeYear) {
      message.warning('Please select different years');
      return;
    }

    try {
      const { default: Swipe } = await import('@arcgis/core/widgets/Swipe');

      // Hide original layer
      laLayer.visible = false;
      enterSwipeMode();

      // Show loading message while creating layers with continuous gradients
      const loadingKey = 'swipe-loading';
      message.loading({ content: 'Preparing comparison layers...', key: loadingKey, duration: 0 });

      // Create clones in parallel for better performance
      // Each clone queries max values from the data to create dynamic gradients
      const [left, right] = await Promise.all([
        cloneLALayer(
          laLayer,
          activeKpi,
          leftSwipeYear,
          laMetricType,
          themeMode,
          `${activeKpi.toUpperCase()} ${leftSwipeYear}`
        ),
        cloneLALayer(
          laLayer,
          activeKpi,
          rightSwipeYear,
          laMetricType,
          themeMode,
          `${activeKpi.toUpperCase()} ${rightSwipeYear}`
        )
      ]);

      // Add to map
      webmap.layers.add(left);
      webmap.layers.add(right);

      setLeftClone(left);
      setRightClone(right);

      // Wait for layers to load
      await Promise.all([left.when(), right.when()]);

      // Create swipe
      const swipe = new Swipe({
        view: mapView,
        leadingLayers: [left],
        trailingLayers: [right],
        direction: direction,
        position: 50
      });

      mapView.ui.add(swipe);
      setSwipeWidget(swipe);

      // Dismiss loading and show success
      message.success({ content: `Comparing ${leftSwipeYear} vs ${rightSwipeYear}`, key: loadingKey, duration: 2 });

    } catch (error) {
      console.error('[Swipe] Error:', error);
      message.error('Failed to create comparison');

      // Cleanup on error
      if (leftClone) removeClonedLayer(webmap!, leftClone);
      if (rightClone) removeClonedLayer(webmap!, rightClone);
      setLeftClone(null);
      setRightClone(null);

      // Restore original layer visibility
      if (laLayer) {
        laLayer.visible = true;
      }
      exitSwipeMode();
    }
  }, [mapView, webmap, laLayer, activeKpi, leftSwipeYear, rightSwipeYear, laMetricType, themeMode, direction, leftClone, rightClone, enterSwipeMode, exitSwipeMode]);

  // Effect to clean up widget on unmount
  useEffect(() => {
    return () => {
      if (swipeWidget) {
        deactivateSwipe();
      }
    };
  }, [swipeWidget, deactivateSwipe]);

  // Restart comparison if KPI or metric changes
  useEffect(() => {
    if (isSwipeActive && swipeWidget) {
      deactivateSwipe();
      setTimeout(() => activateSwipe(), 100);
    }
  }, [activeKpi, laMetricType]);

  // Effect to update swipe widget direction if it changes
  useEffect(() => {
    if (swipeWidget) {
      swipeWidget.direction = direction;
    }
  }, [swipeWidget, direction]);

  // Check availability
  const isFairOrBetterAvailable = useMemo(() => {
    return true; // Always allow "Fair or Better"
  }, []);

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
