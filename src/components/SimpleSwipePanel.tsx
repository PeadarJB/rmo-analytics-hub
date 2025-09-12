// src/components/SimpleSwipePanel.tsx - With Debug Logging

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
  console.log('[SimpleSwipePanel] Component rendering');
  
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

  const swipeRef = useRef<Swipe | null>(null);
  const swipeStyleRef = useRef<HTMLStyleElement | null>(null);

  // Add styles on component mount
  useEffect(() => {
    console.log('[SimpleSwipePanel] Style injection effect running');
    
    // Check if styles already exist
    const existingStyle = document.getElementById('swipe-widget-styles');
    if (existingStyle) {
      console.log('[SimpleSwipePanel] Styles already exist, removing old ones');
      existingStyle.remove();
    }
    
    if (!swipeStyleRef.current) {
      console.log('[SimpleSwipePanel] Creating and injecting custom styles');
      const style = document.createElement('style');
      style.id = 'swipe-widget-styles';
      style.innerHTML = `
        /* Enhanced Swipe Widget Styles - DEBUG VERSION */
        .esri-swipe {
          z-index: 999 !important;
          border: 2px solid red !important; /* DEBUG: Show swipe container */
        }
        
        /* Main swipe divider line */
        .esri-swipe__divider {
          background: #722ed1 !important;
          width: 8px !important; /* Even wider for debugging */
          box-shadow: 0 0 20px rgba(114, 46, 209, 1) !important;
          cursor: col-resize !important;
          opacity: 1 !important;
          visibility: visible !important;
          display: block !important;
          position: absolute !important;
          top: 0 !important;
          bottom: 0 !important;
          z-index: 1000 !important;
        }
        
        /* Swipe handle button */
        .esri-swipe__handle {
          width: 60px !important; /* Even larger for debugging */
          height: 60px !important;
          background: #ff0000 !important; /* RED for visibility */
          border: 4px solid #ffff00 !important; /* YELLOW border */
          border-radius: 50% !important;
          box-shadow: 0 4px 20px rgba(0,0,0,0.8) !important;
          cursor: grab !important;
          z-index: 1002 !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          opacity: 1 !important;
          visibility: visible !important;
          position: absolute !important;
        }
        
        .esri-swipe__handle:hover {
          background: #00ff00 !important; /* GREEN on hover */
          transform: scale(1.2) !important;
          cursor: grabbing !important;
        }
        
        /* Add drag indicator */
        .esri-swipe__handle::before {
          content: "DRAG" !important;
          color: white !important;
          font-size: 14px !important;
          font-weight: bold !important;
          line-height: 1 !important;
        }
        
        /* For vertical swipe */
        .esri-swipe--vertical .esri-swipe__divider {
          width: 100% !important;
          height: 8px !important;
          cursor: row-resize !important;
          left: 0 !important;
          right: 0 !important;
        }
        
        /* Force visibility for all swipe elements */
        .esri-swipe * {
          opacity: 1 !important;
          visibility: visible !important;
        }
        
        /* Ensure container doesn't block interactions */
        .esri-swipe__container {
          pointer-events: none !important;
          border: 2px solid blue !important; /* DEBUG: Show container */
        }
        
        .esri-swipe__container > * {
          pointer-events: auto !important;
        }
      `;
      
      document.head.appendChild(style);
      swipeStyleRef.current = style;
      console.log('[SimpleSwipePanel] Styles injected successfully');
      
      // Verify styles are in DOM
      const verifyStyle = document.getElementById('swipe-widget-styles');
      console.log('[SimpleSwipePanel] Style element verified in DOM:', !!verifyStyle);
    }

    // Cleanup on unmount
    return () => {
      console.log('[SimpleSwipePanel] Cleaning up styles');
      if (swipeStyleRef.current && swipeStyleRef.current.parentNode) {
        swipeStyleRef.current.parentNode.removeChild(swipeStyleRef.current);
        swipeStyleRef.current = null;
      }
    };
  }, []);

  const findLALayer = (kpi: string, year: number): FeatureLayer | null => {
    console.log(`[SimpleSwipePanel] Finding LA layer for KPI: ${kpi}, Year: ${year}`);
    
    if (!webmap) {
      console.log('[SimpleSwipePanel] WebMap not available');
      return null;
    }

    const layerTitle = LA_LAYER_CONFIG.layerTitlePattern(kpi, year);
    console.log(`[SimpleSwipePanel] Looking for layer with title: ${layerTitle}`);
    
    const layer = webmap.allLayers.find((l: any) =>
      l.title === layerTitle && l.type === 'feature'
    ) as FeatureLayer;

    if (!layer) {
      console.warn(`[SimpleSwipePanel] LA layer not found: ${layerTitle}`);
      console.log('[SimpleSwipePanel] Available layers:', webmap.allLayers.map((l: any) => l.title).toArray());
      
      for (const altPattern of LA_LAYER_CONFIG.alternativePatterns) {
        const altTitle = altPattern(kpi, year);
        console.log(`[SimpleSwipePanel] Trying alternative pattern: ${altTitle}`);
        const altLayer = webmap.allLayers.find((l: any) =>
          l.title === altTitle && l.type === 'feature'
        ) as FeatureLayer;
        if (altLayer) {
          console.log(`[SimpleSwipePanel] Found layer with alternative pattern: ${altTitle}`);
          return altLayer;
        }
      }
    } else {
      console.log(`[SimpleSwipePanel] Layer found: ${layer.title}`);
    }

    return layer;
  };

  const inspectSwipeDOM = () => {
    console.log('[SimpleSwipePanel] ========== DOM INSPECTION START ==========');
    
    // Find all swipe-related elements
    const swipeElements = document.querySelectorAll('.esri-swipe');
    console.log(`[SimpleSwipePanel] Found ${swipeElements.length} .esri-swipe elements`);
    
    swipeElements.forEach((el, index) => {
      console.log(`[SimpleSwipePanel] Swipe element ${index}:`, {
        className: el.className,
        id: el.id,
        visible: (el as HTMLElement).style.visibility,
        display: (el as HTMLElement).style.display,
        opacity: (el as HTMLElement).style.opacity,
        dimensions: {
          width: (el as HTMLElement).offsetWidth,
          height: (el as HTMLElement).offsetHeight
        },
        position: {
          top: (el as HTMLElement).offsetTop,
          left: (el as HTMLElement).offsetLeft
        }
      });
      
      // Check for divider
      const divider = el.querySelector('.esri-swipe__divider');
      if (divider) {
        const dividerEl = divider as HTMLElement;
        const computedStyle = window.getComputedStyle(dividerEl);
        console.log('[SimpleSwipePanel] Divider found:', {
          visible: computedStyle.visibility,
          display: computedStyle.display,
          opacity: computedStyle.opacity,
          background: computedStyle.background,
          width: computedStyle.width,
          height: computedStyle.height,
          position: computedStyle.position,
          zIndex: computedStyle.zIndex
        });
      } else {
        console.log('[SimpleSwipePanel] No divider found!');
      }
      
      // Check for handle
      const handle = el.querySelector('.esri-swipe__handle');
      if (handle) {
        const handleEl = handle as HTMLElement;
        const computedStyle = window.getComputedStyle(handleEl);
        console.log('[SimpleSwipePanel] Handle found:', {
          visible: computedStyle.visibility,
          display: computedStyle.display,
          opacity: computedStyle.opacity,
          background: computedStyle.background,
          width: computedStyle.width,
          height: computedStyle.height,
          position: computedStyle.position,
          zIndex: computedStyle.zIndex
        });
      } else {
        console.log('[SimpleSwipePanel] No handle found!');
      }
    });
    
    console.log('[SimpleSwipePanel] ========== DOM INSPECTION END ==========');
  };

  const startSwipe = async () => {
    console.log('[SimpleSwipePanel] ========== START SWIPE BEGIN ==========');
    console.log('[SimpleSwipePanel] MapView available:', !!mapView);
    console.log('[SimpleSwipePanel] WebMap available:', !!webmap);
    
    if (!mapView || !webmap) {
      console.error('[SimpleSwipePanel] Map or WebMap not ready');
      message.error('Map is not ready. Please try again.');
      return;
    }

    // Clean up existing swipe if any
    stopSwipe();

    const leftLayer = findLALayer(activeKpi, leftYear);
    const rightLayer = findLALayer(activeKpi, rightYear);

    console.log('[SimpleSwipePanel] Left layer:', leftLayer?.title || 'NOT FOUND');
    console.log('[SimpleSwipePanel] Right layer:', rightLayer?.title || 'NOT FOUND');

    if (!leftLayer || !rightLayer) {
      console.error('[SimpleSwipePanel] Required layers not found');
      message.error(`Could not find LA layers for ${KPI_LABELS[activeKpi]} comparison`);
      return;
    }

    try {
      console.log('[SimpleSwipePanel] Making layers visible');
      leftLayer.visible = true;
      rightLayer.visible = true;

      // Hide other LA layers
      let hiddenCount = 0;
      webmap.allLayers.forEach((layer: any) => {
        if (
          layer.title &&
          layer.title.startsWith('Average ') &&
          layer !== leftLayer &&
          layer !== rightLayer
        ) {
          layer.visible = false;
          hiddenCount++;
        }
      });
      console.log(`[SimpleSwipePanel] Hidden ${hiddenCount} other LA layers`);

      console.log('[SimpleSwipePanel] Creating Swipe widget');
      const swipe = new Swipe({
        view: mapView,
        leadingLayers: [leftLayer],
        trailingLayers: [rightLayer],
        direction: direction,
        position: position,
        visibleElements: {
          handle: true,
          divider: true
        }
      });

      console.log('[SimpleSwipePanel] Swipe widget created:', {
        id: swipe.id,
        direction: swipe.direction,
        position: swipe.position,
        leadingLayers: swipe.leadingLayers.length,
        trailingLayers: swipe.trailingLayers.length
      });

      // Add to view
      console.log('[SimpleSwipePanel] Adding widget to MapView UI');
      mapView.ui.add(swipe);
      
      // Wait for widget to be ready
      await swipe.when();
      console.log('[SimpleSwipePanel] Swipe widget ready');
      
      // Store references
      swipeRef.current = swipe;
      setSwipeWidget(swipe);
      setIsSwipeActive(true);

      // Update store with current swipe years
      setSwipeYears(leftYear, rightYear);

      // Inspect DOM after creation
      setTimeout(() => {
        console.log('[SimpleSwipePanel] Inspecting DOM after 100ms');
        inspectSwipeDOM();
        
        // Try to force visibility
        const swipeEl = document.querySelector('.esri-swipe') as HTMLElement;
        if (swipeEl) {
          console.log('[SimpleSwipePanel] Forcing visibility on swipe element');
          swipeEl.style.visibility = 'visible';
          swipeEl.style.opacity = '1';
          swipeEl.style.display = 'block';
        }
        
        // Force position update
        if (swipe && swipe.position) {
          console.log('[SimpleSwipePanel] Forcing position update');
          swipe.position = position;
        }
      }, 100);
      
      // Another inspection after 500ms
      setTimeout(() => {
        console.log('[SimpleSwipePanel] Second inspection after 500ms');
        inspectSwipeDOM();
      }, 500);

      console.log('[SimpleSwipePanel] ========== START SWIPE END ==========');
      message.success('Swipe comparison activated');
    } catch (error) {
      console.error('[SimpleSwipePanel] Failed to create swipe:', error);
      message.error('Failed to activate swipe comparison');
    }
  };

  const stopSwipe = () => {
    console.log('[SimpleSwipePanel] ========== STOP SWIPE BEGIN ==========');
    
    if (swipeRef.current && mapView) {
      console.log('[SimpleSwipePanel] Stopping swipe widget');
      
      // Hide the layers that were being compared
      if (swipeRef.current.leadingLayers) {
        swipeRef.current.leadingLayers.forEach((layer: any) => {
          if (layer) {
            layer.visible = false;
            console.log(`[SimpleSwipePanel] Hidden leading layer: ${layer.title}`);
          }
        });
      }
      if (swipeRef.current.trailingLayers) {
        swipeRef.current.trailingLayers.forEach((layer: any) => {
          if (layer) {
            layer.visible = false;
            console.log(`[SimpleSwipePanel] Hidden trailing layer: ${layer.title}`);
          }
        });
      }
      
      console.log('[SimpleSwipePanel] Removing widget from UI');
      mapView.ui.remove(swipeRef.current);
      
      console.log('[SimpleSwipePanel] Destroying widget');
      swipeRef.current.destroy();
      swipeRef.current = null;
      setSwipeWidget(null);
      setIsSwipeActive(false);
      
      console.log('[SimpleSwipePanel] ========== STOP SWIPE END ==========');
      message.info('Swipe comparison deactivated');
    } else {
      console.log('[SimpleSwipePanel] No swipe widget to stop');
    }
  };

  const updatePosition = (value: number) => {
    console.log(`[SimpleSwipePanel] Updating position to: ${value}`);
    setPosition(value);
    if (swipeWidget) {
      swipeWidget.position = value;
      console.log('[SimpleSwipePanel] Widget position updated');
    }
  };

  const updateDirection = (value: 'horizontal' | 'vertical') => {
    console.log(`[SimpleSwipePanel] Updating direction to: ${value}`);
    setDirection(value);
    if (swipeWidget) {
      swipeWidget.direction = value;
      console.log('[SimpleSwipePanel] Widget direction updated');
    }
  };

  // Restart swipe when KPI changes while active
  useEffect(() => {
    console.log(`[SimpleSwipePanel] KPI changed to: ${activeKpi}, isActive: ${isSwipeActive}`);
    if (isSwipeActive && activeKpi) {
      console.log('[SimpleSwipePanel] Restarting swipe due to KPI change');
      stopSwipe();
      startSwipe();
    }
  }, [activeKpi]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-start swipe on component mount if configured
  useEffect(() => {
    console.log('[SimpleSwipePanel] Mount effect running');
    const { swipePanelAutoStart } = useAppStore.getState() as any;
    console.log(`[SimpleSwipePanel] Auto-start enabled: ${swipePanelAutoStart}`);
    
    if (swipePanelAutoStart && !isSwipeActive) {
      console.log('[SimpleSwipePanel] Auto-starting swipe in 500ms');
      const timer = setTimeout(() => {
        startSwipe();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, []); // Only run on mount

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      console.log('[SimpleSwipePanel] Component unmounting, cleaning up');
      stopSwipe();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleClose = () => {
    console.log('[SimpleSwipePanel] Close button clicked');
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

        <Button
          type={isSwipeActive ? 'default' : 'primary'}
          icon={isSwipeActive ? <CloseOutlined /> : <SwapOutlined />}
          onClick={isSwipeActive ? stopSwipe : startSwipe}
          block
          danger={isSwipeActive}
        >
          {isSwipeActive ? 'Stop Comparison' : 'Start Comparison'}
        </Button>

        <div style={{ fontSize: 12, opacity: 0.7, marginTop: 8 }}>
          <strong>Tip:</strong> Drag the swipe handle to compare {KPI_LABELS[activeKpi as KPIKey]} averages
          by Local Authority between {leftYear} and {rightYear}.
        </div>
      </Space>
    </Card>
  );
};

export default SimpleSwipePanel;