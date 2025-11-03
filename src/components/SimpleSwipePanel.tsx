// src/components/SimpleSwipePanel.tsx

import { useState, useEffect, useCallback, FC } from 'react';
import { Card, Select, Button, Space, Slider, Radio, Tag, message, Divider, theme } from 'antd';
import { CloseOutlined, SwapOutlined } from '@ant-design/icons';

// Store imports
import useAppStore from '@/store/useAppStore';

// Style imports
import { usePanelStyles } from '@/styles/styled';

// Type imports
import type Swipe from '@arcgis/core/widgets/Swipe';
import type FeatureLayer from '@arcgis/core/layers/FeatureLayer';

// Config imports
import { KPI_LABELS } from '@/config/kpiConfig';

// Clone helper
import { cloneLALayer, removeClonedLayer } from '@/utils/layerCloneHelper';

interface SimpleSwipePanelProps {}

// FIXED: Define year options explicitly based on available survey years
const YEAR_OPTIONS = [
  { label: '2011', value: 2011 },
  { label: '2018', value: 2018 },
  { label: '2025', value: 2025 }
];

const SimpleSwipePanel: FC<SimpleSwipePanelProps> = () => {
  const { styles: panelStyles } = usePanelStyles();
  const { token } = theme.useToken();

  // Zustand state and actions from RMO store
  const {
    mapView: view,
    webmap,
    laLayer,
    isSwipeActive,
    activeKpi,
    leftSwipeYear,
    rightSwipeYear,
    enterSwipeMode,
    exitSwipeMode,
    setSwipeYears,
    setShowSwipe,
    laMetricType,
    themeMode,
  } = useAppStore();

  // Local state for UI controls
  const [leftYear, setLeftYear] = useState<number>(leftSwipeYear);
  const [rightYear, setRightYear] = useState<number>(rightSwipeYear);
  const [swipeWidget, setSwipeWidget] = useState<Swipe | null>(null);
  const [leftClone, setLeftClone] = useState<FeatureLayer | null>(null);
  const [rightClone, setRightClone] = useState<FeatureLayer | null>(null);
  const [direction, setDirection] = useState<'horizontal' | 'vertical'>('horizontal');
  const [position, setPosition] = useState(50);

  /**
   * Stops the swipe widget, hides layers, and cleans up.
   */
  const stopSwipe = useCallback(() => {
    // Remove widget
    if (swipeWidget && view) {
      view.ui.remove(swipeWidget);
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
  }, [swipeWidget, view, webmap, leftClone, rightClone, laLayer, exitSwipeMode]);

  // Cleanup effect when the component unmounts
  useEffect(() => {
    return () => stopSwipe();
  }, [stopSwipe]);
  
  /**
   * Starts swipe mode with selected years
   * MODIFIED: Now awaits async cloneLALayer calls for continuous gradient support
   */
  const startSwipe = async () => {
    if (!view || !webmap || !laLayer) {
      message.error('Map not initialized');
      return;
    }

    if (leftYear === rightYear) {
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
          leftYear,
          laMetricType,
          themeMode,
          `${activeKpi.toUpperCase()} ${leftYear}`
        ),
        cloneLALayer(
          laLayer,
          activeKpi,
          rightYear,
          laMetricType,
          themeMode,
          `${activeKpi.toUpperCase()} ${rightYear}`
        )
      ]);

      // Add to map
      webmap.layers.add(left);
      webmap.layers.add(right);

      setLeftClone(left);
      setRightClone(right);

      // Wait for layers to load
      await Promise.all([left.when(), right.when()]);

      // Create swipe widget
      const swipe = new Swipe({
        view,
        leadingLayers: [left],
        trailingLayers: [right],
        direction,
        position
      });

      view.ui.add(swipe);
      setSwipeWidget(swipe);
      setSwipeYears(leftYear, rightYear);

      // Dismiss loading and show success
      message.success({ content: `Comparing ${leftYear} vs ${rightYear}`, key: loadingKey, duration: 2 });

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
  };
  
  // Restart comparison if KPI or metric changes
  useEffect(() => {
    if (isSwipeActive && swipeWidget) {
      stopSwipe();
      setTimeout(() => void startSwipe(), 100);
    }
  }, [activeKpi, laMetricType]);

  const updatePosition = (value: number) => {
    setPosition(value);
    if (swipeWidget) {
      swipeWidget.position = value;
    }
  };

  const updateDirection = (value: 'horizontal' | 'vertical') => {
    setDirection(value);
    if (swipeWidget) {
      swipeWidget.direction = value;
    }
  };
  
  const handleClose = () => {
    stopSwipe();
    setShowSwipe(false);
  };
  
  // FIXED: Use explicitly defined year options with proper typing
  const yearOptions = YEAR_OPTIONS.map((option) => ({
    label: option.label,
    value: option.value
  }));

  if (!view) return null;

  return (
    <Card
      title={
        <Space>
          <SwapOutlined />
          <span>Condition Comparison: {KPI_LABELS[activeKpi]}</span>
          {isSwipeActive && <Tag color="green">Active</Tag>}
        </Space>
      }
      size="small"
      className={panelStyles.swipePanel}
      extra={<Button type="text" icon={<CloseOutlined />} onClick={handleClose} size="small" aria-label="Close comparison panel" />}
      styles={{
        body: { padding: token.padding },
        header: { 
          borderBottom: `1px solid ${token.colorBorderSecondary}`
        }
      }}
    >
      <Space direction="vertical" style={{ width: '100%' }}>
        
        {/* Year Selection Controls */}
        <div>
          <label style={{ 
            display: 'block', 
            marginBottom: token.marginXS, 
            fontWeight: 500,
            color: token.colorText
          }}>
            Left/Top Year:
          </label>
          <Select
            style={{ width: '100%' }}
            options={yearOptions}
            value={leftYear}
            onChange={setLeftYear}
            disabled={isSwipeActive}
          />
        </div>
        
        <div>
          <label style={{ 
            display: 'block', 
            marginBottom: token.marginXS, 
            fontWeight: 500,
            color: token.colorText
          }}>
            Right/Bottom Year:
          </label>
          <Select
            style={{ width: '100%' }}
            options={yearOptions}
            value={rightYear}
            onChange={setRightYear}
            disabled={isSwipeActive}
          />
        </div>

        <Divider style={{ margin: '8px 0' }} />
        
        {/* Swipe Controls */}
        <div>
          <label style={{ 
            display: 'block', 
            marginBottom: token.marginXS, 
            fontWeight: 500,
            color: token.colorText
          }}>
            Swipe Direction:
          </label>
          <Radio.Group 
            value={direction} 
            onChange={(e) => updateDirection(e.target.value)} 
            disabled={!isSwipeActive}
          >
            <Radio.Button value="horizontal">Horizontal</Radio.Button>
            <Radio.Button value="vertical">Vertical</Radio.Button>
          </Radio.Group>
        </div>
        
        {isSwipeActive && (
          <div>
            <label style={{ 
              display: 'block', 
              marginBottom: token.marginXS, 
              fontWeight: 500,
              color: token.colorText
            }}>
              Position: {position}%
            </label>
            <Slider 
              value={position} 
              onChange={updatePosition} 
              marks={{ 0: '0%', 50: '50%', 100: '100%' }}
              tooltip={{ formatter: (val) => `${val}%` }}
            />
          </div>
        )}
        
        <Button
          type={isSwipeActive ? 'default' : 'primary'}
          icon={isSwipeActive ? <CloseOutlined /> : <SwapOutlined />}
          onClick={() => void (isSwipeActive ? stopSwipe() : startSwipe())}
          block
          danger={isSwipeActive}
        >
          {isSwipeActive ? 'Stop Comparison' : 'Start Comparison'}
        </Button>
      </Space>
    </Card>
  );
};

export default SimpleSwipePanel;