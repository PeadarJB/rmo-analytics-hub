// rmo-analytics-hub/src/components/report/section4/Section4.tsx

import React from 'react';
import { Card, Typography, Divider, Space, Alert } from 'antd';
import { InfoCircleOutlined } from '@ant-design/icons';
import { LAPerformanceTables } from './LAPerformanceTables';

const { Title, Paragraph, Text } = Typography;

interface Section4Props {
  roadLayer: __esri.FeatureLayer | null;
}

/**
 * Section 4: Local Authority Performance
 * 
 * This section provides detailed performance analysis at the Local Authority level,
 * showing average values and condition class distributions for all key performance indicators.
 * 
 * Implements:
 * - Table 4.1: Average condition values for all 6 KPIs by LA
 * - Table 4.2: IRI condition class distribution by LA
 * - Table 4.3: Rut Depth condition class distribution by LA
 * - Table 4.4: PSCI condition class distribution by LA
 * - Table 4.5: CSC condition class distribution by LA
 * - Table 4.6: MPD condition class distribution by LA
 */
export const Section4: React.FC<Section4Props> = ({ roadLayer }) => {
  return (
    <div>
      {/* Section Header */}
      <Card style={{ marginBottom: 24 }}>
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <div>
            <Title level={2}>Section 4: Local Authority Performance</Title>
            <Paragraph>
              This section presents the results of the 2025 Regional Road Condition Study broken down
              by Local Authority. The data provides a comprehensive view of road condition across
              Ireland's 31 Local Authorities, enabling benchmarking, resource allocation planning,
              and targeted maintenance strategies.
            </Paragraph>
            <Paragraph>
              The tables show average condition values and the distribution of road segments across
              five condition classes (Very Good, Good, Fair, Poor, Very Poor) for each key performance
              indicator.
            </Paragraph>
          </div>

          <Alert
            message="Performance Variations"
            description="Significant variations in average road condition exist across Local Authorities due to
              several factors: underlying subgrade condition, pavement layer thickness, quality of materials,
              maintenance practices, and the proportion of former National routes that were reclassified as
              Regional roads."
            type="info"
            showIcon
            icon={<InfoCircleOutlined />}
          />

          <div>
            <Title level={5}>Key Metrics Analyzed:</Title>
            <ul>
              <li>
                <Text strong>IRI (International Roughness Index):</Text> Measures ride quality -
                lower values indicate smoother roads
              </li>
              <li>
                <Text strong>Rut Depth:</Text> Indicates structural condition -
                lower values show better structural integrity
              </li>
              <li>
                <Text strong>CSC (SCRIM Coefficient):</Text> Measures skid resistance -
                higher values indicate better wet weather safety
              </li>
              <li>
                <Text strong>MPD (Mean Profile Depth):</Text> Measures surface texture -
                affects drainage and skid resistance
              </li>
              <li>
                <Text strong>PSCI (Pavement Surface Condition Index):</Text> Visual rating scale 1-10 -
                higher ratings indicate better surface condition
              </li>
              <li>
                <Text strong>LPV3 (Longitudinal Profile Variance):</Text> Measures profile smoothness -
                lower values indicate smoother profiles
              </li>
            </ul>
          </div>
        </Space>
      </Card>

      {/* Performance Tables */}
      <LAPerformanceTables roadLayer={roadLayer} />

      {/* Section Footer */}
      <Divider />
      <Card style={{ marginTop: 24, backgroundColor: '#f0f2f5' }}>
        <Paragraph type="secondary" style={{ marginBottom: 0 }}>
          <Text strong>Note:</Text> The distribution of condition classes varies significantly across
          Local Authorities. This data can be used for benchmarking, resource allocation, and maintenance
          planning at the Local Authority level. For spatial visualization of these metrics, see the
          Comparison Tool in the Overview Dashboard.
        </Paragraph>
      </Card>
    </div>
  );
};
