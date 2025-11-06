// src/components/HeaderControls.tsx
import React, { useState, useEffect } from 'react';
import { Segmented, Switch, Space } from 'antd';
import useAppStore from '@/store/useAppStore';
import { KPI_LABELS, type KPIKey } from '@/config/kpiConfig';

interface HeaderControlsProps {
  visible: boolean; // Only show on Overview page
}

const HeaderControls: React.FC<HeaderControlsProps> = ({ visible }) => {
  const {
    themeMode,
    setThemeMode,
    showFilters,
    setShowFilters,
    showStats,
    setShowStats,
    showChart,
    setShowChart,
    showSwipe,
    setShowSwipe,
    activeKpi,
    setActiveKpi,
  } = useAppStore();

  const [isHoveringChart, setIsHoveringChart] = useState(false);

  // Preload chart component when hovering
  useEffect(() => {
    if (isHoveringChart) {
      import('@/components/EnhancedChartPanel');
    }
  }, [isHoveringChart]);

  if (!visible) {
    return null;
  }

  return (
    <Space size="small">
      {/* KPI Selector */}
      <Segmented<KPIKey>
        value={activeKpi}
        options={Object.keys(KPI_LABELS).map(k => ({
          label: KPI_LABELS[k as KPIKey],
          value: k as KPIKey,
        }))}
        onChange={(v) => setActiveKpi(v as KPIKey)}
        size="small"
      />

      {/* Filter Toggle */}
      <Switch
        checked={showFilters}
        onChange={setShowFilters}
        checkedChildren="Filter"
        unCheckedChildren="Filter"
        size="small"
      />

      {/* Stats Toggle */}
      <Switch
        checked={showStats}
        onChange={setShowStats}
        checkedChildren="Stats"
        unCheckedChildren="Stats"
        size="small"
      />

      {/* Chart Toggle */}
      <div onMouseEnter={() => setIsHoveringChart(true)}>
        <Switch
          checked={showChart}
          onChange={setShowChart}
          checkedChildren="Chart"
          unCheckedChildren="Chart"
          size="small"
        />
      </div>

      {/* Compare Toggle */}
      <Switch
        checked={showSwipe}
        onChange={setShowSwipe}
        checkedChildren="Compare"
        unCheckedChildren="Compare"
        size="small"
      />

      {/* Theme Toggle */}
      <Switch
        checked={themeMode === 'dark'}
        onChange={(isDark) => setThemeMode(isDark ? 'dark' : 'light')}
        checkedChildren="Dark"
        unCheckedChildren="Light"
        size="small"
      />
    </Space>
  );
};

export default HeaderControls;
