// src/components/report/section1/NetworkOverviewSection.tsx
import React from 'react';
import { Space, Typography, Divider } from 'antd';
import NetworkMapSection from './NetworkMapSection';
import RoadWidthChart from './RoadWidthChart';
import NetworkSummaryTables from './NetworkSummaryTables';

const { Title, Paragraph } = Typography;

interface NetworkOverviewSectionProps {
  year?: number;
}

const NetworkOverviewSection: React.FC<NetworkOverviewSectionProps> = ({
  year = 2025
}) => {
  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      {/* Section Header */}
      <div>
        <Title level={2}>Section 1: Network Overview</Title>
        <Paragraph>
          The Regional Road Network in Ireland comprises over 13,000 centreline kilometres
          of roadway across 31 Local Authorities. This section provides an overview of the
          network's physical characteristics, including total length surveyed, road width
          distributions, and summary statistics by Local Authority.
        </Paragraph>
      </div>

      <Divider />

      {/* Figure 1.1: Regional Road Network Map */}
      <NetworkMapSection year={year} height={600} />

      <Divider />

      {/* Figure 1.2: Road Width Cumulative Frequency */}
      <RoadWidthChart year={year} height={400} />

      <Divider />

      {/* Tables 1.1 & 1.2: Road Length and Width by LA */}
      <NetworkSummaryTables year={year} />

      <Divider />

      {/* Section Footer */}
      <div>
        <Title level={4}>Key Findings</Title>
        <Paragraph>
          <ul>
            <li>
              The regional road network surveyed in {year} spans approximately
              13,000 km across Ireland's 31 Local Authorities.
            </li>
            <li>
              Road widths typically range from 5 to 7 metres, with an average
              width of approximately 6.2 metres.
            </li>
            <li>
              The network is divided into 100-metre sample units for consistent
              data collection and analysis.
            </li>
            <li>
              Coverage includes a diverse range of road types: former national routes,
              urban roads, rural routes, and special categories like peat roads.
            </li>
          </ul>
        </Paragraph>
      </div>
    </Space>
  );
};

export default NetworkOverviewSection;
