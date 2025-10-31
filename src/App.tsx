import React, { useEffect, useState, lazy, Suspense } from 'react';
import { Layout, Typography, Switch, Segmented, theme, Spin, Card, Tooltip } from 'antd';
import useAppStore from '@/store/useAppStore';
import { withTheme } from '@/config/themeConfig';
import { usePanelStyles } from '@/styles/styled';
import MapWidgets from '@/components/MapWidgets';
import LoadingOverlay from '@/components/LoadingOverlay';
import EnhancedFilterPanel from '@/components/EnhancedFilterPanel';
import EnhancedStatsPanel from '@/components/EnhancedStatsPanel'; 
import EnhancedSwipePanel from '@/components/EnhancedSwipePanel';
import { CONFIG } from '@/config/appConfig';
import { KPI_LABELS, type KPIKey } from '@/config/kpiConfig';

import { BarChartOutlined, LineChartOutlined } from '@ant-design/icons';
// ✅ Lazy load heavy components
const EnhancedChartPanel = lazy(() => import('@/components/EnhancedChartPanel'));

const { Header, Sider, Content } = Layout;
const { Title } = Typography;

const App: React.FC = () => {
  const {
    initializeMap, themeMode, setThemeMode,
    showFilters, setShowFilters,
    showStats, setShowStats,
    showChart, setShowChart, 
    showSwipe, setShowSwipe,
    loading, loadingMessage,
    activeKpi, setActiveKpi
  } = useAppStore();
  const [siderHovered, setSiderHovered] = useState(false);
  const [isHoveringChart, setIsHoveringChart] = useState(false);

  const { styles } = usePanelStyles();
  const { token } = theme.useToken();

  // Preload chart component when hovering over toggle
  useEffect(() => {
    if (isHoveringChart) {
      // This dynamic import tells the bundler to pre-fetch the code for the component.
      import('@/components/EnhancedChartPanel');
    }
  }, [isHoveringChart]);

  // START ADDITION: Restore the header controls
  const headerControls = (
    <div className={styles.headerRight}>
      <Segmented<KPIKey>
        value={activeKpi}
        options={Object.keys(KPI_LABELS).map(k => ({ label: KPI_LABELS[k as KPIKey], value: k as KPIKey }))}
        onChange={(v) => setActiveKpi(v as KPIKey)}
      />
      <Switch 
        checked={showFilters} 
        onChange={setShowFilters} 
        checkedChildren="Filter" 
        unCheckedChildren="Filter"
      />
      <Switch 
        checked={showStats} 
        onChange={setShowStats} 
        checkedChildren="Stats" 
        unCheckedChildren="Stats"
      />
      <div onMouseEnter={() => setIsHoveringChart(true)}>
        <Switch 
          checked={showChart} 
          onChange={setShowChart} 
          checkedChildren="Chart" 
          unCheckedChildren="Chart"
        />
      </div>
      <Switch 
        checked={showSwipe} 
        onChange={setShowSwipe} 
        checkedChildren="Compare" 
        unCheckedChildren="Compare"
      />
      <Switch
        checked={themeMode === 'dark'}
        onChange={(isDark) => setThemeMode(isDark ? 'dark' : 'light')}
        checkedChildren="Dark"
        unCheckedChildren="Light"
      />
    </div>
  );
  // END ADDITION

  // Guarded map init: only for Overview page, and only if container has no children
  useEffect(() => {
    const container = document.getElementById('viewDiv');
    if (container && !container.hasChildNodes()) {
      initializeMap('viewDiv');
    }
  }, [initializeMap]);

  // Overview page content (map + widgets + panels)
  const overviewContent = (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div id="viewDiv" style={{ width: '100%', height: '100%' }} />
      <MapWidgets />
      <LoadingOverlay visible={loading} message={loadingMessage ?? 'Updating map...'} />

      {(showFilters && showChart) ? (
        <div className={styles.panelContainer}>
          <EnhancedFilterPanel />
          <Suspense fallback={
            <Card size="small">
              <div style={{ textAlign: 'center', padding: '20px' }}>
                <Spin size="large" />
                <div style={{ marginTop: '12px' }}>Loading chart...</div>
              </div>
            </Card>
          }>
            <EnhancedChartPanel />
          </Suspense>
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
              <Suspense fallback={
                <Card size="small">
                  <div style={{ textAlign: 'center', padding: '20px' }}>
                    <Spin size="large" />
                    <div style={{ marginTop: '12px' }}>Loading chart...</div>
                  </div>
                </Card>
              }>
                <EnhancedChartPanel />
              </Suspense>
            </div>
          )}
        </>
      )}

      {showStats && (
        <div className={styles.statsPanel}>
          <EnhancedStatsPanel />
        </div>
      )}

      {/* NEW: Add EnhancedSwipePanel, conditionally rendered [cite: RMO_SPRINT_ROADMAP.md] */}
      {showSwipe && (
        <Suspense fallback={<Spin />}>
          <EnhancedSwipePanel />
        </Suspense>
      )}

      {/* REMOVED: LALayerControl component is now integrated into EnhancedSwipePanel [cite: RMO_SPRINT_ROADMAP.md] */}
    </div>
  );

  return withTheme(themeMode, (
    <Layout style={{ height: '100vh', overflow: 'hidden' }}>
      <Sider 
        collapsed={!siderHovered}
        width={220} 
        style={{
          background: token.colorBgLayout,
          borderRight: `1px solid ${token.colorBorder}`,
          overflow: 'hidden',
          transition: 'all 0.3s ease'
        }}
        trigger={null}
        collapsedWidth={60}
        onMouseEnter={() => setSiderHovered(true)}
        onMouseLeave={() => setSiderHovered(false)}
      >
        {/* Sider navigation icons */}
        <div style={{ textAlign: siderHovered ? 'left' : 'center', padding: siderHovered ? '0 12px' : '12px 0' }}>
          <Tooltip title="Overview Dashboard" placement="right">
            <div style={{ color: token.colorPrimary, cursor: 'pointer', padding: '12px', borderRadius: '4px' }}>
              {siderHovered ? 'Overview Dashboard' : <BarChartOutlined style={{ fontSize: 24 }} />}
            </div>
          </Tooltip>
        </div>
      </Sider>

      <Layout style={{ height: '100%', overflow: 'hidden' }}>
        
        {/* START MODIFICATION: Restore original Header structure */}
        <Header style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: themeMode === 'dark' ? '#1F2937' : '#FFFFFF',
          borderBottom: `1px solid ${token.colorBorder}`,
          padding: '0 16px', // Use 16px padding
          flexShrink: 0
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <img 
              src="/img/PMS-Logo-150x150.png" 
              alt="PMS Logo" 
              style={{ height: '40px', width: 'auto' }} 
            />
            <Title 
              level={4} 
              style={{ 
                margin: 0, 
                color: themeMode === 'dark' ? '#F3F4F6' : '#111827'
              }}
            >
              {CONFIG.title}
            </Title>
          </div>
          {headerControls}
        </Header>
        {/* END MODIFICATION */}

        <Content style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
          {overviewContent}
        </Content>
      </Layout>
    </Layout>
  ));
};

export default App;
