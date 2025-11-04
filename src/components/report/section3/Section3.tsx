// src/components/report/section3/Section3.tsx
import React from 'react';
import { Space, Typography, Divider, Collapse } from 'antd';
import { BarChartOutlined, PieChartOutlined, TableOutlined } from '@ant-design/icons';
import CumulativeFrequencyCharts from './CumulativeFrequencyCharts';
import SubgroupDistributionCharts from './SubgroupDistributionCharts';
import PerformanceSummaryTables from './PerformanceSummaryTables';

const { Title, Paragraph } = Typography;
const { Panel } = Collapse;

interface Section3Props {
  year?: number;
}

/**
 * Section 3: Reporting of National Results
 *
 * This section presents national-level performance summary statistics
 * for the Regional Road Network, including:
 *
 * - Figures 3.1-3.5: Cumulative Frequency Plots (IRI, Rut, MPD, CSC, PSCI)
 * - Figures 3.6-3.9: Distributions by Subgroup (Stacked bar charts)
 * - Tables 3.1-3.3: Performance Parameters and Subgroup Analysis
 */
const Section3: React.FC<Section3Props> = ({ year = 2025 }) => {
  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      {/* Section Header */}
      <div>
        <Title level={2}>Section 3: Reporting of National Results</Title>
        <Paragraph>
          This section presents the national performance summary for the Regional Road Network
          in {year}. The analysis includes cumulative frequency distributions, condition class
          breakdowns by road subgroup, and comprehensive performance statistics across all
          Key Performance Indicators (KPIs).
        </Paragraph>
      </div>

      <Divider />

      {/* Collapsible Panels for Better Organization */}
      <Collapse defaultActiveKey={['intro', 'cumulative', 'distribution', 'tables']} bordered={false}>

        {/* Introduction Panel */}
        <Panel
          header={
            <Space>
              <BarChartOutlined />
              <span style={{ fontWeight: 600 }}>Overview and General Statistics</span>
            </Space>
          }
          key="intro"
        >
          <Paragraph>
            The Regional Road Network comprises over 13,000 kilometres of roadway surveyed
            in 100-metre sample units. Performance is evaluated across six Key Performance
            Indicators:
          </Paragraph>
          <ul>
            <li><strong>IRI (International Roughness Index):</strong> Measures longitudinal road roughness</li>
            <li><strong>Rut Depth:</strong> Measures surface depression in wheel paths</li>
            <li><strong>MPD (Mean Profile Depth):</strong> Measures surface texture for skid resistance</li>
            <li><strong>CSC (Characteristic SCRIM Coefficient):</strong> Measures surface friction</li>
            <li><strong>PSCI (Pavement Surface Condition Index):</strong> Overall visual condition rating</li>
          </ul>
          <Paragraph>
            Roads are categorized into five subgroups based on traffic volume, location, and
            foundation conditions:
          </Paragraph>
          <ul>
            <li><strong>Former National:</strong> High-traffic routes formerly classified as national roads</li>
            <li><strong>Dublin:</strong> Roads within the Dublin metropolitan area</li>
            <li><strong>City/Town:</strong> Urban roads in cities and towns outside Dublin</li>
            <li><strong>Peat:</strong> Roads with special peat foundation conditions</li>
            <li><strong>Rural:</strong> All other regional roads (baseline category)</li>
          </ul>
        </Panel>

        {/* Cumulative Frequency Charts Panel */}
        <Panel
          header={
            <Space>
              <BarChartOutlined />
              <span style={{ fontWeight: 600 }}>Figures 3.1-3.5: Cumulative Frequency Plots</span>
            </Space>
          }
          key="cumulative"
        >
          <CumulativeFrequencyCharts year={year} />
        </Panel>

        {/* Subgroup Distribution Charts Panel */}
        <Panel
          header={
            <Space>
              <PieChartOutlined />
              <span style={{ fontWeight: 600 }}>Figures 3.6-3.9: Condition Class Distributions by Subgroup</span>
            </Space>
          }
          key="distribution"
        >
          <SubgroupDistributionCharts year={year} />
        </Panel>

        {/* Performance Tables Panel */}
        <Panel
          header={
            <Space>
              <TableOutlined />
              <span style={{ fontWeight: 600 }}>Tables 3.1-3.3: Performance Summary Statistics</span>
            </Space>
          }
          key="tables"
        >
          <PerformanceSummaryTables year={year} />
        </Panel>

      </Collapse>

      <Divider />

      {/* Section Footer */}
      <div>
        <Title level={4}>Key Findings</Title>
        <Paragraph>
          The {year} survey data reveals comprehensive performance insights across the
          Regional Road Network:
          <ul>
            <li>
              Cumulative frequency analysis shows the distribution of condition parameters
              across all surveyed road segments
            </li>
            <li>
              Subgroup analysis highlights performance variations based on road type,
              location, and foundation conditions
            </li>
            <li>
              Performance tables enable comparative analysis across Local Authorities
              and road categories
            </li>
          </ul>
        </Paragraph>
      </div>
    </Space>
  );
};

export default Section3;
