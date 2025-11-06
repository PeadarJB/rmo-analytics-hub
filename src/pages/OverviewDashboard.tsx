// src/pages/OverviewDashboard.tsx
import React, { useEffect, lazy, Suspense } from 'react';
import { Spin, Card } from 'antd';
import useAppStore from '@/store/useAppStore';
import { usePanelStyles } from '@/styles/styled';
import MapWidgets from '@/components/MapWidgets';
import LoadingOverlay from '@/components/LoadingOverlay';
import EnhancedFilterPanel from '@/components/EnhancedFilterPanel';
import EnhancedStatsPanel from '@/components/EnhancedStatsPanel';
import EnhancedSwipePanel from '@/components/EnhancedSwipePanel';

// Lazy load heavy components
const EnhancedChartPanel = lazy(() => import('@/components/EnhancedChartPanel'));

const OverviewDashboard: React.FC = () => {
  const {
    initializeMapWithWebMap,
    showFilters,
    showStats,
    showChart,
    showSwipe,
    loading,
    loadingMessage,
  } = useAppStore();

  const { styles } = usePanelStyles();

  useEffect(() => {
    const container = document.getElementById('viewDiv');
    if (container) {
      initializeMapWithWebMap('viewDiv');
    }
  }, [initializeMapWithWebMap]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      {/* NO HEADER CONTROLS HERE - They're in App.tsx now */}

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
