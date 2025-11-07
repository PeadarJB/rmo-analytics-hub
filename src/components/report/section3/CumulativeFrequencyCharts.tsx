// src/components/report/section3/CumulativeFrequencyCharts.tsx
import React, { useEffect, useState, useMemo } from 'react';
import { Card, Radio, Spin, Alert, Space, Switch, Statistic, Row, Col, theme, Progress } from 'antd';
import type { RadioChangeEvent } from 'antd';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  ChartOptions
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { KPIKey, KPI_LABELS } from '@/config/kpiConfig';
import useAppStore from '@/store/useAppStore';
import CumulativeFrequencyService, { CumulativeData } from '@/services/CumulativeFrequencyService';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

// CumulativeData is now imported from CumulativeFrequencyService

interface CumulativeFrequencyChartsProps {
  year?: number;
}

/**
 * Cumulative Frequency Charts Component
 *
 * Displays cumulative frequency distribution plots for all KPIs:
 * - Figure 3.1: Average IRI Cumulative Frequency Plot
 * - Figure 3.2: Left Rut Cumulative Frequency Plot
 * - Figure 3.3: Mean Profile Depth Cumulative Frequency Plot
 * - Figure 3.4: SCRIM CSC Cumulative Frequency Plot
 * - Figure 3.5: PSCI Cumulative Frequency Plot
 */
