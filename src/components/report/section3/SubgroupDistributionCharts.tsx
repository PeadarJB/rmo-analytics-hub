// src/components/report/section3/SubgroupDistributionCharts.tsx
import React, { useEffect, useState, useMemo } from 'react';
import { Card, Radio, Spin, Alert, Space, Typography, theme } from 'antd';
import type { RadioChangeEvent } from 'antd';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ChartOptions
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { KPIKey } from '@/config/kpiConfig';
import { getKPIFieldName, buildSubgroupWhereClause } from '@/config/layerConfig';
import useAppStore from '@/store/useAppStore';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

const { Paragraph } = Typography;

interface SubgroupDistribution {
  subgroup: string;
  totalLength: number; // in km
  classDistribution: Record<string, number>; // class name -> percentage
}

interface SubgroupDistributionChartsProps {
  year?: number;
}

// Subgroup definitions
const SUBGROUPS = [
  { name: 'Former National', field: 'IsFormerNa', code: 10 },
  { name: 'Dublin', field: 'IsDublin', code: 20 },
  { name: 'City/Town', field: 'IsCityTown', code: 30 },
  { name: 'Peat', field: 'IsPeat', code: 40 },
  { name: 'Rural', field: 'Rural', code: 50 }
];

// Condition class colors (RMO standard)
const CONDITION_COLORS: Record<string, string> = {
  'Very Good': '#2d5016',
  'Good': '#52c41a',
  'Fair': '#faad14',
  'Poor': '#ff7a45',
  'Very Poor': '#cf1322',
  // PSCI specific
  '9-10': '#2d5016',
  '7-8': '#52c41a',
  '5-6': '#faad14',
  '1-4': '#cf1322'
};

/**
 * Subgroup Distribution Charts Component
 *
 * Displays 100% stacked bar charts showing condition class distributions
 * across road subgroups:
 * - Figure 3.6: IRI Distributions by Subgroup
 * - Figure 3.7: Rut Depth Distributions by Subgroup
 * - Figure 3.8: CSC Distributions by Subgroup
 * - Figure 3.9: PSCI Distributions by Subgroup
 */
