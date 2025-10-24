import React, { useEffect, useState } from 'react';
import { Layout, Typography, Switch, Segmented, theme } from 'antd';
import useAppStore from '@/store/useAppStore';
import { withTheme } from '@/config/themeConfig';
import { usePanelStyles } from '@/styles/styled';
import MapWidgets from '@/components/MapWidgets';
import EnhancedFilterPanel from '@/components/EnhancedFilterPanel';
import EnhancedStatsPanel from '@/components/EnhancedStatsPanel';
import EnhancedChartPanel from '@/components/EnhancedChartPanel';
import LALayerControl from '@/components/LALayerControl';
import ConditionSummaryPage from '@/pages/ConditionSummaryPage';
import { CONFIG, KPI_LABELS, type KPIKey } from '@/config/appConfig';

const { Header, Sider, Content } = Layout;
const { Title } = Typography;

const App: React.FC = () => {
  const {
    initializeMap, themeMode, setThemeMode,
    showFilters, setShowFilters,
    showStats, setShowStats,
    showChart, setShowChart,
    activeKpi, setActiveKpi,
    currentPage, setCurrentPage,
  } = useAppStore();
  const [siderHovered, setSiderHovered] = useState(false);

  const { styles } = usePanelStyles();
  const { token } = theme.useToken();

  // Guarded map init: only for Overview page, and only if container has no children
  useEffect(() => {
    if (currentPage !== 'overview') return;
    const container = document.getElementById('viewDiv');
    if (container && !container.hasChildNodes()) {
      initializeMap('viewDiv');
    }
    return () => {
      // No-op: store handles cleanup if needed
    };
  }, [currentPage, initializeMap]);

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
      <Switch 
        checked={showChart} 
        onChange={setShowChart} 
        checkedChildren="Chart" 
        unCheckedChildren="Chart"
      />
      <Switch
        checked={themeMode === 'dark'}
        onChange={(isDark) => {
          const newMode = isDark ? 'dark' : 'light';
          setThemeMode(newMode);
        }}
        checkedChildren="Dark"
        unCheckedChildren="Light"
      />
    </div>
  );

  // Overview page content (map + widgets + panels)
  const overviewContent = (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div id="viewDiv" style={{ width: '100%', height: '100%' }} />
      <MapWidgets />

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
              <LALayerControl />
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

  // FIXED: Better color calculation for sider items
  const getSiderTextColor = (active: boolean): string => {
    if (active) {
      return token.colorPrimary;
    }
    // For dark mode, use a lighter color; for light mode, use the secondary text color
    return themeMode === 'dark' ? '#D1D5DB' : token.colorTextSecondary;
  };

  const baseItemStyle: React.CSSProperties = {
    cursor: 'pointer',
    borderLeft: '3px solid transparent',
    transition: 'all 0.2s ease',
    borderRadius: 4,
  };

  const activeItemStyle = (active: boolean, pad: string | number): React.CSSProperties => ({
    ...baseItemStyle,
    color: getSiderTextColor(active),
    padding: pad,
    background: active ? token.colorPrimaryBg : 'transparent',
    borderLeftColor: active ? token.colorPrimary : 'transparent',
    fontWeight: active ? 600 : 400,
  });

  return withTheme(themeMode, (
    <Layout style={{ height: '100vh', overflow: 'hidden' }}>
      <Sider 
        collapsed={!siderHovered}
        width={220} 
        style={{
          background: token.colorBgLayout,
          borderRight: `1px solid ${token.colorBorder}`,
          transition: 'all 0.3s ease',
          overflow: 'hidden'
        }}
        trigger={null}
        collapsedWidth={60}
        onMouseEnter={() => setSiderHovered(true)}
        onMouseLeave={() => setSiderHovered(false)}
      >
        {/* Logo */}
        <div style={{ 
          padding: 12, 
          textAlign: 'center',
        }}>
          <img src="/img/RMO_Logo.png" alt="RMO Logo" style={{ 
            height: '50%',
            transition: 'all 0.3s ease',
            maxWidth: siderHovered ? '70%' : '32px' 
          }} />
        </div>

        {/* Sider navigation with conditional text */}
        <button
          style={{
            ...activeItemStyle(currentPage === 'overview', 12),
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            background: 'none',
            border: 'none',
            width: '100%',
            textAlign: 'left',
            padding: 0,
            cursor: 'pointer'
          }}
          onClick={() => setCurrentPage('overview')}
        >
          <div style={{ padding: 12 }}>
            {siderHovered ? 'Overview Page' : '📊'}
          </div>
        </button>
        <button
          style={{
            ...activeItemStyle(currentPage === 'condition-summary', '0 12px 12px'),
            whiteSpace: 'nowrap', 
            overflow: 'hidden',
            background: 'none',
            border: 'none',
            width: '100%',
            textAlign: 'left',
            padding: 0,
            cursor: 'pointer'
          }}
          onClick={() => setCurrentPage('condition-summary')}
        >
          <div style={{ padding: '0 12px 12px' }}>
            {siderHovered ? 'Condition Summary Page' : '📈'}
          </div>
        </button>
      </Sider>

      <Layout style={{ height: '100%', overflow: 'hidden' }}>
        {currentPage === 'overview' ? (
          <>
            {/* FIXED: Explicit dark mode header styling */}
            <Header style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: themeMode === 'dark' ? '#1F2937' : '#FFFFFF',
              borderBottom: `1px solid ${token.colorBorder}`,
              padding: '0 16px',
              flexShrink: 0
            }}>
              <Title 
                level={4} 
                style={{ 
                  margin: 0, 
                  color: themeMode === 'dark' ? '#F3F4F6' : '#111827'
                }}
              >
                {CONFIG.title}
              </Title>
              {headerControls}
            </Header>

            <Content style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
              {overviewContent}
            </Content>
          </>
        ) : (
          // ConditionSummaryPage renders its own Header + Content
          <ConditionSummaryPage />
        )}
      </Layout>
    </Layout>
  ));
};

export default App;