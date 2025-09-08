import React, { useEffect } from 'react';
import { Layout, Typography, Switch, Space, Segmented, theme, Button } from 'antd';
import useAppStore from '@/store/useAppStore';
import { withTheme } from '@/config/themeConfig';
import { usePanelStyles } from '@/styles/styled';
import MapWidgets from '@/components/MapWidgets';
import EnhancedFilterPanel from '@/components/EnhancedFilterPanel';
import EnhancedStatsPanel from '@/components/EnhancedStatsPanel';
import EnhancedChartPanel from '@/components/EnhancedChartPanel';
import SimpleSwipePanel from '@/components/SimpleSwipePanel';
import { CONFIG, KPI_LABELS, type KPIKey } from '@/config/appConfig';

const { Header, Sider, Content } = Layout;
const { Title } = Typography;

const App: React.FC = () => {
  const {
    initializeMap, themeMode, setThemeMode,
    showFilters, setShowFilters,
    showStats, setShowStats,
    showChart, setShowChart,
    showSwipe, setShowSwipe,
    activeKpi, setActiveKpi
  } = useAppStore();

  const { styles } = usePanelStyles();
  const { token } = theme.useToken();

  // FIX: Use empty dependency array to ensure map is initialized only once
  // This prevents re-initialization when store functions change
  useEffect(() => {
    // Initialize map only once when component mounts
    initializeMap('viewDiv');
    
    // Cleanup function (optional but good practice)
    return () => {
      // The store's initializeMap already handles cleanup via guards,
      // but we can add explicit cleanup here if needed
      console.log('App component unmounting');
    };
  }, []); // Empty dependency array - runs only once on mount

  const headerControls = (
    <div className={styles.headerRight}>
      <Segmented<KPIKey>
        value={activeKpi}
        options={Object.keys(KPI_LABELS).map(k => ({ label: KPI_LABELS[k as KPIKey], value: k as KPIKey }))}
        onChange={(v) => setActiveKpi(v as KPIKey)}
      />
      <Switch checked={showFilters} onChange={setShowFilters} checkedChildren="Filter" unCheckedChildren="Filter" />
      <Switch checked={showStats} onChange={setShowStats} checkedChildren="Stats" unCheckedChildren="Stats" />
      <Switch checked={showChart} onChange={setShowChart} checkedChildren="Chart" unCheckedChildren="Chart" />
      <Switch checked={showSwipe} onChange={setShowSwipe} checkedChildren="Swipe" unCheckedChildren="Swipe" />
      <Switch checked={themeMode==='dark'} onChange={(b)=>setThemeMode(b?'dark':'light')} checkedChildren="Dark" unCheckedChildren="Light" />
    </div>
  );

  // ENSURE: Only one map container div exists
  // The map content is wrapped in a single container with proper structure
  const mapContent = (
    <div style={{ position:'relative', width:'100%', height:'100%' }}>
      {/* Single map container - no duplicates */}
      <div id="viewDiv" style={{ width: '100%', height: '100%' }} />
      
      {/* Map widgets overlay */}
      <MapWidgets />
      
      {/* Wrap filter and chart in shared container when both visible */}
      {(showFilters && showChart) ? (
        <div className={styles.panelContainer}>
          <EnhancedFilterPanel />
          <EnhancedChartPanel />
        </div>
      ) : (
        <>
          {showFilters && (
            <div className={styles.filterPanel}>
              <EnhancedFilterPanel />
            </div>
          )}
          {showChart && (
            <div className={styles.chartPanel}>
              <EnhancedChartPanel />
            </div>
          )}
        </>
      )}
      {showStats && (
        <div className={styles.statsPanel}>
          <EnhancedStatsPanel />
        </div>
      )}
    </div>
  );

  return withTheme(themeMode, (
    <Layout style={{ height: '100vh', overflow: 'hidden' }}>
      <Sider collapsible defaultCollapsed width={220} theme="dark">
        <div style={{ color: '#fff', padding: 12, fontWeight: 600 }}>RMO Logo</div>
        <div style={{ color: '#bbb', padding: 12, cursor: 'pointer' }}>Overview Page</div>
        <div style={{ color: '#bbb', padding: '0 12px 12px', cursor: 'pointer' }}>Condition Summary Page</div>
      </Sider>
      <Layout style={{ height: '100%', overflow: 'hidden' }}>
        <Header style={{ 
          display:'flex', 
          alignItems:'center', 
          justifyContent:'space-between', 
          background: token.colorBgContainer,
          padding: '0 16px',
          flexShrink: 0
        }}>
          <Title level={4} style={{ margin: 0 }}>{CONFIG.title}</Title>
          {headerControls}
        </Header>
        <Content style={{ 
          flex: 1, 
          overflow: 'hidden',
          position: 'relative'
        }}>
          {/* Single map content container */}
          {mapContent}
        </Content>
      </Layout>
    </Layout>
  ));
};

export default App;