const CumulativeFrequencyCharts: React.FC<CumulativeFrequencyChartsProps> = ({
  year = 2025
}) => {
  const { token } = theme.useToken();
  const { roadLayer, themeMode } = useAppStore();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedKPI, setSelectedKPI] = useState<KPIKey>('iri');
  const [showGrid, setShowGrid] = useState(true);
  const [compareYears, setCompareYears] = useState(false);

  // Store cumulative data for all KPIs
  const [cumulativeData, setCumulativeData] = useState<Record<KPIKey, CumulativeData> | null>(null);
  const [comparisonData, setComparisonData] = useState<Record<KPIKey, CumulativeData> | null>(null);

  // Progress tracking
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingMessage, setLoadingMessage] = useState('Initializing...');

  // KPI configuration with ranges and colors
  const kpiConfigs: Record<KPIKey, {
    ranges: { min: number; max: number; step: number };
    unit: string;
    color: string;
    label: string;
  }> = {
    iri: {
      ranges: { min: 0, max: 12, step: 0.1 },
      unit: 'mm/m',
      color: '#1890ff',
      label: 'Average IRI'
    },
    rut: {
      ranges: { min: 0, max: 30, step: 0.5 },
      unit: 'mm',
      color: '#52c41a',
      label: 'Left Rut Depth'
    },
    mpd: {
      ranges: { min: 0, max: 3, step: 0.05 },
      unit: 'mm',
      color: '#faad14',
      label: 'Mean Profile Depth'
    },
    csc: {
      ranges: { min: 0, max: 1, step: 0.01 },
      unit: '',
      color: '#f5222d',
      label: 'SCRIM CSC'
    },
    psci: {
      ranges: { min: 1, max: 10, step: 0.1 },
      unit: '',
      color: '#722ed1',
      label: 'PSCI'
    },
    lpv3: {
      ranges: { min: 0, max: 20, step: 0.2 },
      unit: '',
      color: '#13c2c2',
      label: 'LPV'
    }
  };

  /**
   * Fetch cumulative data for all KPIs using the optimized service
   * This now queries all KPIs in parallel instead of sequentially
   */
  const fetchCumulativeData = async (targetYear: number) => {
    if (!roadLayer) {
      throw new Error('Road layer not available');
    }

    console.log('[CumulativeFrequencyCharts] Fetching data for year:', targetYear);

    const kpiKeys: KPIKey[] = ['iri', 'rut', 'mpd', 'csc', 'psci'];

    // Fetch all KPIs in parallel with progress tracking
    const results = await CumulativeFrequencyService.fetchCumulativeDataForAllKPIs(
      roadLayer,
      kpiKeys,
      targetYear,
      kpiConfigs,
      (kpi, index, total) => {
        // Update progress as each KPI completes
        const progress = Math.round((index / total) * 100);
        setLoadingProgress(progress);
        setLoadingMessage(`Loading ${KPI_LABELS[kpi]} (${index}/${total})...`);
      }
    );

    return results;
  };

  // Load data on mount or when year/comparison changes
  useEffect(() => {
    const loadData = async () => {
      if (!roadLayer) {
        setError('Road layer not available');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        setLoadingProgress(0);
        setLoadingMessage('Initializing...');

        // Fetch current year data
        setLoadingMessage(`Loading ${year} data...`);
        const currentData = await fetchCumulativeData(year);
        setCumulativeData(currentData);

        // Optionally fetch comparison data (2018)
        if (compareYears) {
          setLoadingProgress(50);
          setLoadingMessage('Loading 2018 comparison data...');
          const compareData = await fetchCumulativeData(2018);
          setComparisonData(compareData);
        } else {
          setComparisonData(null);
        }

        setLoadingProgress(100);
        setLoadingMessage('Complete!');
      } catch (err) {
        console.error('Error loading cumulative data:', err);
        setError('Failed to load cumulative frequency data');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [roadLayer, year, compareYears]);

  // Prepare chart data
  const chartData = useMemo(() => {
    if (!cumulativeData || !cumulativeData[selectedKPI]) {
      return null;
    }

    const current = cumulativeData[selectedKPI];
    const config = kpiConfigs[selectedKPI];

    const datasets = [
      {
        label: `${config.label} ${year}`,
        data: current.dataPoints.map(d => d.cumulativePercent),
        borderColor: config.color,
        backgroundColor: `${config.color}22`,
        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 4,
        tension: 0.4,
        fill: true
      }
    ];

    // Add comparison dataset if enabled
    if (compareYears && comparisonData && comparisonData[selectedKPI]) {
      const comparison = comparisonData[selectedKPI];
      datasets.push({
        label: `${config.label} 2018`,
        data: comparison.dataPoints.map(d => d.cumulativePercent),
        borderColor: '#8c8c8c',
        backgroundColor: '#8c8c8c22',
        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 4,
        tension: 0.4,
        fill: false
      });
    }

    return {
      labels: current.dataPoints.map(d => d.value.toFixed(2)),
      datasets
    };
  }, [cumulativeData, comparisonData, selectedKPI, year, compareYears, kpiConfigs]);

  // Chart options
  const chartOptions: ChartOptions<'line'> = useMemo(() => {
    const config = kpiConfigs[selectedKPI];

    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          position: 'top' as const,
          labels: {
            color: themeMode === 'dark' ? token.colorTextBase : token.colorText,
            font: { size: 12 },
            usePointStyle: true
          }
        },
        tooltip: {
          mode: 'index',
          intersect: false,
          callbacks: {
            label: (context) => {
              const y = context.parsed.y ?? 0;
              return `${context.dataset.label}: ${y.toFixed(1)}% ≤ ${context.label}${config.unit}`;
            }
          }
        }
      },
      scales: {
        x: {
          title: {
            display: true,
            text: `${config.label} (${config.unit})`,
            color: themeMode === 'dark' ? token.colorTextBase : token.colorText,
            font: { size: 13, weight: 'bold' }
          },
          ticks: {
            color: themeMode === 'dark' ? token.colorTextSecondary : token.colorTextSecondary,
            maxTicksLimit: 15
          },
          grid: {
            display: showGrid,
            color: themeMode === 'dark' ? token.colorBorderSecondary : token.colorBorder
          }
        },
        y: {
          title: {
            display: true,
            text: 'Cumulative Percentage (%)',
            color: themeMode === 'dark' ? token.colorTextBase : token.colorText,
            font: { size: 13, weight: 'bold' }
          },
          min: 0,
          max: 100,
          ticks: {
            color: themeMode === 'dark' ? token.colorTextSecondary : token.colorTextSecondary,
            callback: (value) => `${value}%`
          },
          grid: {
            display: showGrid,
            color: themeMode === 'dark' ? token.colorBorderSecondary : token.colorBorder
          }
        }
      },
      interaction: {
        mode: 'nearest',
        axis: 'x',
        intersect: false
      }
    };
  }, [selectedKPI, showGrid, themeMode, token, kpiConfigs]);

  // Handle KPI selection change
  const handleKPIChange = (e: RadioChangeEvent) => {
    setSelectedKPI(e.target.value as KPIKey);
  };

  if (loading) {
    return (
      <div style={{
        height: 500,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16
      }}>
        <Spin size="large" />
        <div style={{ width: 300 }}>
          <Progress
            percent={loadingProgress}
            status="active"
            strokeColor={{
              '0%': '#108ee9',
              '100%': '#87d068',
            }}
          />
          <div style={{
            textAlign: 'center',
            marginTop: 8,
            color: themeMode === 'dark' ? token.colorTextSecondary : token.colorTextSecondary
          }}>
            {loadingMessage}
          </div>
        </div>
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
      />
    );
  }

  if (!cumulativeData || !chartData) {
    return (
      <Alert
        message="No Data"
        description="No cumulative frequency data available"
        type="warning"
        showIcon
      />
    );
  }

  const currentStats = cumulativeData[selectedKPI].stats;
  const config = kpiConfigs[selectedKPI];

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      {/* KPI Selector */}
      <Card size="small">
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <div>
            <strong>Select Parameter:</strong>
          </div>
          <Radio.Group value={selectedKPI} onChange={handleKPIChange} buttonStyle="solid">
            <Radio.Button value="iri">IRI</Radio.Button>
            <Radio.Button value="rut">Rut Depth</Radio.Button>
            <Radio.Button value="mpd">MPD</Radio.Button>
            <Radio.Button value="csc">CSC</Radio.Button>
            <Radio.Button value="psci">PSCI</Radio.Button>
          </Radio.Group>

          <Space>
            <Switch
              checked={showGrid}
              onChange={setShowGrid}
              checkedChildren="Grid On"
              unCheckedChildren="Grid Off"
            />
            <Switch
              checked={compareYears}
              onChange={setCompareYears}
              checkedChildren="Compare 2018"
              unCheckedChildren="2025 Only"
            />
          </Space>
        </Space>
      </Card>

      {/* Chart */}
      <Card
        title={`Figure 3.${['iri', 'rut', 'mpd', 'csc', 'psci'].indexOf(selectedKPI) + 1}: ${config.label} Cumulative Frequency Plot (${year})`}
        variant="borderless"
      >
        <div style={{ height: 450 }}>
          <Line data={chartData} options={chartOptions} />
        </div>
      </Card>

      {/* Statistics */}
      <Card title="Statistics" size="small">
        <Row gutter={16}>
          <Col span={6}>
            <Statistic
              title="Average"
              value={currentStats.average}
              suffix={config.unit}
              precision={2}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title="Median"
              value={currentStats.median}
              suffix={config.unit}
              precision={2}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title="90th Percentile"
              value={currentStats.percentile90}
              suffix={config.unit}
              precision={2}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title="Sample Count"
              value={currentStats.count}
              precision={0}
            />
          </Col>
        </Row>
      </Card>
    </Space>
  );
};

export default CumulativeFrequencyCharts;
