// src/components/report/section2/MethodologySection.tsx
import React from 'react';
import { Space, Typography, Divider } from 'antd';
import PSCIDiagram from './PSCIDiagram';
import MethodologyTables from './MethodologyTables';

const { Title, Paragraph } = Typography;

const MethodologySection: React.FC = () => {
  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      {/* Section Header */}
      <div>
        <Title level={2}>Section 2: Methodology</Title>
        <Paragraph>
          The Regional Roads Condition Study employs a comprehensive methodology to assess 
          pavement condition across Ireland's regional road network. This section outlines 
          the key performance indicators (KPIs) used in the survey, their measurement scales, 
          and the classification systems used to categorize road condition.
        </Paragraph>
        <Paragraph>
          All data is collected using specialized survey equipment and trained personnel 
          following standardized procedures to ensure consistency and reliability across 
          the entire network.
        </Paragraph>
      </div>

      <Divider />

      {/* Survey Parameters Overview */}
      <div>
        <Title level={3}>Key Performance Indicators</Title>
        <Paragraph>
          The 2025 Regional Roads Condition Study measures six primary condition parameters:
        </Paragraph>
        <ul style={{ fontSize: 14, lineHeight: 1.8 }}>
          <li>
            <strong>IRI (International Roughness Index):</strong> Objective measure of 
            longitudinal road roughness affecting ride quality
          </li>
          <li>
            <strong>Rut Depth:</strong> Measurement of wheel path deformation affecting 
            structural integrity and safety
          </li>
          <li>
            <strong>PSCI (Pavement Surface Condition Index):</strong> Visual assessment 
            of overall surface condition
          </li>
          <li>
            <strong>CSC (Characteristic SCRIM Coefficient):</strong> Measurement of skid 
            resistance for wet-weather safety
          </li>
          <li>
            <strong>MPD (Mean Profile Depth):</strong> Surface texture indicator related 
            to skid resistance
          </li>
          <li>
            <strong>LPV3 (Longitudinal Profile Variance):</strong> Additional roughness 
            measure over 3-metre sections
          </li>
        </ul>
      </div>

      <Divider />

      {/* Figure 2.1: PSCI Rating Scale */}
      <PSCIDiagram />

      <Divider />

      {/* Tables 2.1 & 2.2 */}
      <MethodologyTables />

      <Divider />

      {/* Data Quality and Consistency */}
      <div>
        <Title level={3}>Data Quality Assurance</Title>
        <Paragraph>
          To ensure the highest quality of data collection:
        </Paragraph>
        <ul style={{ fontSize: 14, lineHeight: 1.8 }}>
          <li>
            All survey equipment is calibrated regularly and meets international standards
          </li>
          <li>
            Visual PSCI ratings are conducted by trained surveyors who undergo regular 
            consistency checks
          </li>
          <li>
            Common road sections are rated independently by multiple surveyors to verify 
            rating consistency
          </li>
          <li>
            Raw data collected at 10-metre intervals is averaged over 100-metre sample 
            units for reporting
          </li>
          <li>
            All data is georeferenced using Irish Transverse Mercator (ITM) coordinates 
            for GIS integration
          </li>
          <li>
            The database structure is compatible with LGMA MapRoad software for local 
            authority use
          </li>
        </ul>
      </div>

      <Divider />

      {/* Sample Unit Definition */}
      <div>
        <Title level={3}>Sample Unit Definition</Title>
        <Paragraph>
          The regional road network is divided into <strong>100-metre sample units</strong> 
          for data collection and analysis. Each sample unit is:
        </Paragraph>
        <ul style={{ fontSize: 14, lineHeight: 1.8 }}>
          <li>
            Uniquely identified by Local Authority and route number
          </li>
          <li>
            Referenced by start and end chainage (distance along route)
          </li>
          <li>
            Georeferenced with start and end ITM coordinates
          </li>
          <li>
            Tagged with road classification and subgroup codes
          </li>
          <li>
            Assigned condition ratings for all measured parameters
          </li>
        </ul>
        <Paragraph>
          This standardized sample unit approach enables:
        </Paragraph>
        <ul style={{ fontSize: 14, lineHeight: 1.8 }}>
          <li>Consistent data collection across the entire network</li>
          <li>Accurate condition trending over time</li>
          <li>Precise identification of maintenance priorities</li>
          <li>Integration with asset management systems</li>
          <li>Comparison with national road data (which uses the same 100m standard)</li>
        </ul>
      </div>

      <Divider />

      {/* Key Points Summary */}
      <div>
        <Title level={4}>Key Methodology Points</Title>
        <Paragraph>
          <ul style={{ fontSize: 14, lineHeight: 1.8 }}>
            <li>
              The survey covers approximately <strong>13,000 centreline kilometres</strong> 
              across 31 Local Authorities
            </li>
            <li>
              Over <strong>130,000 sample units</strong> are assessed, providing comprehensive 
              network coverage
            </li>
            <li>
              <strong>Condition classes</strong> range from "Very Good" to "Very Poor" for 
              all parameters
            </li>
            <li>
              The methodology is consistent with <strong>previous surveys (2011, 2018)</strong>, 
              enabling trend analysis
            </li>
            <li>
              All condition data is stored in a structured database compatible with standard 
              asset management tools
            </li>
          </ul>
        </Paragraph>
      </div>
    </Space>
  );
};

export default MethodologySection;
