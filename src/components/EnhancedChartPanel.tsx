import React, { useEffect, useRef, useState } from 'react';
import { Card, Select, Space } from 'antd';
import Chart from 'chart.js/auto';
import useAppStore from '@/store/useAppStore';
import { CONFIG, KPI_LABELS, type KPIKey } from '@/config/appConfig';

const groupByOptions = [
  { label: 'Local Authority', value: CONFIG.fields.la },
  { label: 'Subgroup', value: CONFIG.fields.subgroup },
  { label: 'Route', value: CONFIG.fields.route },
  { label: 'Year', value: CONFIG.fields.year }
];

const EnhancedChartPanel: React.FC = () => {
  const { roadLayer, activeKpi } = useAppStore();
  const [groupBy, setGroupBy] = useState(CONFIG.defaultGroupBy);
  const chartRef = useRef<HTMLCanvasElement | null>(null);
  const chartInstance = useRef<Chart | null>(null);

  useEffect(() => {
    // Build placeholder grouped data (random) if no layer
    const labels = ['Group A', 'Group B', 'Group C', 'Group D'];
    const values = labels.map(() => Math.round(5 + Math.random() * 5));

    if (chartInstance.current) {
      chartInstance.current.destroy();
      chartInstance.current = null;
    }
    if (chartRef.current) {
      chartInstance.current = new Chart(chartRef.current, {
        type: 'bar',
        data: {
          labels,
          datasets: [{ label: `Avg ${KPI_LABELS[activeKpi]} by ${groupBy}`, data: values }]
        }
      });
    }
  }, [groupBy, activeKpi, roadLayer]);

  return (
    <Card size="small" title="Charts">
      <Space direction="vertical" style={{ width: '100%' }}>
        <div>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Group By</div>
          <Select
            style={{ width: '100%' }}
            options={groupByOptions}
            value={groupBy}
            onChange={(v) => setGroupBy(v)}
          />
        </div>
        <canvas ref={chartRef} height={220} />
      </Space>
    </Card>
  );
};

export default EnhancedChartPanel;
