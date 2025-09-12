// src/components/SimpleSwipePanel.tsx - Adapted for RMO Analytics Hub

import { useState, useEffect, useCallback, FC } from 'react';
import { Card, Select, Button, Space, Slider, Radio, Tag, message, Tooltip, Divider, theme } from 'antd';
import { SwapOutlined, CloseOutlined } from '@ant-design/icons';
import type { KPIKey } from '@/config/appConfig';

// Store imports - Adapted for RMO App
import useAppStore from '@/store/useAppStore';

// Style imports - Using existing RMO styles
import { usePanelStyles } from '@/styles/styled';

// Type imports
import type Swipe from '@arcgis/core/widgets/Swipe';
import type Layer from '@arcgis/core/layers/Layer';
import type FeatureLayer from '@arcgis/core/layers/FeatureLayer';

// Config imports - Adapted for RMO App
import { CONFIG, KPI_LABELS, LA_LAYER_CONFIG } from '@/config/appConfig';

interface SimpleSwipePanelProps {}

const SimpleSwipePanel: FC<SimpleSwipePanelProps> = () => {
  const { styles: panelStyles } = usePanelStyles();
  const { token } = theme.useToken();

  // Zustand state and actions from RMO store
  const {
    mapView: view,
    isSwipeActive,
    activeKpi,
    laPolygonLayers,
    leftSwipeYear,
    rightSwipeYear,
    enterSwipeMode,
    exitSwipeMode,
    setSwipeYears,
    setShowSwipe,
  } = useAppStore();

  // Local state for UI controls
  const [leftYear, setLeftYear] = useState<number>(leftSwipeYear);
  const [rightYear, setRightYear] = useState<number>(rightSwipeYear);
  const [swipeWidget, setSwipeWidget] = useState<Swipe | null>(null);
  const [direction, setDirection] = useState<'horizontal' | 'vertical'>('horizontal');
  const [position, setPosition] = useState(50);

  /**
   * Stops the swipe widget, hides layers, and cleans up.
   */
  const stopSwipe = useCallback(() => {
    if (swipeWidget && view) {
      // Hide layers that were being compared
      [...swipeWidget.leadingLayers, ...swipeWidget.trailingLayers].forEach(layer => {
        if (layer) (layer as Layer).visible = false;
      });
      view.ui.remove(swipeWidget);
      swipeWidget.destroy();
      exitSwipeMode(); // Restore previous filter state if any
      setSwipeWidget(null);
      useAppStore.setState({ isSwipeActive: false });
      message.info('Layer comparison deactivated');
    }
  }, [swipeWidget, view, exitSwipeMode]);

  // Cleanup effect when the component unmounts
  useEffect(() => {
    return () => stopSwipe();
  }, [stopSwipe]);
  
  /**
   * Finds a specific LA polygon layer from the store's Map object.
   * This is more efficient than searching all webmap layers.
   */
  const findLayer = (kpi: KPIKey, year: number): FeatureLayer | undefined => {
    if (!laPolygonLayers) return undefined;
    const layerTitle = LA_LAYER_CONFIG.layerTitlePattern(kpi, year);
    return laPolygonLayers.get(layerTitle);
  };

  /**
   * Initializes and starts the ArcGIS Swipe widget.
   */
  const startSwipe = async () => {
    if (!view || !laPolygonLayers) {
      message.error("Map or LA layers are not ready. Please try again.");
      return;
    }

    try {
      enterSwipeMode(); // Save current road layer filters

      const leftLayer = findLayer(activeKpi, leftYear);
      const rightLayer = findLayer(rightYear === leftYear ? activeKpi : activeKpi, rightYear);

      if (!leftLayer || !rightLayer) {
        message.error(`Could not find comparison layers for ${KPI_LABELS[activeKpi]} in ${leftYear} vs ${rightYear}.`);
        exitSwipeMode();
        return;
      }
      
      // Ensure only these two layers are visible
      laPolygonLayers.forEach(layer => {
        layer.visible = (layer === leftLayer || layer === rightLayer);
      });

      const SwipeWidget = (await import('@arcgis/core/widgets/Swipe')).default;
      const swipe = new SwipeWidget({
        view: view,
        leadingLayers: [leftLayer],
        trailingLayers: [rightLayer],
        direction: direction,
        position: position,
      });

      view.ui.add(swipe);
      setSwipeWidget(swipe);
      useAppStore.setState({ isSwipeActive: true });
      setSwipeYears(leftYear, rightYear); // Update global state
      message.success('Layer comparison activated');
    } catch (error) {
      console.error('Failed to create swipe:', error);
      message.error('Failed to activate layer comparison');
      exitSwipeMode();
    }
  };
  
  // Effect to auto-restart swipe if the active KPI changes
  useEffect(() => {
    if (isSwipeActive) {
      // A brief delay to allow state updates to settle before restarting
      const timer = setTimeout(() => {
        stopSwipe();
        void startSwipe();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [activeKpi]);

  const updatePosition = (value: number) => {
    setPosition(value);
    if (swipeWidget) swipeWidget.position = value;
  };

  const updateDirection = (value: 'horizontal' | 'vertical') => {
    setDirection(value);
    if (swipeWidget) swipeWidget.direction = value;
  };
  
  const handleClose = () => {
    stopSwipe();
    setShowSwipe(false);
  };
  
  const yearOptions = CONFIG.filters.year.options?.map(o => ({ 
    label: o.label, 
    value: o.value 
  })) ?? [];

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
      extra={<Button type="text" icon={<CloseOutlined />} onClick={handleClose} size="small" />}
      styles={{
        body: { padding: token.padding },
        header: { 
          borderBottom: `1px solid ${token.colorBorderSecondary}`,
          background: token.colorBgContainer
        }
      }}
    >
      <Space direction="vertical" style={{ width: '100%' }}>
        
        {/* --- RMO-Specific Year Selection Controls --- */}
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
        
        {/* --- Generic Swipe Controls --- */}
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