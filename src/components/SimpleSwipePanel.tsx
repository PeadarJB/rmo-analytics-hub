// src/components/SimpleSwipePanel.tsx - FIXED VERSION

import { useState, useEffect, useCallback, FC } from 'react';
import { Card, Select, Button, Space, Slider, Radio, Tag, message, Divider, theme } from 'antd';
import { CloseOutlined, SwapOutlined } from '@ant-design/icons';
import type { KPIKey } from '@/config/kpiConfig';

// Store imports
import useAppStore from '@/store/useAppStore';

// Style imports
import { usePanelStyles } from '@/styles/styled';

// Type imports
import type Swipe from '@arcgis/core/widgets/Swipe';
import type Layer from '@arcgis/core/layers/Layer';
import type FeatureLayer from '@arcgis/core/layers/FeatureLayer';

// Config imports
import { CONFIG, LA_LAYER_CONFIG, SWIPE_LAYER_CONFIG } from '@/config/appConfig';
import { KPI_LABELS } from '@/config/kpiConfig';

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
    isSwipeActive,
    activeKpi,
    laLayerCache,
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
   * Find a specific LA polygon layer from cache
   */
  const findLayer = useCallback((kpi: KPIKey, year: number): FeatureLayer | null => {
    if (!laLayerCache) return null;
    
    const key = `${kpi.toLowerCase()}_${year}_average`;
    const layer = laLayerCache.get(key);
    
    if (layer) {
      console.log(`[Swipe] Found layer: ${key}`);
      return layer;
    }
    
    console.warn(`[Swipe] Layer not found: ${key}`);
    return null;
  }, [laLayerCache]);

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
      exitSwipeMode();
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
   * Starts swipe mode with selected years
   */
  const startSwipe = async () => {
    if (!view || !webmap) {
      message.error('Map not initialized');
      return;
    }
    
    if (leftYear === rightYear) {
      message.warning('Please select different years to compare');
      return;
    }
    
    try {
      // Import Swipe widget dynamically
      const [{ default: Swipe }] = await Promise.all([
        import('@arcgis/core/widgets/Swipe')
      ]);
      
      const leftLayer = findLayer(activeKpi, leftYear);
      const rightLayer = findLayer(activeKpi, rightYear);
      
      if (!leftLayer || !rightLayer) {
        message.error('Required layers not found in map');
        return;
      }
      
      // Hide all LA layers first
      if (laLayerCache) {
        laLayerCache.forEach((layer: FeatureLayer) => {
          layer.visible = false;
        });
      }
      
      // Make comparison layers visible
      leftLayer.visible = true;
      rightLayer.visible = true;
      
      // Create swipe widget
      const swipe = new Swipe({
        view,
        leadingLayers: [leftLayer],
        trailingLayers: [rightLayer],
        direction,
        position
      });
      
      view.ui.add(swipe);
      setSwipeWidget(swipe);
      enterSwipeMode();
      useAppStore.setState({ isSwipeActive: true });
      setSwipeYears(leftYear, rightYear);
      
      message.success('Layer comparison activated');
      
      console.log('Swipe widget created:', {
        leadingLayer: leftLayer.title,
        trailingLayer: rightLayer.title,
        direction,
        position
      });
      
    } catch (error) {
      console.error('Failed to create swipe:', error);
      message.error('Failed to activate layer comparison');
      exitSwipeMode();
    }
  };
  
  // Effect to auto-restart swipe if the active KPI changes while active
  useEffect(() => {
    if (isSwipeActive && swipeWidget) {
      const updateSwipeLayers = async () => {
        const leftLayer = findLayer(activeKpi, leftYear);
        const rightLayer = findLayer(activeKpi, rightYear);
        
        if (leftLayer && rightLayer && swipeWidget) {
          // Hide all LA layers
          if (laLayerCache) {
            laLayerCache.forEach((layer: FeatureLayer) => {
              layer.visible = false;
            });
          }
          
          // Update swipe widget layers
          swipeWidget.leadingLayers.removeAll();
          swipeWidget.trailingLayers.removeAll();
          swipeWidget.leadingLayers.add(leftLayer);
          swipeWidget.trailingLayers.add(rightLayer);
          
          // Make layers visible
          leftLayer.visible = true;
          rightLayer.visible = true;
        }
      };
      
      updateSwipeLayers();
    }
  }, [activeKpi, isSwipeActive, swipeWidget, leftYear, rightYear, laLayerCache, findLayer]);

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