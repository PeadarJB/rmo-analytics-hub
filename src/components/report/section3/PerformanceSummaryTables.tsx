// src/components/report/section3/PerformanceSummaryTables.tsx
import React, { useEffect, useState } from 'react';
import { Card, Table, Button, Switch, Space, Spin, Alert, Tag } from 'antd';
import { DownloadOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { KPIKey } from '@/config/kpiConfig';
import { getKPIFieldName, buildSubgroupWhereClause } from '@/config/layerConfig';
import useAppStore from '@/store/useAppStore';

interface AveragePerformance {
  parameter: string;
  average2025: number;
  average2018?: number;
  unit: string;
  change?: number;
}

interface SubgroupLength {
  subgroup: string;
  length2025: number;
  length2018?: number;
}

interface LASubgroupBreakdown {
  localAuthority: string;
  formerNational: number;
  dublin: number;
  cityTown: number;
  peat: number;
  rural: number;
  total: number;
}

interface PerformanceSummaryTablesProps {
  year?: number;
}

/**
 * Performance Summary Tables Component
 *
 * Displays three summary tables:
 * - Table 3.1: Average Performance Parameters, 2025
 * - Table 3.2: Average Performance Parameters, 2018 (comparison)
 * - Table 3.3: Subgroup Lengths by Local Authority
 */
const PerformanceSummaryTables: React.FC<PerformanceSummaryTablesProps> = ({
  year = 2025
}) => {
  const { roadLayer } = useAppStore();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showComparison, setShowComparison] = useState(false);

  // Table data
  const [averagePerformance, setAveragePerformance] = useState<AveragePerformance[]>([]);
  const [subgroupLengths, setSubgroupLengths] = useState<SubgroupLength[]>([]);
  const [laSubgroupData, setLASubgroupData] = useState<LASubgroupBreakdown[]>([]);

  // KPI configuration
  const kpiList: { key: KPIKey; label: string; unit: string }[] = [
    { key: 'iri', label: 'Average IRI', unit: 'mm/m' },
    { key: 'rut', label: 'Left Rut Depth', unit: 'mm' },
    { key: 'mpd', label: 'Mean Profile Depth', unit: 'mm' },
    { key: 'csc', label: 'SCRIM CSC', unit: '' },
    { key: 'psci', label: 'PSCI', unit: '' },
    { key: 'lpv3', label: 'LPV', unit: '' }
  ];

  /**
   * Build a WHERE clause to check if data exists for a given year
   * Uses KPI field existence instead of HasData field (which may not exist for all years)
   */
  const buildDataExistsWhereClause = (targetYear: number): string => {
    // Check if any of the primary KPI fields exist for this year
    // Using AIRI (IRI) as the primary indicator since it's always collected
    const primaryField = `AIRI_${targetYear}`;
    return `${primaryField} IS NOT NULL`;
  };

  /**
   * Calculate average for a KPI
   */
  const calculateAverage = async (kpi: KPIKey, targetYear: number): Promise<number> => {
    if (!roadLayer) return 0;

    const fieldName = getKPIFieldName(kpi, targetYear, false);
    const query = roadLayer.createQuery();
    query.where = `${fieldName} IS NOT NULL AND ${fieldName} > 0`;
    query.outStatistics = [{
      statisticType: 'avg',
      onStatisticField: fieldName,
      outStatisticFieldName: 'avg_value'
    }];

    try {
      const result = await roadLayer.queryFeatures(query);
      if (result.features.length > 0) {
        const avg = result.features[0].attributes.avg_value as number;
        return Math.round(avg * 100) / 100;
      }
    } catch (err) {
      console.error(`Error calculating average for ${kpi}:`, err);
    }

    return 0;
  };

  /**
   * Calculate total length for a subgroup
   */
  const calculateSubgroupLength = async (subgroupCode: number, targetYear: number): Promise<number> => {
    if (!roadLayer) return 0;

    const whereClause = buildSubgroupWhereClause(subgroupCode);
    const dataExistsClause = buildDataExistsWhereClause(targetYear);
    const query = roadLayer.createQuery();
    query.where = `${whereClause} AND ${dataExistsClause}`;
    query.outStatistics = [{
      statisticType: 'sum',
      onStatisticField: 'Shape_Length',
      outStatisticFieldName: 'total_length'
    }];

    try {
      const result = await roadLayer.queryFeatures(query);
      if (result.features.length > 0) {
        const totalMeters = result.features[0].attributes.total_length as number;
        return Math.round((totalMeters / 1000) * 10) / 10; // Convert to km
      }
    } catch (err) {
      console.error(`Error calculating subgroup length:`, err);
    }

    return 0;
  };

  /**
   * Calculate subgroup lengths by Local Authority
   */
  const calculateLASubgroups = async (targetYear: number): Promise<LASubgroupBreakdown[]> => {
    if (!roadLayer) return [];

    try {
      // Get unique Local Authorities
      const laQuery = roadLayer.createQuery();
      laQuery.where = buildDataExistsWhereClause(targetYear);
      laQuery.outFields = ['LA'];
      laQuery.returnDistinctValues = true;
      laQuery.returnGeometry = false;

      const laResult = await roadLayer.queryFeatures(laQuery);
      const localAuthorities = laResult.features
        .map(f => f.attributes.LA as string)
        .filter(la => la && la.trim() !== '')
        .sort();

      const results: LASubgroupBreakdown[] = [];

      // For each LA, calculate subgroup lengths
      for (const la of localAuthorities) {
        const breakdown: LASubgroupBreakdown = {
          localAuthority: la,
          formerNational: 0,
          dublin: 0,
          cityTown: 0,
          peat: 0,
          rural: 0,
          total: 0
        };

        // Query each subgroup
        const subgroups = [
          { code: 10, field: 'formerNational' },
          { code: 20, field: 'dublin' },
          { code: 30, field: 'cityTown' },
          { code: 40, field: 'peat' },
          { code: 50, field: 'rural' }
        ];

        for (const sg of subgroups) {
          const sgWhere = buildSubgroupWhereClause(sg.code);
          const dataExistsClause = buildDataExistsWhereClause(targetYear);
          const query = roadLayer.createQuery();
          query.where = `${sgWhere} AND LA = '${la}' AND ${dataExistsClause}`;
          query.outStatistics = [{
            statisticType: 'sum',
            onStatisticField: 'Shape_Length',
            outStatisticFieldName: 'total_length'
          }];

          try {
            const result = await roadLayer.queryFeatures(query);
            if (result.features.length > 0) {
              const length = result.features[0].attributes.total_length as number;
              const lengthKm = Math.round((length / 1000) * 10) / 10;

              // Type-safe assignment
              if (sg.field === 'formerNational') breakdown.formerNational = lengthKm;
              else if (sg.field === 'dublin') breakdown.dublin = lengthKm;
              else if (sg.field === 'cityTown') breakdown.cityTown = lengthKm;
              else if (sg.field === 'peat') breakdown.peat = lengthKm;
              else if (sg.field === 'rural') breakdown.rural = lengthKm;
            }
          } catch (err) {
            console.error(`Error querying ${sg.field} for ${la}:`, err);
          }
        }

        // Calculate total
        breakdown.total = Math.round(
          (breakdown.formerNational + breakdown.dublin + breakdown.cityTown + breakdown.peat + breakdown.rural) * 10
        ) / 10;

        results.push(breakdown);
      }

      // Add summary row
      const totals: LASubgroupBreakdown = {
        localAuthority: 'TOTAL',
        formerNational: results.reduce((sum, r) => sum + r.formerNational, 0),
        dublin: results.reduce((sum, r) => sum + r.dublin, 0),
        cityTown: results.reduce((sum, r) => sum + r.cityTown, 0),
        peat: results.reduce((sum, r) => sum + r.peat, 0),
        rural: results.reduce((sum, r) => sum + r.rural, 0),
        total: results.reduce((sum, r) => sum + r.total, 0)
      };

      results.push(totals);

      return results;
    } catch (err) {
      console.error('Error calculating LA subgroups:', err);
      return [];
    }
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

        // Table 3.1: Average Performance
        const avgPerformanceData: AveragePerformance[] = [];
        for (const kpi of kpiList) {
          const avg2025 = await calculateAverage(kpi.key, year);
          const data: AveragePerformance = {
            parameter: kpi.label,
            average2025: avg2025,
            unit: kpi.unit
          };

          if (showComparison) {
            const avg2018 = await calculateAverage(kpi.key, 2018);
            data.average2018 = avg2018;
            data.change = avg2025 - avg2018;
          }

          avgPerformanceData.push(data);
        }
        setAveragePerformance(avgPerformanceData);

        // Table 3.2: Subgroup Lengths
        const subgroups = [
          { name: 'Former National', code: 10 },
          { name: 'Dublin', code: 20 },
          { name: 'City/Town', code: 30 },
          { name: 'Peat', code: 40 },
          { name: 'Rural', code: 50 }
        ];

        const subgroupData: SubgroupLength[] = [];
        for (const sg of subgroups) {
          const length2025 = await calculateSubgroupLength(sg.code, year);
          const data: SubgroupLength = {
            subgroup: sg.name,
            length2025
          };

          if (showComparison) {
            data.length2018 = await calculateSubgroupLength(sg.code, 2018);
          }

          subgroupData.push(data);
        }
        setSubgroupLengths(subgroupData);

        // Table 3.3: LA Breakdown
        const laData = await calculateLASubgroups(year);
        setLASubgroupData(laData);

      } catch (err) {
        console.error('Error loading table data:', err);
        setError('Failed to load performance summary tables');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [roadLayer, year, showComparison]);

  /**
   * Export table to CSV
   */
  const exportToCSV = (data: any[], filename: string) => {
    if (data.length === 0) return;

    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(','),
      ...data.map(row => headers.map(h => row[h]).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Table 3.1 Columns
  const avgPerformanceColumns: ColumnsType<AveragePerformance> = [
    {
      title: 'Parameter',
      dataIndex: 'parameter',
      key: 'parameter',
      fixed: 'left',
      width: 200
    },
    {
      title: `Average ${year}`,
      dataIndex: 'average2025',
      key: 'average2025',
      sorter: (a, b) => a.average2025 - b.average2025,
      render: (val) => val.toFixed(2)
    },
    ...(showComparison ? [{
      title: 'Average 2018',
      dataIndex: 'average2018',
      key: 'average2018',
      sorter: (a: AveragePerformance, b: AveragePerformance) => (a.average2018 || 0) - (b.average2018 || 0),
      render: (val: number) => val ? val.toFixed(2) : 'N/A'
    },
    {
      title: 'Change',
      dataIndex: 'change',
      key: 'change',
      sorter: (a: AveragePerformance, b: AveragePerformance) => (a.change || 0) - (b.change || 0),
      render: (val: number) => {
        if (!val) return 'N/A';
        const color = val > 0 ? 'red' : 'green';
        const prefix = val > 0 ? '+' : '';
        return <Tag color={color}>{prefix}{val.toFixed(2)}</Tag>;
      }
    }] : []),
    {
      title: 'Unit',
      dataIndex: 'unit',
      key: 'unit',
      width: 100
    }
  ];

  // Table 3.3 Columns
  const laSubgroupColumns: ColumnsType<LASubgroupBreakdown> = [
    {
      title: 'Local Authority',
      dataIndex: 'localAuthority',
      key: 'localAuthority',
      fixed: 'left',
      width: 150,
      sorter: (a, b) => a.localAuthority.localeCompare(b.localAuthority),
      render: (text) => text === 'TOTAL' ? <strong>{text}</strong> : text
    },
    {
      title: 'Former National (km)',
      dataIndex: 'formerNational',
      key: 'formerNational',
      sorter: (a, b) => a.formerNational - b.formerNational,
      render: (val, record) => record.localAuthority === 'TOTAL' ? <strong>{val.toFixed(1)}</strong> : val.toFixed(1)
    },
    {
      title: 'Dublin (km)',
      dataIndex: 'dublin',
      key: 'dublin',
      sorter: (a, b) => a.dublin - b.dublin,
      render: (val, record) => record.localAuthority === 'TOTAL' ? <strong>{val.toFixed(1)}</strong> : val.toFixed(1)
    },
    {
      title: 'City/Town (km)',
      dataIndex: 'cityTown',
      key: 'cityTown',
      sorter: (a, b) => a.cityTown - b.cityTown,
      render: (val, record) => record.localAuthority === 'TOTAL' ? <strong>{val.toFixed(1)}</strong> : val.toFixed(1)
    },
    {
      title: 'Peat (km)',
      dataIndex: 'peat',
      key: 'peat',
      sorter: (a, b) => a.peat - b.peat,
      render: (val, record) => record.localAuthority === 'TOTAL' ? <strong>{val.toFixed(1)}</strong> : val.toFixed(1)
    },
    {
      title: 'Rural (km)',
      dataIndex: 'rural',
      key: 'rural',
      sorter: (a, b) => a.rural - b.rural,
      render: (val, record) => record.localAuthority === 'TOTAL' ? <strong>{val.toFixed(1)}</strong> : val.toFixed(1)
    },
    {
      title: 'Total (km)',
      dataIndex: 'total',
      key: 'total',
      sorter: (a, b) => a.total - b.total,
      render: (val, record) => record.localAuthority === 'TOTAL' ? <strong>{val.toFixed(1)}</strong> : val.toFixed(1)
    }
  ];

  if (loading) {
    return (
      <div style={{
        height: 400,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <Spin size="large" tip="Loading performance summary tables..." />
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

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      {/* Controls */}
      <Card size="small">
        <Space>
          <Switch
            checked={showComparison}
            onChange={setShowComparison}
            checkedChildren="Show 2018 Comparison"
            unCheckedChildren="2025 Only"
          />
        </Space>
      </Card>

      {/* Table 3.1: Average Performance */}
      <Card
        title={`Table 3.1: Average Performance Parameters (${year})`}
        extra={
          <Button
            icon={<DownloadOutlined />}
            onClick={() => exportToCSV(averagePerformance, `average_performance_${year}.csv`)}
            size="small"
          >
            Export CSV
          </Button>
        }
      >
        <Table
          dataSource={averagePerformance}
          columns={avgPerformanceColumns}
          rowKey="parameter"
          pagination={false}
          size="small"
        />
      </Card>

      {/* Table 3.3: LA Subgroup Breakdown */}
      <Card
        title={`Table 3.3: Subgroup Lengths by Local Authority (${year})`}
        extra={
          <Button
            icon={<DownloadOutlined />}
            onClick={() => exportToCSV(laSubgroupData, `la_subgroup_breakdown_${year}.csv`)}
            size="small"
          >
            Export CSV
          </Button>
        }
      >
        <Table
          dataSource={laSubgroupData}
          columns={laSubgroupColumns}
          rowKey="localAuthority"
          pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (total) => `Total ${total} entries` }}
          size="small"
          scroll={{ x: 800 }}
        />
      </Card>
    </Space>
  );
};

export default PerformanceSummaryTables;