const SubgroupDistributionCharts: React.FC<SubgroupDistributionChartsProps> = ({
  year = 2025
}) => {
  const { token } = theme.useToken();
  const { roadLayer, themeMode } = useAppStore();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedKPI, setSelectedKPI] = useState<KPIKey>('iri');

  // Store distribution data for all KPIs
  const [distributionData, setDistributionData] = useState<Record<KPIKey, SubgroupDistribution[]> | null>(null);

  /**
   * Map class values to condition labels
   */
  const getClassLabel = (kpi: KPIKey, classValue: number): string => {
    if (kpi === 'psci') {
      // PSCI uses 1-10 scale, group into 4 categories
      if (classValue >= 9) return '9-10';
      if (classValue >= 7) return '7-8';
      if (classValue >= 5) return '5-6';
      return '1-4';
    }

    // Standard 5-class system
    switch (classValue) {
      case 1: return 'Very Good';
      case 2: return 'Good';
      case 3: return 'Fair';
      case 4: return 'Poor';
      case 5: return 'Very Poor';
      default: return 'Unknown';
    }
  };

  /**
   * Get condition classes for a KPI
   */
  const getConditionClasses = (kpi: KPIKey): string[] => {
    if (kpi === 'psci') {
      return ['9-10', '7-8', '5-6', '1-4'];
    }
    return ['Very Good', 'Good', 'Fair', 'Poor', 'Very Poor'];
  };

  /**
   * Fetch distribution data for a specific KPI and subgroup
   */
  const fetchSubgroupDistribution = async (
    kpi: KPIKey,
    subgroupCode: number,
    subgroupName: string
  ): Promise<SubgroupDistribution> => {
    if (!roadLayer) {
      throw new Error('Road layer not available');
    }

    const classFieldName = getKPIFieldName(kpi, year, true);
    const whereClause = buildSubgroupWhereClause(subgroupCode);

    // Query all features in this subgroup
    const query = roadLayer.createQuery();
    query.where = `${whereClause} AND ${classFieldName} IS NOT NULL`;
    query.outFields = [classFieldName, 'Shape_Length'];
    query.returnGeometry = false;

    try {
      const result = await roadLayer.queryFeatures(query);

      // Calculate total length
      const totalLength = result.features.reduce(
        (sum, f) => sum + (f.attributes.Shape_Length as number || 0),
        0
      ) / 1000; // Convert to km

      // Group by condition class and calculate lengths
      const classLengths: Record<string, number> = {};
      const conditionClasses = getConditionClasses(kpi);

      // Initialize all classes with 0
      conditionClasses.forEach(cls => {
        classLengths[cls] = 0;
      });

      // Sum lengths by class
      result.features.forEach(feature => {
        const classValue = feature.attributes[classFieldName] as number;
        const length = (feature.attributes.Shape_Length as number || 0) / 1000; // km
        const label = getClassLabel(kpi, classValue);

        if (label !== 'Unknown') {
          classLengths[label] = (classLengths[label] || 0) + length;
        }
      });

      // Convert to percentages
      const classDistribution: Record<string, number> = {};
      conditionClasses.forEach(cls => {
        const percentage = totalLength > 0 ? (classLengths[cls] / totalLength) * 100 : 0;
        classDistribution[cls] = Math.round(percentage * 10) / 10;
      });

      return {
        subgroup: subgroupName,
        totalLength: Math.round(totalLength * 10) / 10,
        classDistribution
      };
    } catch (err) {
      console.error(`Error fetching distribution for ${subgroupName}:`, err);
      return {
        subgroup: subgroupName,
        totalLength: 0,
        classDistribution: {}
      };
    }
  };

  /**
   * Fetch distribution data for all KPIs
   */
  const fetchAllDistributions = async () => {
    if (!roadLayer) {
      throw new Error('Road layer not available');
    }

    const results: Record<string, SubgroupDistribution[]> = {};
    const kpiList: KPIKey[] = ['iri', 'rut', 'csc', 'psci'];

    for (const kpi of kpiList) {
      const subgroupDistributions: SubgroupDistribution[] = [];

      // Fetch data for each subgroup
      for (const subgroup of SUBGROUPS) {
        const distribution = await fetchSubgroupDistribution(kpi, subgroup.code, subgroup.name);
        subgroupDistributions.push(distribution);
      }

      results[kpi] = subgroupDistributions;
    }

    return results as Record<KPIKey, SubgroupDistribution[]>;
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

        const allData = await fetchAllDistributions();
        setDistributionData(allData);
      } catch (err) {
        console.error('Error loading distribution data:', err);
        setError('Failed to load subgroup distribution data');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [roadLayer, year]);

  // Prepare chart data
  const chartData = useMemo(() => {
    if (!distributionData || !distributionData[selectedKPI]) {
      return null;
    }

    const distributions = distributionData[selectedKPI];
    const conditionClasses = getConditionClasses(selectedKPI);

    // Prepare datasets (one per condition class)
    const datasets = conditionClasses.map(cls => ({
      label: cls,
      data: distributions.map(d => d.classDistribution[cls] || 0),
      backgroundColor: CONDITION_COLORS[cls] || '#8c8c8c',
      borderWidth: 0
    }));

    return {
      labels: distributions.map(d => `${d.subgroup}\n(${d.totalLength.toFixed(1)} km)`),
      datasets
    };
  }, [distributionData, selectedKPI]);

  // Chart options
  const chartOptions: ChartOptions<'bar'> = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: 'bottom' as const,
        labels: {
          color: themeMode === 'dark' ? token.colorTextBase : token.colorText,
          font: { size: 12 },
          usePointStyle: true,
          padding: 15
        }
      },
      tooltip: {
        mode: 'index',
        intersect: false,
        callbacks: {
          label: (context) => {
            const value = context.parsed.y ?? 0;
            return `${context.dataset.label}: ${value.toFixed(1)}%`;
          }
        }
      }
    },
    scales: {
      x: {
        stacked: true,
        ticks: {
          color: themeMode === 'dark' ? token.colorTextSecondary : token.colorTextSecondary,
          font: { size: 11 }
        },
        grid: {
          display: false
        }
      },
      y: {
        stacked: true,
        title: {
          display: true,
          text: 'Percentage (%)',
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
          color: themeMode === 'dark' ? token.colorBorderSecondary : token.colorBorder
        }
      }
    },
    interaction: {
      mode: 'index',
      intersect: false
    }
  }), [themeMode, token]);

  // Handle KPI selection change
  const handleKPIChange = (e: RadioChangeEvent) => {
    setSelectedKPI(e.target.value as KPIKey);
  };

  // Get insights for selected KPI
  const getInsights = (): string[] => {
    if (!distributionData || !distributionData[selectedKPI]) {
      return [];
    }

    const distributions = distributionData[selectedKPI];
    const insights: string[] = [];

    // Find subgroup with best performance (highest % in good classes)
    const goodClasses = selectedKPI === 'psci' ? ['9-10', '7-8'] : ['Very Good', 'Good'];
    const subgroupScores = distributions.map(d => {
      const goodPercent = goodClasses.reduce((sum, cls) => sum + (d.classDistribution[cls] || 0), 0);
      return { subgroup: d.subgroup, score: goodPercent };
    });
    const best = subgroupScores.reduce((a, b) => a.score > b.score ? a : b);

    insights.push(`${best.subgroup} roads show the best condition with ${best.score.toFixed(1)}% in good categories`);

    return insights;
  };

  if (loading) {
    return (
      <div style={{
        height: 500,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <Spin size="large" tip="Loading subgroup distribution data..." />
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

  if (!distributionData || !chartData) {
    return (
      <Alert
        message="No Data"
        description="No subgroup distribution data available"
        type="warning"
        showIcon
      />
    );
  }

  const figureNumber = ['iri', 'rut', 'csc', 'psci'].indexOf(selectedKPI) + 6;
  const kpiLabels: Record<string, string> = {
    iri: 'IRI',
    rut: 'Rut Depth',
    csc: 'CSC',
    psci: 'PSCI'
  };

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
            <Radio.Button value="csc">CSC</Radio.Button>
            <Radio.Button value="psci">PSCI</Radio.Button>
          </Radio.Group>
        </Space>
      </Card>

      {/* Chart */}
      <Card
        title={`Figure 3.${figureNumber}: ${kpiLabels[selectedKPI]} Distributions by Subgroup (${year})`}
        variant="borderless"
      >
        <div style={{ height: 450 }}>
          <Bar data={chartData} options={chartOptions} />
        </div>
      </Card>

      {/* Key Insights */}
      <Card title="Key Insights" size="small">
        <ul style={{ margin: 0, paddingLeft: 20 }}>
          {getInsights().map((insight, idx) => (
            <li key={idx}>
              <Paragraph style={{ margin: 0 }}>{insight}</Paragraph>
            </li>
          ))}
        </ul>
      </Card>
    </Space>
  );
};

export default SubgroupDistributionCharts;
