// src/pages/OverviewDashboard.tsx
import React, { useEffect, useState, lazy, Suspense } from 'react';
import { Segmented, Switch, Spin, Card } from 'antd';
import useAppStore from '@/store/useAppStore';
import { usePanelStyles } from '@/styles/styled';
import MapWidgets from '@/components/MapWidgets';
import LoadingOverlay from '@/components/LoadingOverlay';
import EnhancedFilterPanel from '@/components/EnhancedFilterPanel';
import EnhancedStatsPanel from '@/components/EnhancedStatsPanel'; 
import EnhancedSwipePanel from '@/components/EnhancedSwipePanel';
import { KPI_LABELS, type KPIKey } from '@/config/kpiConfig';

// Lazy load heavy components
const EnhancedChartPanel = lazy(() => import('@/components/EnhancedChartPanel'));

const OverviewDashboard: React.FC = () => {
  const {
    initializeMap, themeMode, setThemeMode,
    showFilters, setShowFilters,
    showStats, setShowStats,
    showChart, setShowChart, 
    showSwipe, setShowSwipe,
    loading, loadingMessage,
    activeKpi, setActiveKpi
  } = useAppStore();
  
  const [isHoveringChart, setIsHoveringChart] = useState(false);
  const { styles } = usePanelStyles();

  // Preload chart component when hovering over toggle
  useEffect(() => {
    if (isHoveringChart) {
      import('@/components/EnhancedChartPanel');
    }
  }, [isHoveringChart]);

  useEffect(() => {
    const container = document.getElementById('viewDiv');
    if (container) {
      initializeMap('viewDiv');
    }
  }, [initializeMap]);

  // Header controls for Overview Dashboard
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

  // Render header controls into portal on mount
  useEffect(() => {
    const portal = document.getElementById('header-controls-portal');
    if (portal) {
      // This will be handled by React portals in a production implementation
      // For now, we'll render controls inline
    }
  }, []);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      {/* Render header controls at top-right of content area */}
      <div style={{ 
        position: 'absolute', 
        top: '16px', 
        right: '16px', 
        zIndex: 10,
        display: 'flex',
        gap: '8px'
      }}>
        {headerControls}
      </div>

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

      {showSwipe && (
        <Suspense fallback={<Spin />}>
          <EnhancedSwipePanel />
        </Suspense>
      )}
    </div>
  );
};

export default OverviewDashboard;
