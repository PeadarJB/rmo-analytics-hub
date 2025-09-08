import React, { useEffect, useRef, useState } from 'react';
import { Card, Select, Space, Spin, Alert, theme } from 'antd';
import Chart from 'chart.js/auto';
import useAppStore from '@/store/useAppStore';
import { CONFIG, KPI_LABELS, type KPIKey, getKPIFieldName } from '@/config/appConfig';
import QueryService from '@/services/QueryService';

// Define the grouping options for the chart
const groupByOptions = [
  { label: 'Local Authority', value: CONFIG.fields.la },
  { label: 'Route', value: CONFIG.fields.route }
  // Subgroup removed - requires special query handling (boolean fields)
];

const EnhancedChartPanel: React.FC = () => {
  const { roadLayer, activeKpi, currentFilters } = useAppStore();
  const { token } = theme.useToken();
  const chartRef = useRef<HTMLCanvasElement | null>(null);
  const chartInstance = useRef<Chart | null>(null);

  const [groupBy, setGroupBy] = useState(CONFIG.defaultGroupBy);
  const [groupedData, setGroupedData] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // This effect runs whenever a key dependency changes
    const fetchAndRenderChart = async () => {
      setLoading(true);
      setError(null);
      
      const year = currentFilters.year.length > 0 ? currentFilters.year[0] : CONFIG.defaultYears[0];
      const kpiField = getKPIFieldName(activeKpi as KPIKey, year);
      
      // The WHERE clause is defined on the feature layer
      const whereClause = (roadLayer as any)?.definitionExpression || '1=1';

      try {
        const data = await QueryService.computeGroupedStatistics(
          roadLayer,
          kpiField,
          groupBy,
          whereClause
        );
        
        if (!data || data.length === 0) {
          setError("No data found for the current selection. Please adjust your filters.");
          setGroupedData([]);
        } else {
          setGroupedData(data);
          setError(null);
        }
      } catch (e: any) {
        console.error('Error fetching grouped data:', e);
        setError(`Failed to load chart data. Error: ${e.message}`);
        setGroupedData([]);
      } finally {
        setLoading(false);
      }
    };

    fetchAndRenderChart();

  }, [roadLayer, activeKpi, currentFilters, groupBy]);
  
  useEffect(() => {
    if (!chartRef.current || loading || error) return;

    // Chart.js data and configuration
    const labels = groupedData.map(d => d.group);
    const values = groupedData.map(d => d.avgValue);

    const data = {
      labels,
      datasets: [{
        label: `Avg ${KPI_LABELS[activeKpi]}`,
        data: values,
        backgroundColor: token.colorPrimary,
        borderRadius: 4,
        barPercentage: 1.0
      }]
    };

    const options: any = {
      indexAxis: 'y', // ADD THIS LINE - makes bars horizontal
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        title: {
          display: true,
          text: `Average ${KPI_LABELS[activeKpi]} by ${groupByOptions.find(o => o.value === groupBy)?.label || groupBy}`
        },
      },
      scales: {
        y: {  // SWAP x and y axis configs
          title: {
            display: true,
            text: groupByOptions.find(o => o.value === groupBy)?.label || groupBy
          }
        },
        x: {  // SWAP x and y axis configs
          beginAtZero: true,
          title: {
            display: true,
            text: `Average Value`
          }
        }
      }
    };

    // Destroy existing chart instance before creating a new one
    if (chartInstance.current) {
      chartInstance.current.destroy();
    }

    // Create new chart instance
    chartInstance.current = new Chart(chartRef.current, { type: 'bar', data, options });

    // Cleanup function
    return () => {
      if (chartInstance.current) {
        chartInstance.current.destroy();
        chartInstance.current = null;
      }
    };

  }, [groupedData, activeKpi, groupBy, loading, error, token]);

  const cardContent = () => {
    if (loading) {
      return (
        <div style={{ textAlign: 'center', padding: '50px 0' }}>
          <Spin size="large" />
          <div style={{ marginTop: '16px' }}>Fetching data...</div>
        </div>
      );
    }
    
    if (error) {
      return (
        <Alert
          message="Error"
          description={error}
          type="error"
          showIcon
          style={{ margin: '12px 0' }}
        />
      );
    }
    
    return <canvas ref={chartRef} height={700} />; // increased height
  };

  return (
    <Card 
      size="small" 
      title="Charts"
      style={{ minHeight: '500px' }}  // ADD THIS
      extra={
        <Select
          style={{ width: 180 }}
          options={groupByOptions}
          value={groupBy}
          onChange={(v) => setGroupBy(v)}
          size="small"
        />
      }
    >
      <Space direction="vertical" style={{ width: '100%' }}>
        {cardContent()}
      </Space>
    </Card>
  );
};

export default EnhancedChartPanel;
