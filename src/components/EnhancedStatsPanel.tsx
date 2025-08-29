import React from 'react';
import { Card, Statistic, Row, Col, Divider, Tag } from 'antd';
import useAppStore from '@/store/useAppStore';

const EnhancedStatsPanel: React.FC = () => {
  const { currentStats } = useAppStore();

  if (!currentStats) {
    return <Card size="small" title="Impact Analysis">
      <div>No selection yet. Apply filters to see summary statistics.</div>
    </Card>;
  }

  const { totalSegments, totalLengthKm, metrics, lastUpdated } = currentStats;

  return (
    <Card size="small" title="Summary Statistics">
      <Row gutter={[12, 12]}>
        <Col span={12}><Statistic title="Total Segments" value={totalSegments} /></Col>
        <Col span={12}><Statistic title="Total Length (km)" value={totalLengthKm} precision={1} /></Col>
      </Row>

      <Divider />
      {metrics.map((m) => (
        <div key={m.metric} style={{ marginBottom: 12 }}>
          <Row gutter={[8, 8]}>
            <Col span={24}><Tag color="purple" style={{ fontSize: 12 }}>{m.metric}</Tag></Col>
            <Col span={8}><Statistic title="Average" value={m.average} precision={2} /></Col>
            <Col span={8}><Statistic title="Min" value={m.min} precision={2} /></Col>
            <Col span={8}><Statistic title="Max" value={m.max} precision={2} /></Col>
            <Col span={8}><Statistic title="Good (%)" value={m.goodPct} precision={1} /></Col>
            <Col span={8}><Statistic title="Fair (%)" value={m.fairPct} precision={1} /></Col>
            <Col span={8}><Statistic title="Poor (%)" value={m.poorPct} precision={1} /></Col>
          </Row>
          <Divider />
        </div>
      ))}
      <div style={{ fontSize: 12, opacity: 0.7 }}>Updated: {new Date(lastUpdated).toLocaleString()}</div>
    </Card>
  );
};

export default EnhancedStatsPanel;
