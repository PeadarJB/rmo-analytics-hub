import React, { useEffect, useState } from 'react';
import { Card, Statistic, Row, Col, Divider, Tag, Space, Segmented, Spin, Alert } from 'antd';
import useAppStore from '@/store/useAppStore';
import { CONFIG, KPI_LABELS } from '@/config/appConfig';
import { usePanelStyles } from '@/styles/styled';

const EnhancedStatsPanel: React.FC = () => {
  const { 
    currentStats, 
    currentFilters, 
    setFilters, 
    activeKpi, 
    loading,
    updateRenderer,
    calculateStatistics 
  } = useAppStore();
  const [isCalculating, setIsCalculating] = useState(false);

  const yearOptions = CONFIG.filters.year.options.map(o => ({
    label: o.label,
    value: o.value
  }));

  const onYearChange = async (newYear: number) => {
    setFilters({ year: [newYear] });
    // Trigger map re-rendering and statistics recalculation
    updateRenderer();
    await calculateStatistics();
  };

  useEffect(() => {
    setIsCalculating(true);
    const timer = setTimeout(() => setIsCalculating(false), 500);
    return () => clearTimeout(timer);
  }, [currentFilters, activeKpi]);

  // The first year in the array is the one we display stats for
  const selectedYear = currentFilters.year.length > 0 ? currentFilters.year[0] : null;

  const { styles } = usePanelStyles();

  if (isCalculating) {
    return (
      <div className={styles.statsPanel}>
      <Card size="small" title="Summary Statistics">
        <div style={{ textAlign: 'center', padding: '20px' }}>
          <Spin size="large" />
          <div style={{ marginTop: '12px' }}>Calculating statistics...</div>
        </div>
      </Card>
      </div>
    );
  }

  if (!currentStats || currentStats.totalSegments === 0 || !selectedYear) {
    return (
      <div className={styles.statsPanel}>
      <Card size="small" title="Summary Statistics">
        <Space direction="vertical" style={{ width: '100%' }}>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Survey Year</div>
          <Segmented
            options={yearOptions}
            value={selectedYear || yearOptions[0].value}
            onChange={(v) => onYearChange(Number(v))}
            block
          />
          <Alert
            message="No Data Available"
            description="No road segments match your current filter selection. Please adjust your filters to see summary statistics."
            type="info"
            showIcon
            style={{ marginTop: '12px' }}
          />
        </Space>
      </Card>
      </div>
    );
  }

  const kpiStats = currentStats.metrics.find(m => m.metric === activeKpi.toUpperCase());
  const kpiTitle = `${KPI_LABELS[activeKpi]}`;

  return (
    <div className={styles.statsPanel}>
    <Card 
      size="small" 
      title="Summary Statistics"
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
        <Col span={12}><Statistic title="Total Segments" value={currentStats.totalSegments} /></Col>
        <Col span={12}><Statistic title="Total Length (km)" value={currentStats.totalLengthKm} precision={1} /></Col>
      </Row>

      <Divider style={{ margin: '12px 0' }} />
      
      {kpiStats && (
        <div style={{ marginBottom: 12 }}>
          <Row gutter={[8, 8]}>
            <Col span={24}>
              <Tag color="purple" style={{ fontSize: 12, marginBottom: '8px' }}>
                {kpiTitle}
              </Tag>
            </Col>

            {/* Core stats */}
            <Col span={8}><Statistic title="Average" value={kpiStats.average} precision={2} /></Col>
            <Col span={8}><Statistic title="Min" value={kpiStats.min} precision={2} /></Col>
            <Col span={8}><Statistic title="Max" value={kpiStats.max} precision={2} /></Col>

            {/* 5-Class Percentages */}
            <Col span={24}>
              <div style={{ fontSize: 11, fontWeight: 600, marginTop: 8, marginBottom: 4 }}>
                Condition Distribution
              </div>
            </Col>

            <Col span={8}>
              <Statistic
                title={<span style={{ fontSize: 11 }}>Very Good</span>}
                value={kpiStats.veryGoodPct}
                precision={1}
                suffix="%"
                valueStyle={{ fontSize: 14, color: '#52c41a' }}
              />
            </Col>
            <Col span={8}>
              <Statistic
                title={<span style={{ fontSize: 11 }}>Good</span>}
                value={kpiStats.goodPct}
                precision={1}
                suffix="%"
                valueStyle={{ fontSize: 14, color: '#95de64' }}
              />
            </Col>
            <Col span={8}>
              <Statistic
                title={<span style={{ fontSize: 11 }}>Fair</span>}
                value={kpiStats.fairPct}
                precision={1}
                suffix="%"
                valueStyle={{ fontSize: 14, color: '#faad14' }}
              />
            </Col>
            <Col span={8}>
              <Statistic
                title={<span style={{ fontSize: 11 }}>Poor</span>}
                value={kpiStats.poorPct}
                precision={1}
                suffix="%"
                valueStyle={{ fontSize: 14, color: '#ff7875' }}
              />
            </Col>
            <Col span={8}>
              <Statistic
                title={<span style={{ fontSize: 11 }}>Very Poor</span>}
                value={kpiStats.veryPoorPct}
                precision={1}
                suffix="%"
                valueStyle={{ fontSize: 14, color: '#cf1322' }}
              />
            </Col>
          </Row>
          <Divider style={{ margin: '12px 0' }} />
        </div>
      )}

      <div style={{ fontSize: 12, opacity: 0.7 }}>
        Updated for {selectedYear} data: {new Date(currentStats.lastUpdated).toLocaleString()}
      </div>
    </Card>
    </div>
  );
};

export default EnhancedStatsPanel;
