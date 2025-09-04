import React from 'react';
import { Card, Statistic, Row, Col, Divider, Tag, Space, Segmented } from 'antd';
import useAppStore from '@/store/useAppStore';
import { CONFIG, KPI_LABELS } from '@/config/appConfig';

const EnhancedStatsPanel: React.FC = () => {
  const { currentStats, currentFilters, setFilters, activeKpi } = useAppStore();

  const yearOptions = CONFIG.filters.year.options.map(o => ({
    label: o.label,
    value: o.value
  }));

  const onYearChange = (newYear: number) => {
    setFilters({ year: [newYear] });
  };
  
  // The first year in the array is the one we display stats for
  const selectedYear = currentFilters.year.length > 0 ? currentFilters.year[0] : null;

  if (!currentStats || currentStats.totalSegments === 0 || !selectedYear) {
    return (
      <Card size="small" title="Summary Statistics">
        <Space direction="vertical" style={{ width: '100%' }}>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Survey Year</div>
          <Segmented
            options={yearOptions}
            value={selectedYear || yearOptions[0].value}
            onChange={(v) => onYearChange(Number(v))}
            block
          />
          <div style={{ marginTop: '12px', textAlign: 'center' }}>
            No data to display. Please apply filters to see summary statistics.
          </div>
        </Space>
      </Card>
    );
  }

  const kpiStats = currentStats.metrics.find(m => m.metric === activeKpi.toUpperCase());
  const kpiTitle = `${KPI_LABELS[activeKpi]}`;

  return (
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
            <Col span={8}><Statistic title="Average" value={kpiStats.average} precision={2} /></Col>
            <Col span={8}><Statistic title="Min" value={kpiStats.min} precision={2} /></Col>
            <Col span={8}><Statistic title="Max" value={kpiStats.max} precision={2} /></Col>
            <Col span={8}><Statistic title="Good (%)" value={kpiStats.goodPct} precision={1} suffix="%" /></Col>
            <Col span={8}><Statistic title="Fair (%)" value={kpiStats.fairPct} precision={1} suffix="%" /></Col>
            <Col span={8}><Statistic title="Poor (%)" value={kpiStats.poorPct} precision={1} suffix="%" /></Col>
          </Row>
          <Divider style={{ margin: '12px 0' }} />
        </div>
      )}
      <div style={{ fontSize: 12, opacity: 0.7 }}>
        Updated for {selectedYear} data: {new Date(currentStats.lastUpdated).toLocaleString()}
      </div>
    </Card>
  );
};

export default EnhancedStatsPanel;
