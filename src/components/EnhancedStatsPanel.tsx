import React, { useEffect, useState } from 'react';
import { Card, Statistic, Row, Col, Divider, Tag, Space, Segmented, Spin, Alert, theme } from 'antd';
import useAppStore from '@/store/useAppStore';
import { KPI_LABELS } from '@/config/kpiConfig';

const EnhancedStatsPanel: React.FC = () => {
  const { 
    currentStats, 
    currentFilters, 
    setFilters, 
    activeKpi, 
    loading,
    updateRenderer,
    calculateStatistics,
    chartFilteredStats,
    isChartFilterActive,
    isCalculatingChartStats,
    chartSelections,
    themeMode // ADD: Get theme mode
  } = useAppStore();
  const [isCalculating, setIsCalculating] = useState(false);
  const { token } = theme.useToken();
  
  const yearOptions = [
    { label: '2011', value: 2011 },
    { label: '2018', value: 2018 },
    { label: '2025', value: 2025 }
  ];

  const onYearChange = async (newYear: number) => {
    setFilters({ year: newYear });
    // Trigger map re-rendering and statistics recalculation
    updateRenderer();
    await calculateStatistics();
  };

  useEffect(() => {
    setIsCalculating(true);
    const timer = setTimeout(() => setIsCalculating(false), 500);
    return () => clearTimeout(timer);
  }, [currentFilters, activeKpi]);

  // Get the current selected year
  const selectedYear = currentFilters.year || null;

  // Determine which stats to display
  const displayStats = isChartFilterActive ? chartFilteredStats : currentStats;
  const isStatsCalculating = isCalculating || isCalculatingChartStats;

  if (isStatsCalculating) {
    return (
      <Card size="small" title={
        <Space>
          Summary Statistics
          {isChartFilterActive && (
            <Tag color="blue">
              Chart Filtered ({chartSelections.length})
            </Tag>
          )}
        </Space>
      }>
        <div style={{ textAlign: 'center', padding: '20px' }}>
          <Spin size="large" />
          <div style={{ marginTop: '12px', color: token.colorText }}>
            {isChartFilterActive ? 'Calculating chart selection statistics...' : 'Calculating statistics...'}
          </div>
        </div>
      </Card>
    );
  }

  if (!displayStats || displayStats.totalSegments === 0 || !selectedYear) {
    return (
      <Card size="small" title={
        <Space>
          Summary Statistics
          {isChartFilterActive && (
            <Tag color="blue">
              Chart Filtered ({chartSelections.length})
            </Tag>
          )}
        </Space>
      }>
        <Space direction="vertical" style={{ width: '100%' }}>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Survey Year</div>
          <Segmented
            options={yearOptions}
            value={selectedYear || yearOptions[0].value}
            onChange={(v) => onYearChange(Number(v))}
            block
          />
          {/* FIXED: Proper styling for dark mode alert */}
          <Alert
            message="No Data Available"
            description="No road segments match your current filter selection. Please adjust your filters to see summary statistics."
            type="info"
            showIcon
            style={{ 
              marginTop: '12px',
              backgroundColor: themeMode === 'dark' ? token.colorBgElevated : token.colorInfoBg,
              border: `1px solid ${token.colorBorder}`,
              color: token.colorText
            }}
          />
        </Space>
      </Card>
    );
  }

  // FIXED: No longer need kpiStats, displayStats is the correct object
  const kpiTitle = `${KPI_LABELS[activeKpi]}`;

  return (
    <Card
      size="small" 
      title={
        <Space>
          Summary Statistics
          {isChartFilterActive && (
            <Tag color="blue">
              Chart Filtered ({chartSelections.length})
            </Tag>
          )}
        </Space>
      }
      extra={
        <Space>
          <div style={{ fontWeight: 600, marginRight: 6 }}>Survey Year</div>
          <Segmented
            options={yearOptions}
            value={selectedYear}
            onChange={(v) => onYearChange(Number(v))}
            size="small"
          />
        </Space>
      }
    >
      <Row gutter={[12, 12]}>
        <Col span={12}><Statistic title="Total Segments" value={displayStats.totalSegments} /></Col>
        <Col span={12}><Statistic title="Total Length (km)" value={displayStats.totalLengthKm} precision={1} /></Col>
      </Row>

      <Divider style={{ margin: '12px 0' }} />
      
      {/* FIXED: Check displayStats directly */}
      {displayStats && (
        <div style={{ marginBottom: 12 }}>
          <Row gutter={[8, 8]}>
            <Col span={24}>
              <Tag color="purple" style={{ fontSize: 12, marginBottom: '8px' }}>
                {kpiTitle}
              </Tag>
            </Col>

            {/* Core stats - FIXED: Use avgValue, minValue, maxValue */}
            <Col span={8}><Statistic title="Average" value={displayStats.avgValue} precision={2} /></Col>
            <Col span={8}><Statistic title="Min" value={displayStats.minValue} precision={2} /></Col>
            <Col span={8}><Statistic title="Max" value={displayStats.maxValue} precision={2} /></Col>

            <Divider style={{ margin: '12px 0' }} />

            {/* 5-Class Percentages */}
            <Col span={24}>
              <div style={{ fontSize: 14, fontWeight: 600, marginTop: 8, marginBottom: 4 }}>
                Condition Distribution
              </div>
            </Col>

            <Col span={8}>
              <Statistic
                title={<span style={{ fontSize: 14, fontWeight: 600, }}>Very Good</span>}
                value={displayStats.veryGoodPct}
                precision={1}
                suffix="%"
                valueStyle={{ fontWeight: 600, color: token.colorSuccess }}
              />
            </Col>
            <Col span={8}>
              <Statistic
                title={<span style={{ fontSize: 14, fontWeight: 600 }}>Good</span>}
                value={displayStats.goodPct}
                precision={1}
                suffix="%"
                valueStyle={{ fontWeight: 600, color: token.green4 }}
              />
            </Col>
            <Col span={8}>
              <Statistic
                title={<span style={{ fontSize: 14, fontWeight: 600 }}>Fair</span>}
                value={displayStats.fairPct}
                precision={1}
                suffix="%"
                valueStyle={{ fontWeight: 600, color: token.colorWarning }}
              />
            </Col>
            <Col span={8}>
              <Statistic
                title={<span style={{ fontSize: 14, fontWeight: 600 }}>Poor</span>}
                value={displayStats.poorPct}
                precision={1}
                suffix="%"
                valueStyle={{ fontWeight: 600, color: token.orange5 }}
              />
            </Col>
            <Col span={8}>
              <Statistic
                title={<span style={{ fontSize: 14, fontWeight: 600 }}>Very Poor</span>}
                value={displayStats.veryPoorPct}
                precision={1}
                suffix="%"
                valueStyle={{ fontWeight: 600, color: token.colorError }}
              />
            </Col>
          </Row>
          {isChartFilterActive && chartSelections.length > 0 && (
            <>
              <Divider style={{ margin: '12px 0' }} />
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>
                Chart Selections
              </div>
              <div style={{ fontSize: 12, color: token.colorTextSecondary }}>
                {chartSelections.map((sel, index) => (
                  <div key={index} style={{ marginBottom: 4 }}>
                    • {sel.group} - {sel.condition.replace(/([A-Z])/g, ' $1').toLowerCase()} ({KPI_LABELS[sel.kpi]} {sel.year})
                  </div>
                ))}
              </div>
            </>
          )}
          <Divider style={{ margin: '12px 0' }} />
        </div>
      )}

      <div style={{ fontSize: 12, opacity: 0.7, color: token.colorTextSecondary }}>
        {/* FIXED: Use lastUpdated from displayStats */}
        {isChartFilterActive ? 'Chart selection data' : `Updated for ${selectedYear} data`}: {new Date(displayStats.lastUpdated).toLocaleString()}
      </div>
    </Card>
  );
};

export default EnhancedStatsPanel;