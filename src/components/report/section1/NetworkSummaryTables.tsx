// src/components/report/section1/NetworkSummaryTables.tsx
import React, { useEffect, useState } from 'react';
import { Card, Table, Space, Spin, Alert, Button, theme } from 'antd';
import { DownloadOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import {
  networkDataService,
  RoadLengthByLA,
  RoadWidthByLA
} from '@/services/NetworkDataService';
import useAppStore from '@/store/useAppStore';

interface NetworkSummaryTablesProps {
  year?: number;
}

const NetworkSummaryTables: React.FC<NetworkSummaryTablesProps> = ({
  year = 2025
}) => {
  const { token } = theme.useToken();
  const { roadLayer } = useAppStore();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lengthData, setLengthData] = useState<RoadLengthByLA[]>([]);
  const [widthData, setWidthData] = useState<RoadWidthByLA[]>([]);
  const [summary, setSummary] = useState<{
    totalLength: number;
    totalSegments: number;
    averageWidth: number;
    localAuthorityCount: number;
  } | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!roadLayer) {
        setError('Road layer not available');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        networkDataService.setRoadLayer(roadLayer);

        // Fetch both tables and summary in parallel
        const [lengthResult, widthResult, summaryResult] = await Promise.all([
          networkDataService.getRoadLengthByLA(year),
          networkDataService.getRoadWidthByLA(year),
          networkDataService.getNetworkSummary(year)
        ]);

        setLengthData(lengthResult);
        setWidthData(widthResult);
        setSummary(summaryResult);
      } catch (err) {
        console.error('Error fetching network summary data:', err);
        setError('Failed to load network summary data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [roadLayer, year]);

  // Table 1.1: Regional Road Length columns
  const lengthColumns: ColumnsType<RoadLengthByLA> = [
    {
      title: 'Local Authority',
      dataIndex: 'localAuthority',
      key: 'localAuthority',
      sorter: (a, b) => a.localAuthority.localeCompare(b.localAuthority),
      defaultSortOrder: 'ascend',
      width: '50%'
    },
    {
      title: 'Total Length (km)',
      dataIndex: 'totalLength',
      key: 'totalLength',
      sorter: (a, b) => a.totalLength - b.totalLength,
      render: (value: number) => value.toFixed(1),
      align: 'right' as const,
      width: '30%'
    },
    {
      title: 'Segment Count',
      dataIndex: 'segmentCount',
      key: 'segmentCount',
      sorter: (a, b) => a.segmentCount - b.segmentCount,
      render: (value: number) => value.toLocaleString(),
      align: 'right' as const,
      width: '20%'
    }
  ];

  // Table 1.2: Average Road Width columns
  const widthColumns: ColumnsType<RoadWidthByLA> = [
    {
      title: 'Local Authority',
      dataIndex: 'localAuthority',
      key: 'localAuthority',
      sorter: (a, b) => a.localAuthority.localeCompare(b.localAuthority),
      defaultSortOrder: 'ascend',
      width: '50%'
    },
    {
      title: 'Average Width (m)',
      dataIndex: 'averageWidth',
      key: 'averageWidth',
      sorter: (a, b) => a.averageWidth - b.averageWidth,
      render: (value: number) => value.toFixed(2),
      align: 'right' as const,
      width: '30%'
    },
    {
      title: 'Segment Count',
      dataIndex: 'segmentCount',
      key: 'segmentCount',
      sorter: (a, b) => a.segmentCount - b.segmentCount,
      render: (value: number) => value.toLocaleString(),
      align: 'right' as const,
      width: '20%'
    }
  ];

  // Export to CSV function
  const exportToCSV = (
    data: RoadLengthByLA[] | RoadWidthByLA[],
    filename: string,
    type: 'length' | 'width'
  ) => {
    let csv = '';

    if (type === 'length') {
      csv = 'Local Authority,Total Length (km),Segment Count\n';
      (data as RoadLengthByLA[]).forEach(row => {
        csv += `"${row.localAuthority}",${row.totalLength.toFixed(1)},${row.segmentCount}\n`;
      });
    } else {
      csv = 'Local Authority,Average Width (m),Segment Count\n';
      (data as RoadWidthByLA[]).forEach(row => {
        csv += `"${row.localAuthority}",${row.averageWidth.toFixed(2)},${row.segmentCount}\n`;
      });
    }

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <Card variant="borderless">
          <div style={{
            height: 300,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Spin size="large" tip="Loading network summary data..." />
          </div>
        </Card>
      </Space>
    );
  }

  if (error) {
    return (
      <Card variant="borderless">
        <Alert
          message="Error"
          description={error}
          type="error"
          showIcon
        />
      </Card>
    );
  }

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      {/* Network Summary Stats */}
      {summary && (
        <Card
          title="Network Overview Summary"
          variant="borderless"
          style={{ background: token.colorPrimaryBg }}
        >
          <Space size="large" wrap>
            <div>
              <div style={{ fontSize: 24, fontWeight: 'bold', color: token.colorPrimary }}>
                {summary.totalLength.toLocaleString()} km
              </div>
              <div style={{ color: token.colorTextSecondary }}>Total Network Length</div>
            </div>
            <div>
              <div style={{ fontSize: 24, fontWeight: 'bold', color: token.colorPrimary }}>
                {summary.localAuthorityCount}
              </div>
              <div style={{ color: token.colorTextSecondary }}>Local Authorities</div>
            </div>
            <div>
              <div style={{ fontSize: 24, fontWeight: 'bold', color: token.colorPrimary }}>
                {summary.totalSegments.toLocaleString()}
              </div>
              <div style={{ color: token.colorTextSecondary }}>Road Segments</div>
            </div>
            <div>
              <div style={{ fontSize: 24, fontWeight: 'bold', color: token.colorPrimary }}>
                {summary.averageWidth.toFixed(1)} m
              </div>
              <div style={{ color: token.colorTextSecondary }}>Average Width</div>
            </div>
          </Space>
        </Card>
      )}

      {/* Table 1.1: Regional Road Length */}
      <Card
        title={`Table 1.1: Regional Road Length (kilometres) surveyed by Local Authority - ${year}`}
        variant="borderless"
        extra={
          <Button
            icon={<DownloadOutlined />}
            size="small"
            onClick={() => exportToCSV(lengthData, `road_length_by_LA_${year}.csv`, 'length')}
          >
            Export CSV
          </Button>
        }
      >
        <Table
          dataSource={lengthData}
          columns={lengthColumns}
          rowKey="localAuthority"
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `Total ${total} Local Authorities`
          }}
          size="small"
          summary={(pageData) => {
            const totalLength = pageData.reduce((sum, row) => sum + row.totalLength, 0);
            const totalSegments = pageData.reduce((sum, row) => sum + row.segmentCount, 0);
            return (
              <Table.Summary fixed>
                <Table.Summary.Row style={{ fontWeight: 'bold' }}>
                  <Table.Summary.Cell index={0}>Total (Current Page)</Table.Summary.Cell>
                  <Table.Summary.Cell index={1} align="right">
                    {totalLength.toFixed(1)}
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={2} align="right">
                    {totalSegments.toLocaleString()}
                  </Table.Summary.Cell>
                </Table.Summary.Row>
              </Table.Summary>
            );
          }}
        />
      </Card>

      {/* Table 1.2: Average Road Width */}
      <Card
        title={`Table 1.2: Average Regional Road Width (metres) surveyed by Local Authority - ${year}`}
        variant="borderless"
        extra={
          <Button
            icon={<DownloadOutlined />}
            size="small"
            onClick={() => exportToCSV(widthData, `road_width_by_LA_${year}.csv`, 'width')}
          >
            Export CSV
          </Button>
        }
      >
        <Table
          dataSource={widthData}
          columns={widthColumns}
          rowKey="localAuthority"
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `Total ${total} Local Authorities`
          }}
          size="small"
          summary={(pageData) => {
            const avgWidth = pageData.reduce((sum, row) => sum + row.averageWidth, 0) / pageData.length;
            const totalSegments = pageData.reduce((sum, row) => sum + row.segmentCount, 0);
            return (
              <Table.Summary fixed>
                <Table.Summary.Row style={{ fontWeight: 'bold' }}>
                  <Table.Summary.Cell index={0}>Average (Current Page)</Table.Summary.Cell>
                  <Table.Summary.Cell index={1} align="right">
                    {avgWidth.toFixed(2)}
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={2} align="right">
                    {totalSegments.toLocaleString()}
                  </Table.Summary.Cell>
                </Table.Summary.Row>
              </Table.Summary>
            );
          }}
        />
      </Card>
    </Space>
  );
};

export default NetworkSummaryTables;
