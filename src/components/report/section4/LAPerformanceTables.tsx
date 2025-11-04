// rmo-analytics-hub/src/components/report/section4/LAPerformanceTables.tsx

import React, { useEffect, useState } from 'react';
import { Card, Table, Spin, Alert, Button, Space, Typography, Tabs } from 'antd';
import { TableOutlined, DownloadOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { KPIKey, KPI_LABELS, getConditionClass } from '@/config/kpiConfig';

const { Title, Paragraph } = Typography;
const { TabPane } = Tabs;

/**
 * Convert condition class key to readable name
 */
const getConditionClassName = (kpi: KPIKey, value: number): string => {
  const classKey = getConditionClass(kpi, value, true);
  if (!classKey) return 'Unknown';

  const classNames: Record<string, string> = {
    veryGood: 'Very Good',
    good: 'Good',
    fair: 'Fair',
    poor: 'Poor',
    veryPoor: 'Very Poor'
  };

  return classNames[classKey] || 'Unknown';
};

interface LAPerformanceTablesProps {
  roadLayer: __esri.FeatureLayer | null;
}

interface AverageByLA {
  localAuthority: string;
  iri: number;
  rut: number;
  csc: number;
  mpd: number;
  psci: number;
  lpv3: number;
  totalLength: number;
}

interface ConditionClassByLA {
  localAuthority: string;
  veryGood: number;
  good: number;
  fair: number;
  poor: number;
  veryPoor: number;
  fairOrBetter: number;
}

/**
 * LAPerformanceTables Component
 * Replicates Table 4.1 and Tables 4.2-4.6 from the 2018 Regional Report
 * Shows Local Authority performance metrics and condition class distributions
 */
export const LAPerformanceTables: React.FC<LAPerformanceTablesProps> = ({ roadLayer }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [averageData, setAverageData] = useState<AverageByLA[]>([]);
  const [conditionData, setConditionData] = useState<Record<KPIKey, ConditionClassByLA[]>>({
    iri: [],
    rut: [],
    csc: [],
    psci: [],
    mpd: [],
    lpv3: []
  });

  useEffect(() => {
    if (roadLayer) {
      fetchAllData();
    }
  }, [roadLayer]);

  /**
   * Fetch all LA performance data
   */
  const fetchAllData = async () => {
    if (!roadLayer) return;

    setLoading(true);
    setError(null);

    try {
      // Fetch both average values and condition class distributions in parallel
      const [avgData, condData] = await Promise.all([
        fetchAveragesByLA(),
        fetchConditionClassesByLA()
      ]);

      setAverageData(avgData);
      setConditionData(condData);
    } catch (err) {
      console.error('Error fetching LA performance data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Fetch average values for all KPIs by Local Authority
   */
  const fetchAveragesByLA = async (): Promise<AverageByLA[]> => {
    if (!roadLayer) return [];

    const query = roadLayer.createQuery();
    query.where = 'AIRI_2025 IS NOT NULL';
    query.outFields = ['LA', 'AIRI_2025', 'LRUT_2025', 'CSC_2025', 'MPD_2025', 'ModeRating_2025', 'LPV3_2025', 'Shape_Length'];
    query.returnGeometry = false;

    const result = await roadLayer.queryFeatures(query);

    // Group by LA and calculate averages
    const laMap = new Map<string, {
      iri: number[];
      rut: number[];
      csc: number[];
      mpd: number[];
      psci: number[];
      lpv3: number[];
      lengths: number[];
    }>();

    result.features.forEach(feature => {
      const la = feature.attributes.LA;
      const iri = feature.attributes.AIRI_2025;
      const rut = feature.attributes.LRUT_2025;
      const csc = feature.attributes.CSC_2025;
      const mpd = feature.attributes.MPD_2025;
      const psci = feature.attributes.ModeRating_2025;
      const lpv3 = feature.attributes.LPV3_2025;
      const length = feature.attributes.Shape_Length;

      if (!laMap.has(la)) {
        laMap.set(la, {
          iri: [],
          rut: [],
          csc: [],
          mpd: [],
          psci: [],
          lpv3: [],
          lengths: []
        });
      }

      const laData = laMap.get(la)!;
      if (iri != null) laData.iri.push(iri);
      if (rut != null) laData.rut.push(rut);
      if (csc != null) laData.csc.push(csc);
      if (mpd != null) laData.mpd.push(mpd);
      if (psci != null) laData.psci.push(psci);
      if (lpv3 != null) laData.lpv3.push(lpv3);
      if (length != null) laData.lengths.push(length);
    });

    // Calculate averages
    const averages: AverageByLA[] = [];
    laMap.forEach((data, la) => {
      averages.push({
        localAuthority: la,
        iri: data.iri.length > 0 ? data.iri.reduce((a, b) => a + b, 0) / data.iri.length : 0,
        rut: data.rut.length > 0 ? data.rut.reduce((a, b) => a + b, 0) / data.rut.length : 0,
        csc: data.csc.length > 0 ? data.csc.reduce((a, b) => a + b, 0) / data.csc.length : 0,
        mpd: data.mpd.length > 0 ? data.mpd.reduce((a, b) => a + b, 0) / data.mpd.length : 0,
        psci: data.psci.length > 0 ? data.psci.reduce((a, b) => a + b, 0) / data.psci.length : 0,
        lpv3: data.lpv3.length > 0 ? data.lpv3.reduce((a, b) => a + b, 0) / data.lpv3.length : 0,
        totalLength: data.lengths.reduce((a, b) => a + b, 0) / 1000 // Convert to km
      });
    });

    return averages.sort((a, b) => a.localAuthority.localeCompare(b.localAuthority));
  };

  /**
   * Fetch condition class distributions for all KPIs by Local Authority
   */
  const fetchConditionClassesByLA = async (): Promise<Record<KPIKey, ConditionClassByLA[]>> => {
    if (!roadLayer) {
      return { iri: [], rut: [], csc: [], psci: [], mpd: [], lpv3: [] };
    }

    const kpis: KPIKey[] = ['iri', 'rut', 'csc', 'psci', 'mpd', 'lpv3'];
    const fieldMap = {
      iri: 'AIRI_2025',
      rut: 'LRUT_2025',
      csc: 'CSC_2025',
      psci: 'ModeRating_2025',
      mpd: 'MPD_2025',
      lpv3: 'LPV3_2025'
    };

    // Fetch data for all KPIs in parallel
    const results = await Promise.all(
      kpis.map(kpi => fetchConditionClassForKPI(kpi, fieldMap[kpi]))
    );

    // Combine results
    const conditionData: Record<KPIKey, ConditionClassByLA[]> = {
      iri: results[0],
      rut: results[1],
      csc: results[2],
      psci: results[3],
      mpd: results[4],
      lpv3: results[5]
    };

    return conditionData;
  };

  /**
   * Fetch condition class distribution for a single KPI
   */
  const fetchConditionClassForKPI = async (
    kpi: KPIKey,
    fieldName: string
  ): Promise<ConditionClassByLA[]> => {
    if (!roadLayer) return [];

    const query = roadLayer.createQuery();
    query.where = `${fieldName} IS NOT NULL`;
    query.outFields = ['LA', fieldName, 'Shape_Length'];
    query.returnGeometry = false;

    const result = await roadLayer.queryFeatures(query);

    // Group by LA
    const laMap = new Map<string, {
      veryGood: number;
      good: number;
      fair: number;
      poor: number;
      veryPoor: number;
      total: number;
    }>();

    result.features.forEach(feature => {
      const la = feature.attributes.LA;
      const value = feature.attributes[fieldName];
      const length = feature.attributes.Shape_Length || 0;

      if (value == null) return;

      if (!laMap.has(la)) {
        laMap.set(la, {
          veryGood: 0,
          good: 0,
          fair: 0,
          poor: 0,
          veryPoor: 0,
          total: 0
        });
      }

      const laData = laMap.get(la)!;
      const className = getConditionClassName(kpi, value);

      switch (className) {
        case 'Very Good':
          laData.veryGood += length;
          break;
        case 'Good':
          laData.good += length;
          break;
        case 'Fair':
          laData.fair += length;
          break;
        case 'Poor':
          laData.poor += length;
          break;
        case 'Very Poor':
          laData.veryPoor += length;
          break;
      }

      laData.total += length;
    });

    // Calculate percentages
    const distributions: ConditionClassByLA[] = [];
    laMap.forEach((data, la) => {
      const total = data.total || 1; // Avoid division by zero
      const veryGood = (data.veryGood / total) * 100;
      const good = (data.good / total) * 100;
      const fair = (data.fair / total) * 100;

      distributions.push({
        localAuthority: la,
        veryGood: Math.round(veryGood),
        good: Math.round(good),
        fair: Math.round(fair),
        poor: Math.round((data.poor / total) * 100),
        veryPoor: Math.round((data.veryPoor / total) * 100),
        fairOrBetter: Math.round(veryGood + good + fair)
      });
    });

    return distributions.sort((a, b) => a.localAuthority.localeCompare(b.localAuthority));
  };

  /**
   * Export table data to CSV
   */
  const exportToCSV = (data: any[], filename: string) => {
    if (data.length === 0) return;

    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(','),
      ...data.map(row => headers.map(header => row[header]).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  /**
   * Render Table 4.1: Average Values
   */
  const renderAverageTable = () => {
    const columns: ColumnsType<AverageByLA> = [
      {
        title: 'Local Authority',
        dataIndex: 'localAuthority',
        key: 'localAuthority',
        fixed: 'left',
        width: 150,
        sorter: (a, b) => a.localAuthority.localeCompare(b.localAuthority)
      },
      {
        title: 'IRI (mm/m)',
        dataIndex: 'iri',
        key: 'iri',
        align: 'center',
        render: (val: number) => val.toFixed(1),
        sorter: (a, b) => a.iri - b.iri
      },
      {
        title: 'Rut (mm)',
        dataIndex: 'rut',
        key: 'rut',
        align: 'center',
        render: (val: number) => val.toFixed(1),
        sorter: (a, b) => a.rut - b.rut
      },
      {
        title: 'CSC',
        dataIndex: 'csc',
        key: 'csc',
        align: 'center',
        render: (val: number) => val.toFixed(2),
        sorter: (a, b) => a.csc - b.csc
      },
      {
        title: 'MPD (mm)',
        dataIndex: 'mpd',
        key: 'mpd',
        align: 'center',
        render: (val: number) => val.toFixed(1),
        sorter: (a, b) => a.mpd - b.mpd
      },
      {
        title: 'PSCI',
        dataIndex: 'psci',
        key: 'psci',
        align: 'center',
        render: (val: number) => val.toFixed(1),
        sorter: (a, b) => a.psci - b.psci
      },
      {
        title: 'LPV 3m',
        dataIndex: 'lpv3',
        key: 'lpv3',
        align: 'center',
        render: (val: number) => val.toFixed(1),
        sorter: (a, b) => a.lpv3 - b.lpv3
      },
      {
        title: 'Length (km)',
        dataIndex: 'totalLength',
        key: 'totalLength',
        align: 'center',
        render: (val: number) => val.toFixed(1),
        sorter: (a, b) => a.totalLength - b.totalLength
      }
    ];

    return (
      <Card
        title={
          <Space>
            <TableOutlined />
            Table 4.1: Condition Parameters – Average Values 2025
          </Space>
        }
        extra={
          <Button
            size="small"
            icon={<DownloadOutlined />}
            onClick={() => exportToCSV(averageData, 'la_average_values_2025.csv')}
          >
            Export CSV
          </Button>
        }
        style={{ marginBottom: 24 }}
      >
        <Paragraph type="secondary">
          Average values of machine and visual rating (PSCI) parameters for each Local Authority.
          Significant variations exist due to factors including underlying subgrade condition,
          pavement layer thickness, quality of materials, and maintenance practices.
        </Paragraph>
        <Table
          columns={columns}
          dataSource={averageData}
          rowKey="localAuthority"
          pagination={{ pageSize: 15, showSizeChanger: true }}
          size="small"
          bordered
          scroll={{ x: 1000 }}
        />
      </Card>
    );
  };

  /**
   * Render condition class distribution table for a specific KPI
   */
  const renderConditionTable = (kpi: KPIKey, tableNumber: string) => {
    const data = conditionData[kpi];

    const columns: ColumnsType<ConditionClassByLA> = [
      {
        title: 'Local Authority',
        dataIndex: 'localAuthority',
        key: 'localAuthority',
        fixed: 'left',
        width: 150,
        sorter: (a, b) => a.localAuthority.localeCompare(b.localAuthority)
      },
      {
        title: 'Very Good',
        dataIndex: 'veryGood',
        key: 'veryGood',
        align: 'center',
        render: (val: number) => `${val}%`,
        sorter: (a, b) => a.veryGood - b.veryGood
      },
      {
        title: 'Good',
        dataIndex: 'good',
        key: 'good',
        align: 'center',
        render: (val: number) => `${val}%`,
        sorter: (a, b) => a.good - b.good
      },
      {
        title: 'Fair',
        dataIndex: 'fair',
        key: 'fair',
        align: 'center',
        render: (val: number) => `${val}%`,
        sorter: (a, b) => a.fair - b.fair
      },
      {
        title: 'Poor',
        dataIndex: 'poor',
        key: 'poor',
        align: 'center',
        render: (val: number) => `${val}%`,
        sorter: (a, b) => a.poor - b.poor
      },
      {
        title: 'Very Poor',
        dataIndex: 'veryPoor',
        key: 'veryPoor',
        align: 'center',
        render: (val: number) => `${val}%`,
        sorter: (a, b) => a.veryPoor - b.veryPoor
      },
      {
        title: 'Fair or Better',
        dataIndex: 'fairOrBetter',
        key: 'fairOrBetter',
        align: 'center',
        render: (val: number) => `${val}%`,
        sorter: (a, b) => a.fairOrBetter - b.fairOrBetter
      }
    ];

    const kpiDescriptions: Record<KPIKey, string> = {
      iri: 'IRI measures ride quality. Lower values indicate better ride quality. The IRI classes range from Very Good (< 3 mm/m) to Very Poor (> 7 mm/m).',
      rut: 'Rut Depth measures structural condition. Lower values indicate better structural condition. The Rut Classes range from Very Good (< 6 mm) to Very Poor (> 20 mm).',
      csc: 'CSC (SCRIM Coefficient) measures skid resistance. Higher values indicate better wet skidding resistance. The classes range from Very Good (CSC > 0.50) to Very Poor (≤ 0.35).',
      psci: 'PSCI (Pavement Surface Condition Index) is a visual rating from 1-10. Higher ratings indicate better surface condition. The classes range from Very Good (> 7) to Very Poor (< 4).',
      mpd: 'MPD (Mean Profile Depth) measures macrotexture. The classes range from Very Good (> 1.5 mm) to Very Poor (< 0.6 mm).',
      lpv3: 'LPV3 (Longitudinal Profile Variance) measures profile smoothness. Lower values indicate smoother profiles. The classes range from Very Good (< 2) to Very Poor (> 10).'
    };

    return (
      <Card
        title={
          <Space>
            <TableOutlined />
            Table {tableNumber}: {KPI_LABELS[kpi]} – Condition Classes by Local Authority 2025
          </Space>
        }
        extra={
          <Button
            size="small"
            icon={<DownloadOutlined />}
            onClick={() => exportToCSV(data, `la_${kpi}_classes_2025.csv`)}
          >
            Export CSV
          </Button>
        }
        style={{ marginBottom: 24 }}
      >
        <Paragraph type="secondary">
          {kpiDescriptions[kpi]}
        </Paragraph>
        <Table
          columns={columns}
          dataSource={data}
          rowKey="localAuthority"
          pagination={{ pageSize: 15, showSizeChanger: true }}
          size="small"
          bordered
          scroll={{ x: 900 }}
        />
      </Card>
    );
  };

  if (loading) {
    return (
      <Card>
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <Spin size="large" tip="Loading Local Authority performance data..." />
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Alert
        message="Error Loading Data"
        description={error}
        type="error"
        showIcon
        style={{ marginBottom: 16 }}
      />
    );
  }

  return (
    <div style={{ padding: '24px 0' }}>
      <Title level={3}>
        <TableOutlined /> Local Authority Performance Tables
      </Title>
      <Paragraph>
        These tables provide detailed performance metrics for each of Ireland's 31 Local Authorities,
        showing both average condition values and the distribution of road segments across condition classes.
      </Paragraph>

      {/* Table 4.1: Average Values */}
      {renderAverageTable()}

      {/* Tables 4.2-4.6: Condition Class Distributions */}
      <Title level={4} style={{ marginTop: 32 }}>Condition Class Distributions</Title>
      <Paragraph type="secondary">
        The following tables show the percentage of each Local Authority's road network in each
        condition class (Very Good, Good, Fair, Poor, Very Poor).
      </Paragraph>

      <Tabs defaultActiveKey="iri" type="card">
        <TabPane tab="IRI" key="iri">
          {renderConditionTable('iri', '4.2')}
        </TabPane>
        <TabPane tab="Rut Depth" key="rut">
          {renderConditionTable('rut', '4.3')}
        </TabPane>
        <TabPane tab="PSCI" key="psci">
          {renderConditionTable('psci', '4.4')}
        </TabPane>
        <TabPane tab="CSC" key="csc">
          {renderConditionTable('csc', '4.5')}
        </TabPane>
        <TabPane tab="MPD" key="mpd">
          {renderConditionTable('mpd', '4.6')}
        </TabPane>
      </Tabs>
    </div>
  );
};
