// src/components/report/section3/CumulativeFrequencyCharts.tsx
import React, { useEffect, useState, useMemo } from 'react';
import { Card, Radio, Spin, Alert, Space, Switch, Statistic, Row, Col, theme } from 'antd';
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
import { getKPIFieldName } from '@/config/layerConfig';
import useAppStore from '@/store/useAppStore';
import PaginationService from '@/services/PaginationService';

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

interface CumulativeDataPoint {
  value: number;
  cumulativePercent: number;
}

interface CumulativeData {
  dataPoints: CumulativeDataPoint[];
  stats: {
    average: number;
    median: number;
    percentile90: number;
    count: number;
  };
}

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
   * Calculate cumulative frequency distribution for a KPI
   */
  const calculateCumulativeDistribution = (
    values: number[],
    ranges: { min: number; max: number; step: number }
  ): CumulativeDataPoint[] => {
    if (values.length === 0) return [];

    // Sort values
    const sortedValues = [...values].sort((a, b) => a - b);
    const totalCount = sortedValues.length;

    // Calculate statistics
    const dataPoints: CumulativeDataPoint[] = [];

    for (let value = ranges.min; value <= ranges.max; value += ranges.step) {
      const count = sortedValues.filter(v => v <= value).length;
      const cumulativePercent = (count / totalCount) * 100;

      dataPoints.push({
        value: Math.round(value * 100) / 100,
        cumulativePercent: Math.round(cumulativePercent * 100) / 100
      });
    }

    return dataPoints;
  };

  /**
   * Calculate statistics for a dataset
   */
  const calculateStats = (values: number[]) => {
    if (values.length === 0) {
      return { average: 0, median: 0, percentile90: 0, count: 0 };
    }

    const sorted = [...values].sort((a, b) => a - b);
    const sum = values.reduce((acc, val) => acc + val, 0);
    const average = sum / values.length;
    const median = sorted[Math.floor(sorted.length / 2)];
    const percentile90 = sorted[Math.floor(sorted.length * 0.9)];

    return {
      average: Math.round(average * 100) / 100,
      median: Math.round(median * 100) / 100,
      percentile90: Math.round(percentile90 * 100) / 100,
      count: values.length
    };
  };

  /**
   * Fetch cumulative data for all KPIs
   */
  const fetchCumulativeData = async (targetYear: number) => {
    if (!roadLayer) {
      throw new Error('Road layer not available');
    }

    console.log('[CumulativeFrequencyCharts] Querying layer:', roadLayer.title);

    const results: Record<string, CumulativeData> = {};

    // Fetch data for each KPI
    const kpiKeys: KPIKey[] = ['iri', 'rut', 'mpd', 'csc', 'psci'];

    for (const kpi of kpiKeys) {
      const fieldName = getKPIFieldName(kpi, targetYear, false);
      const config = kpiConfigs[kpi];

      try {
        console.log(`[CumulativeFrequency] Querying all features for ${kpi}...`);

        const result = await PaginationService.queryAllFeatures(roadLayer, {
          where: `${fieldName} IS NOT NULL`,
          outFields: [fieldName],
          returnGeometry: false,
          orderByFields: ['OBJECTID ASC']
        });

        console.log(`[CumulativeFrequency] Retrieved ${result.totalCount} features for ${kpi} (${result.pagesQueried} pages)`);

        const values = result.features
          .map(f => f.attributes[fieldName] as number)
          .filter(v => v !== null && v !== undefined && !isNaN(v));

        const dataPoints = calculateCumulativeDistribution(values, config.ranges);
        const stats = calculateStats(values);

        results[kpi] = { dataPoints, stats };
      } catch (err) {
        console.error(`Error fetching ${kpi} data:`, err);
        results[kpi] = {
          dataPoints: [],
          stats: { average: 0, median: 0, percentile90: 0, count: 0 }
        };
      }
    }

    return results as Record<KPIKey, CumulativeData>;
  };

  // Load data on mount
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

        // Fetch current year data
        const currentData = await fetchCumulativeData(year);
        setCumulativeData(currentData);

        // Optionally fetch comparison data (2018)
        if (compareYears) {
          const compareData = await fetchCumulativeData(2018);
          setComparisonData(compareData);
        }
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
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <Spin size="large" tip="Loading cumulative frequency data..." />
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
