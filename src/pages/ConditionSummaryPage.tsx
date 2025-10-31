import React, { useEffect } from 'react';
import { Layout, Typography, Switch, Space, Segmented, theme } from 'antd';
import useAppStore from '@/store/useAppStore';
import { withTheme } from '@/config/themeConfig';
import { usePanelStyles } from '@/styles/styled';
import MapWidgets from '@/components/MapWidgets';
import LoadingOverlay from '@/components/LoadingOverlay';
// import SimpleSwipePanel from '@/components/SimpleSwipePanel';
import EnhancedSwipePanel from '@/components/EnhancedSwipePanel';
import { KPI_LABELS, type KPIKey } from '@/config/kpiConfig';

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
    leftSwipeYear,
    rightSwipeYear,
    loading,
    loadingMessage,
  } = useAppStore();

  const { styles } = usePanelStyles();
  const { token } = theme.useToken();

  useEffect(() => {
    // Initialize map if not already done
    const container = document.getElementById('conditionViewDiv');
    if (container && !container.hasChildNodes()) {
      initializeMap('conditionViewDiv');
    }
    
    // MODIFICATION START: The store now handles showing/hiding layers when the page changes.
    // This effect now only needs to ensure the correct LA polygon layers are visible when this page is active.
    updateLALayerVisibility();
    // MODIFICATION END
    
  }, [initializeMap, updateLALayerVisibility]);

  // Update visibility when KPI changes
  useEffect(() => {
    updateLALayerVisibility();
  }, [activeKpi, updateLALayerVisibility]);

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
          <LoadingOverlay visible={loading} message={loadingMessage ?? 'Updating map...'} />
          {showSwipe && (
            <div className={styles.swipePanel}>
              <EnhancedSwipePanel />
            </div>
          )}
        </div>
      </Content>
    </>
  ));
};

export default ConditionSummaryPage;
