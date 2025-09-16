import React, { useEffect } from 'react';
import { Layout, Typography, Switch, Space, Segmented, theme } from 'antd';
import useAppStore from '@/store/useAppStore';
import { withTheme } from '@/config/themeConfig';
import { usePanelStyles } from '@/styles/styled';
import MapWidgets from '@/components/MapWidgets';
import SimpleSwipePanel from '@/components/SimpleSwipePanel';
import { CONFIG, KPI_LABELS, type KPIKey } from '@/config/appConfig';

const { Header, Content } = Layout;
const { Title } = Typography;

const ConditionSummaryPage: React.FC = () => {
  const {
    initializeMap,
    themeMode,
    setThemeMode,
    showSwipe,
    setShowSwipe,
    activeKpi,
    setActiveKpi,
    updateLALayerVisibility,
    laPolygonLayers,
    leftSwipeYear,
    rightSwipeYear,
    roadLayer,
    roadLayerSwipe
  } = useAppStore();

  const { styles } = usePanelStyles();
  const { token } = theme.useToken();

  useEffect(() => {
    // Initialize map if not already done
    const container = document.getElementById('conditionViewDiv');
    if (container && !container.hasChildNodes()) {
      initializeMap('conditionViewDiv');
    }
    
    // Hide road network layers for this page
    const hideRoadLayers = () => {
      const state = useAppStore.getState();
      if (state.roadLayer) {
        state.roadLayer.visible = false;
        console.log('Road layer hidden');
      }
      if (state.roadLayerSwipe) {
        state.roadLayerSwipe.visible = false;
        console.log('Road layer swipe hidden');
      }
    };
    
    // Hide immediately
    hideRoadLayers();
    
    // Also hide after a delay to ensure the layers are loaded
    const timer = setTimeout(hideRoadLayers, 1000);
    
    // Update LA layer visibility when page loads
    updateLALayerVisibility();
    
    // Cleanup: restore road layer visibility when leaving page
    return () => {
      clearTimeout(timer);
      const state = useAppStore.getState();
      if (state.roadLayer) {
        state.roadLayer.visible = true;
      }
      if (state.roadLayerSwipe) {
        state.roadLayerSwipe.visible = true;
      }
    };
  }, [initializeMap, updateLALayerVisibility]);

  // Update visibility when KPI changes
  useEffect(() => {
    updateLALayerVisibility();
    
    // Ensure road layers stay hidden when KPI changes
    if (roadLayer) roadLayer.visible = false;
    if (roadLayerSwipe) roadLayerSwipe.visible = false;
  }, [activeKpi, roadLayer, roadLayerSwipe, updateLALayerVisibility]);

  const headerControls = (
    <div className={styles.headerRight}>
      <Segmented<KPIKey>
        value={activeKpi}
        options={Object.keys(KPI_LABELS).map(k => ({ 
          label: KPI_LABELS[k as KPIKey], 
          value: k as KPIKey 
        }))}
        onChange={(v) => setActiveKpi(v as KPIKey)}
      />
      <Switch 
        checked={showSwipe} 
        onChange={setShowSwipe} 
        checkedChildren="Swipe" 
        unCheckedChildren="Swipe" 
      />
      <Switch 
        checked={themeMode === 'dark'} 
        onChange={(b) => setThemeMode(b ? 'dark' : 'light')} 
        checkedChildren="Dark" 
        unCheckedChildren="Light" 
      />
    </div>
  );

  return withTheme(themeMode, (
    <>
      <Header style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: token.colorBgContainer,
        borderBottom: `1px solid ${token.colorBorder}`,
        padding: '0 16px',
        flexShrink: 0
      }}>
        <Title level={4} style={{ margin: 0 }}>
          {`${KPI_LABELS[activeKpi]} Condition Summary ${leftSwipeYear} vs ${rightSwipeYear}`}
        </Title>
        {headerControls}
      </Header>
      <Content style={{
        flex: 1,
        overflow: 'hidden',
        position: 'relative',
        background: token.colorBgLayout
      }}>
        <div style={{ position: 'relative', width: '100%', height: '100%' }}>
          <div id="conditionViewDiv" style={{ width: '100%', height: '100%' }} />
          <MapWidgets />
          {showSwipe && (
            <div className={styles.swipePanel}>
              <SimpleSwipePanel />
            </div>
          )}
        </div>
      </Content>
    </>
  ));
};

export default ConditionSummaryPage;