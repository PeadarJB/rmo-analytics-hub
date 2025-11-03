// src/components/report/section2/MethodologyTables.tsx
import React from 'react';
import { Card, Table, Space, Tag, theme } from 'antd';
import type { ColumnsType } from 'antd/es/table';

interface IRIScaleData {
  key: string;
  iriRange: string;
  classification: string;
  description: string;
}

interface ConditionClassData {
  key: string;
  parameter: string;
  veryGood: string;
  good: string;
  fair: string;
  poor: string;
  veryPoor: string;
}

const MethodologyTables: React.FC = () => {
  const { token } = theme.useToken();

  // Table 2.1: IRI Scale Data
  const iriScaleData: IRIScaleData[] = [
    {
      key: '1',
      iriRange: '< 2.0',
      classification: 'Very Good',
      description: 'New or recently resurfaced pavement. Very smooth ride.'
    },
    {
      key: '2',
      iriRange: '2.0 - 3.5',
      classification: 'Good',
      description: 'Pavement in good condition. Smooth ride with minor imperfections.'
    },
    {
      key: '3',
      iriRange: '3.5 - 5.5',
      classification: 'Fair',
      description: 'Pavement showing signs of wear. Noticeable roughness.'
    },
    {
      key: '4',
      iriRange: '5.5 - 8.0',
      classification: 'Poor',
      description: 'Significant deterioration. Uncomfortable ride quality.'
    },
    {
      key: '5',
      iriRange: '> 8.0',
      classification: 'Very Poor',
      description: 'Severe deterioration. Very rough and uncomfortable ride.'
    }
  ];

  // Table 2.1 Columns
  const iriColumns: ColumnsType<IRIScaleData> = [
    {
      title: 'IRI Range (mm/m)',
      dataIndex: 'iriRange',
      key: 'iriRange',
      width: '20%',
      align: 'center' as const,
      render: (value: string) => (
        <strong style={{ fontSize: 14 }}>{value}</strong>
      )
    },
    {
      title: 'Classification',
      dataIndex: 'classification',
      key: 'classification',
      width: '20%',
      align: 'center' as const,
      render: (value: string) => {
        const colorMap: Record<string, string> = {
          'Very Good': 'green',
          'Good': 'cyan',
          'Fair': 'gold',
          'Poor': 'orange',
          'Very Poor': 'red'
        };
        return <Tag color={colorMap[value]}>{value}</Tag>;
      }
    },
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
      width: '60%'
    }
  ];

  // Table 2.2: Condition Class Definitions Data (2025)
  const conditionClassData: ConditionClassData[] = [
    {
      key: '1',
      parameter: 'IRI (mm/m)',
      veryGood: '< 2.0',
      good: '2.0 - 3.5',
      fair: '3.5 - 5.5',
      poor: '5.5 - 8.0',
      veryPoor: '> 8.0'
    },
    {
      key: '2',
      parameter: 'Rut Depth (mm)',
      veryGood: '< 5',
      good: '5 - 10',
      fair: '10 - 20',
      poor: '20 - 30',
      veryPoor: '> 30'
    },
    {
      key: '3',
      parameter: 'PSCI Rating',
      veryGood: '9 - 10',
      good: '7 - 8',
      fair: '5 - 6',
      poor: '3 - 4',
      veryPoor: '1 - 2'
    },
    {
      key: '4',
      parameter: 'CSC',
      veryGood: '> 0.50',
      good: '0.45 - 0.50',
      fair: '0.40 - 0.45',
      poor: '0.35 - 0.40',
      veryPoor: '< 0.35'
    },
    {
      key: '5',
      parameter: 'MPD (mm)',
      veryGood: '> 0.7',
      good: '0.65 - 0.7',
      fair: '0.6 - 0.65',
      poor: '< 0.6',
      veryPoor: '—'
    }
  ];

  // Helper function to get cell style based on condition
  const getCellStyle = (condition: 'veryGood' | 'good' | 'fair' | 'poor' | 'veryPoor') => {
    const colorMap = {
      veryGood: { bg: '#f6ffed', border: '#b7eb8f' },
      good: { bg: '#e6fffb', border: '#87e8de' },
      fair: { bg: '#fffbe6', border: '#ffe58f' },
      poor: { bg: '#fff2e8', border: '#ffbb96' },
      veryPoor: { bg: '#fff1f0', border: '#ffccc7' }
    };
    return {
      backgroundColor: colorMap[condition].bg,
      borderLeft: `3px solid ${colorMap[condition].border}`,
      fontWeight: 500
    };
  };

  // Table 2.2 Columns
  const conditionColumns: ColumnsType<ConditionClassData> = [
    {
      title: 'Parameter',
      dataIndex: 'parameter',
      key: 'parameter',
      width: '20%',
      fixed: 'left' as const,
      render: (value: string) => (
        <strong style={{ fontSize: 14 }}>{value}</strong>
      )
    },
    {
      title: 'Very Good',
      dataIndex: 'veryGood',
      key: 'veryGood',
      width: '16%',
      align: 'center' as const,
      onCell: () => ({ style: getCellStyle('veryGood') })
    },
    {
      title: 'Good',
      dataIndex: 'good',
      key: 'good',
      width: '16%',
      align: 'center' as const,
      onCell: () => ({ style: getCellStyle('good') })
    },
    {
      title: 'Fair',
      dataIndex: 'fair',
      key: 'fair',
      width: '16%',
      align: 'center' as const,
      onCell: () => ({ style: getCellStyle('fair') })
    },
    {
      title: 'Poor',
      dataIndex: 'poor',
      key: 'poor',
      width: '16%',
      align: 'center' as const,
      onCell: () => ({ style: getCellStyle('poor') })
    },
    {
      title: 'Very Poor',
      dataIndex: 'veryPoor',
      key: 'veryPoor',
      width: '16%',
      align: 'center' as const,
      onCell: () => ({ style: getCellStyle('veryPoor') })
    }
  ];

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      {/* Table 2.1: IRI Scale */}
      <Card
        title="Table 2.1: IRI Scale"
        variant="borderless"
      >
        <Table
          dataSource={iriScaleData}
          columns={iriColumns}
          pagination={false}
          size="middle"
          bordered
        />
        <div style={{ 
          marginTop: 16, 
          fontSize: 12, 
          color: token.colorTextSecondary 
        }}>
          <strong>IRI (International Roughness Index)</strong> is measured in millimetres 
          per metre (mm/m) and represents the longitudinal profile of the road surface. 
          It is the primary indicator of ride quality, with lower values indicating 
          smoother pavements.
        </div>
      </Card>

      {/* Table 2.2: Condition Class Definitions */}
      <Card
        title="Table 2.2: Condition Class Definitions, 2025"
        variant="borderless"
      >
        <Table
          dataSource={conditionClassData}
          columns={conditionColumns}
          pagination={false}
          size="middle"
          bordered
          scroll={{ x: 'max-content' }}
        />
        <div style={{ 
          marginTop: 16, 
          fontSize: 12, 
          color: token.colorTextSecondary,
          lineHeight: 1.6
        }}>
          <strong>Condition Class Definitions:</strong>
          <ul style={{ marginTop: 8, paddingLeft: 20 }}>
            <li>
              <strong>IRI (International Roughness Index):</strong> Measures longitudinal 
              road roughness in mm/m. Lower values indicate smoother surfaces.
            </li>
            <li>
              <strong>Rut Depth:</strong> Maximum rut depth in mm, measured in wheel paths. 
              Excessive rutting can cause water ponding and safety issues.
            </li>
            <li>
              <strong>PSCI (Pavement Surface Condition Index):</strong> Visual rating from 
              1-10 based on surface defects. Ratings of 5+ are considered acceptable.
            </li>
            <li>
              <strong>CSC (Characteristic SCRIM Coefficient):</strong> Skid resistance 
              measurement. Higher values indicate better wet-weather grip.
            </li>
            <li>
              <strong>MPD (Mean Profile Depth):</strong> Surface texture depth in mm. 
              Values below 0.6mm indicate poor skid resistance.
            </li>
          </ul>
        </div>
      </Card>

      {/* Methodology Note */}
      <Card
        variant="borderless"
        style={{ background: token.colorInfoBg }}
      >
        <div style={{ fontSize: 13, color: token.colorText }}>
          <strong>Data Collection Methodology:</strong>
          <p style={{ marginTop: 8, lineHeight: 1.6 }}>
            All condition data is collected using specialized survey vehicles equipped with 
            Road Surface Profiler (RSP) equipment and SCRIM machines. The regional road 
            network is surveyed in 100-metre sample units, providing detailed and consistent 
            condition measurements across all 31 Local Authorities. Visual PSCI ratings are 
            conducted by trained surveyors following standardized assessment protocols to 
            ensure consistency and repeatability.
          </p>
        </div>
      </Card>
    </Space>
  );
};

export default MethodologyTables;
