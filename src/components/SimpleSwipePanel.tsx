// src/components/SimpleSwipePanel.tsx - Fixed version for RMO

import { useState, useEffect, useCallback, FC } from 'react';
import { Card, Select, Button, Space, Slider, Radio, Tag, message, Divider, theme } from 'antd';
import { SwapOutlined, CloseOutlined } from '@ant-design/icons';
import type { KPIKey } from '@/config/appConfig';

// Store imports
import useAppStore from '@/store/useAppStore';

// Style imports
import { usePanelStyles } from '@/styles/styled';

// Type imports
import type Swipe from '@arcgis/core/widgets/Swipe';
import type Layer from '@arcgis/core/layers/Layer';
import type FeatureLayer from '@arcgis/core/layers/FeatureLayer';

// Config imports
import { CONFIG, KPI_LABELS, LA_LAYER_CONFIG } from '@/config/appConfig';

interface SimpleSwipePanelProps {}

const SimpleSwipePanel: FC<SimpleSwipePanelProps> = () => {
  const { styles: panelStyles } = usePanelStyles();
  const { token } = theme.useToken();

  // Zustand state and actions from RMO store
  const {
    mapView: view,
    webmap,
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
   * Finds a specific LA polygon layer from the store's Map object or webmap.
   */
  const findLayer = (kpi: KPIKey, year: number): FeatureLayer | undefined => {
    const layerTitle = LA_LAYER_CONFIG.layerTitlePattern(kpi, year);
    console.log(`Looking for layer: "${layerTitle}"`);
    
    // First try from the cached laPolygonLayers
    if (laPolygonLayers) {
      const layer = laPolygonLayers.get(layerTitle);
      if (layer) {
        console.log(`Found layer in cache: ${layerTitle}`);
        return layer;
      }
    }
    
    // If not in cache, search in webmap
    if (webmap) {
      const layer = webmap.allLayers.find((l: any) => l.title === layerTitle) as FeatureLayer | undefined;
      if (layer) {
        console.log(`Found layer in webmap: ${layerTitle}`);
        return layer;
      }
    }
    
    console.warn(`Layer not found: ${layerTitle}`);
    console.log('Available layers:', laPolygonLayers ? Array.from(laPolygonLayers.keys()) : 'No cached layers');
    return undefined;
  };

  /**
   * Initializes and starts the ArcGIS Swipe widget.
   */
  const startSwipe = async () => {
    if (!view || !webmap) {
      message.error("Map is not ready. Please try again.");
      return;
    }

    try {
      enterSwipeMode();

      const leftLayer = findLayer(activeKpi, leftYear);
      const rightLayer = findLayer(activeKpi, rightYear);

      if (!leftLayer || !rightLayer) {
        message.error(`Could not find comparison layers for ${KPI_LABELS[activeKpi]}`);
        console.error('Missing layers:', {
          leftLayer: leftLayer ? 'found' : `NOT FOUND (${LA_LAYER_CONFIG.layerTitlePattern(activeKpi, leftYear)})`,
          rightLayer: rightLayer ? 'found' : `NOT FOUND (${LA_LAYER_CONFIG.layerTitlePattern(activeKpi, rightYear)})`
        });
        exitSwipeMode();
        return;
      }
      
      // Hide all LA layers first
      if (laPolygonLayers) {
        laPolygonLayers.forEach(layer => {
          layer.visible = false;
        });
      }
      
      // Make only the swipe layers visible
      leftLayer.visible = true;
      rightLayer.visible = true;

      // Dynamically import and create swipe widget
      const SwipeModule = await import('@arcgis/core/widgets/Swipe');
      const SwipeWidget = SwipeModule.default;
      
      const swipe = new SwipeWidget({
        view: view,
        leadingLayers: [leftLayer],
        trailingLayers: [rightLayer],
        direction: direction,
        position: position,
        // Ensure the widget is enabled
        disabled: false
      });

      // Add to the view UI
      view.ui.add(swipe);
      
      // Store reference
      setSwipeWidget(swipe);
      useAppStore.setState({ isSwipeActive: true });
      setSwipeYears(leftYear, rightYear);
      
      message.success('Layer comparison activated');
      
      // Log for debugging
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
      // Update the layers when KPI changes
      const updateSwipeLayers = async () => {
        const leftLayer = findLayer(activeKpi, leftYear);
        const rightLayer = findLayer(activeKpi, rightYear);
        
        if (leftLayer && rightLayer && swipeWidget) {
          // Hide all LA layers
          if (laPolygonLayers) {
            laPolygonLayers.forEach(layer => {
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
  }, [activeKpi, isSwipeActive, swipeWidget, leftYear, rightYear, laPolygonLayers]);

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