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

  useEffect(() => { initializeMap('viewDiv'); }, [initializeMap]);

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

  const content = (
    <div style={{ position:'relative', width:'100%', height:'100%' }}>
      <div id="viewDiv" />
      <MapWidgets />
      {showFilters && <div className={styles.filterPanel}><EnhancedFilterPanel /></div>}
      {showStats && <div className={styles.statsPanel}><EnhancedStatsPanel /></div>}
      {showChart && <div className={styles.chartPanel}><EnhancedChartPanel /></div>}
      {showSwipe && <div className={styles.swipePanel}><SimpleSwipePanel /></div>}
    </div>
  );

  return withTheme(themeMode, (
    <Layout style={{ height: '100vh' }}>
      <Sider collapsible defaultCollapsed width={220} theme="dark">
        <div style={{ color: '#fff', padding: 12, fontWeight: 600 }}>RMO Logo</div>
        <div style={{ color: '#bbb', padding: 12 }}>Overview Page</div>
        <div style={{ color: '#bbb', padding: '0 12px 12px' }}>Condition Summary Page</div>
      </Sider>
      <Layout>
        <Header style={{ display:'flex', alignItems:'center', justifyContent:'space-between', background: token.colorBgContainer }}>
          <Title level={4} style={{ margin: 0 }}>{CONFIG.title}</Title>
          {headerControls}
        </Header>
        <Content>{content}</Content>
      </Layout>
    </Layout>
  ));
};

export default App;
