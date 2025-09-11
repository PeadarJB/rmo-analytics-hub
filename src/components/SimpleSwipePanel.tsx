// src/components/SimpleSwipePanel.tsx

import React, { useEffect, useState, useRef } from 'react';
import { Card, Select, Button, Space, Slider, Radio, Tag, message } from 'antd';
import { SwapOutlined, CloseOutlined } from '@ant-design/icons';
import Swipe from '@arcgis/core/widgets/Swipe';
import useAppStore from '@/store/useAppStore';
import { CONFIG, KPI_LABELS, type KPIKey, LA_LAYER_CONFIG } from '@/config/appConfig';
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
  const [swipeWidget, setSwipeWidget] = useState<Swipe | null>(null);
  const [isSwipeActive, setIsSwipeActive] = useState<boolean>(false);
  const [direction, setDirection] = useState<'horizontal' | 'vertical'>('horizontal');
  const [position, setPosition] = useState<number>(50);

  // Keep track of current swipe instance for cleanup
  const swipeRef = useRef<Swipe | null>(null);

  // Add this with other useRef hooks (Location 2)
  const swipeStyleRef = useRef<HTMLStyleElement | null>(null);

  // Function to find LA polygon layer by title (Location 2)
  const findLALayer = (kpi: string, year: number): FeatureLayer | null => {
    if (!webmap) return null;

    // Use configured pattern
    const layerTitle = LA_LAYER_CONFIG.layerTitlePattern(kpi, year);

    const layer = webmap.allLayers.find((l: any) =>
      l.title === layerTitle && l.type === 'feature'
    ) as FeatureLayer;

    if (!layer) {
      console.warn(`LA layer not found: ${layerTitle}`);
      // Try alternative patterns
      for (const altPattern of LA_LAYER_CONFIG.alternativePatterns) {
        const altTitle = altPattern(kpi, year);
        const altLayer = webmap.allLayers.find((l: any) =>
          l.title === altTitle && l.type === 'feature'
        ) as FeatureLayer;
        if (altLayer) {
          console.log(`Found layer with alternative pattern: ${altTitle}`);
          return altLayer;
        }
      }
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

    // Get the LA polygon layers for active KPI and years (Location 3)
    const leftLayer = findLALayer(activeKpi, leftYear);
    const rightLayer = findLALayer(activeKpi, rightYear);

    if (!leftLayer || !rightLayer) {
      message.error(`Could not find LA layers for ${KPI_LABELS[activeKpi]} comparison`);
      return;
    }

    try {
      // Make both layers visible
      leftLayer.visible = true;
      rightLayer.visible = true;

      // Hide other LA layers
      webmap.allLayers.forEach((layer: any) => {
        if (
          layer.title &&
          layer.title.startsWith('Average ') &&
          layer !== leftLayer &&
          layer !== rightLayer
        ) {
          layer.visible = false;
        }
      });

      // Create swipe widget with better visibility (Location 1)
      const swipe = new Swipe({
        view: mapView,
        leadingLayers: [leftLayer],
        trailingLayers: [rightLayer],
        direction: direction,
        position: position,
        // Add a visible handle
        visibleElements: {
          handle: true,
          divider: true
        }
      });

      mapView.ui.add(swipe);

      // IMPORTANT: Add custom styling after the widget is added to the view
      swipe.when(() => {
        // Wait a bit for the DOM to be ready
        setTimeout(() => {
          // Add custom styles to make the swipe handle visible
          const style = document.createElement('style');
          style.innerHTML = `
            /* Main swipe divider line */
            .esri-swipe__divider {
              background: linear-gradient(to bottom, #722ed1, #b37feb) !important;
              width: 4px !important;
              box-shadow: 0 0 8px rgba(114, 46, 209, 0.5) !important;
              cursor: col-resize !important;
              z-index: 999 !important;
            }
            
            /* Swipe handle button */
            .esri-swipe__handle {
              width: 40px !important;
              height: 40px !important;
              background: #722ed1 !important;
              border: 3px solid white !important;
              border-radius: 50% !important;
              box-shadow: 0 2px 8px rgba(0,0,0,0.3) !important;
              cursor: grab !important;
              z-index: 1000 !important;
              display: flex !important;
              align-items: center !important;
              justify-content: center !important;
            }
            
            .esri-swipe__handle:hover {
              background: #b37feb !important;
              transform: scale(1.1) !important;
              cursor: grabbing !important;
            }
            
            /* Add drag indicator arrows */
            .esri-swipe__handle::after {
              content: "⟷" !important;
              color: white !important;
              font-size: 20px !important;
              font-weight: bold !important;
            }
            
            /* For vertical swipe */
            .esri-swipe--vertical .esri-swipe__handle::after {
              content: "⟵⟶" !important;
              transform: rotate(90deg) !important;
            }
            
            /* Container adjustments */
            .esri-swipe__container {
              border: none !important;
            }
            
            /* Make sure the swipe is interactive */
            .esri-swipe {
              pointer-events: auto !important;
            }
          `;
          document.head.appendChild(style);

          // (Optional) keep a separate ref as well
          swipeStyleRef.current = style;
          
          // Store reference for cleanup
          swipeRef.current = swipe;
          (swipeRef.current as any).customStyle = style;
        }, 100);
      });

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

  // Stop and clean up swipe widget (Location 3)
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
      
      // Remove custom styles
      const customStyle = (swipeRef.current as any).customStyle;
      if (customStyle && customStyle.parentNode) {
        customStyle.parentNode.removeChild(customStyle);
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

  // Restart swipe when KPI changes while active (Location 5)
  useEffect(() => {
    if (isSwipeActive && activeKpi) {
      // Restart swipe with new KPI
      stopSwipe();
      startSwipe();
    }
  }, [activeKpi]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-start swipe on component mount (Location 6)
  useEffect(() => {
    const { swipePanelAutoStart } = useAppStore.getState() as any;
    if (swipePanelAutoStart && !isSwipeActive) {
      const timer = setTimeout(() => {
        startSwipe();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, []); // Only run on mount

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopSwipe();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Close panel handler
  const handleClose = () => {
    stopSwipe();
    setShowSwipe(false);
  };

  const yearOptions =
    CONFIG.filters.year.options?.map((o) => ({
      label: o.label,
      value: o.value
    })) ?? [];

  return (
    <Card
      size="small"
      title={
        <Space>
          <SwapOutlined />
          {/* Location 8: Title uses header KPI */}
          <span>LA Condition Comparison - {KPI_LABELS[activeKpi as KPIKey]}</span>
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
        boxShadow: token.boxShadow as any,
        borderRadius: token.borderRadius as any
      }}
    >
      <Space direction="vertical" style={{ width: '100%' }}>
        {/* Location 4: KPI selector UI removed */}

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
          <strong>Tip:</strong> Drag the swipe handle to compare {KPI_LABELS[activeKpi as KPIKey]} averages
          by Local Authority between {leftYear} and {rightYear}.
        </div>
      </Space>
    </Card>
  );
};

export default SimpleSwipePanel;
