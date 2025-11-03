// src/pages/RegionalReport2025/index.tsx
import React, { useState } from 'react';
import { Layout, Menu, Typography, theme, Card, Space } from 'antd';
import type { MenuProps } from 'antd';
import {
  FileTextOutlined,
  BarChartOutlined,
  LineChartOutlined,
  AppstoreOutlined
} from '@ant-design/icons';

const { Sider, Content } = Layout;
const { Title, Paragraph } = Typography;

type MenuItem = Required<MenuProps>['items'][number];

const RegionalReport2025: React.FC = () => {
  const { token } = theme.useToken();
  const [selectedSection, setSelectedSection] = useState<string>('section1');

  // Define report sections
  const menuItems: MenuItem[] = [
    {
      key: 'section1',
      icon: <AppstoreOutlined />,
      label: 'Section 1: Network Overview',
    },
    {
      key: 'section2',
      icon: <FileTextOutlined />,
      label: 'Section 2: Methodology',
    },
    {
      key: 'section3',
      icon: <BarChartOutlined />,
      label: 'Section 3: Performance Summary',
    },
    {
      key: 'appendixA',
      icon: <LineChartOutlined />,
      label: 'Appendix A: 2018 vs 2025',
    },
    {
      key: 'appendixB',
      icon: <LineChartOutlined />,
      label: 'Appendix B: County Comparisons',
    }
  ];

  const handleMenuClick: MenuProps['onClick'] = (e) => {
    setSelectedSection(e.key);
  };

  // Render section content based on selection
  const renderSectionContent = () => {
    switch (selectedSection) {
      case 'section1':
        return (
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <Title level={2}>Section 1: Network Overview</Title>
            <Paragraph>
              This section will contain:
              <ul>
                <li><strong>Figure 1.1:</strong> Regional Road Network in Ireland (Map)</li>
                <li><strong>Figure 1.2:</strong> Road Width Cumulative Frequency (Line graph)</li>
                <li><strong>Table 1.1:</strong> Regional Road Length (km) by Local Authority</li>
                <li><strong>Table 1.2:</strong> Average Regional Road Width (m) by Local Authority</li>
              </ul>
            </Paragraph>
            <Card title="Figure 1.1: Regional Road Network Map" bordered={false}>
              <div style={{ height: 400, background: token.colorBgLayout, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Paragraph type="secondary">Interactive map will be rendered here</Paragraph>
              </div>
            </Card>
            <Card title="Figure 1.2: Road Width Cumulative Frequency" bordered={false}>
              <div style={{ height: 300, background: token.colorBgLayout, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Paragraph type="secondary">Chart will be rendered here</Paragraph>
              </div>
            </Card>
          </Space>
        );
      
      case 'section2':
        return (
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <Title level={2}>Section 2: Methodology</Title>
            <Paragraph>
              This section will contain:
              <ul>
                <li><strong>Figure 2.1:</strong> PSCI Rating 1 to 10 (Diagram/Chart)</li>
                <li><strong>Table 2.1:</strong> IRI Scale</li>
                <li><strong>Table 2.2:</strong> Condition Class Definitions, 2025</li>
              </ul>
            </Paragraph>
            <Card title="PSCI Rating System" bordered={false}>
              <div style={{ height: 300, background: token.colorBgLayout, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Paragraph type="secondary">PSCI diagram will be rendered here</Paragraph>
              </div>
            </Card>
          </Space>
        );
      
      case 'section3':
        return (
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <Title level={2}>Section 3: Performance Summary</Title>
            <Paragraph>
              This section will contain:
              <ul>
                <li><strong>Figures 3.1-3.5:</strong> Cumulative Frequency Plots (IRI, Rut, MPD, CSC, PSCI)</li>
                <li><strong>Figures 3.6-3.9:</strong> Distributions by Subgroup (Stacked bar charts)</li>
                <li><strong>Tables 3.1-3.3:</strong> Performance Parameters and Subgroup Analysis</li>
              </ul>
            </Paragraph>
            <Card title="Cumulative Frequency Plots (5 charts)" bordered={false}>
              <div style={{ height: 400, background: token.colorBgLayout, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Paragraph type="secondary">5 line charts will be rendered here</Paragraph>
              </div>
            </Card>
            <Card title="Subgroup Distribution Charts (4 charts)" bordered={false}>
              <div style={{ height: 400, background: token.colorBgLayout, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Paragraph type="secondary">4 stacked bar charts will be rendered here</Paragraph>
              </div>
            </Card>
          </Space>
        );
      
      case 'appendixA':
        return (
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <Title level={2}>Appendix A: National Comparisons (2018 vs 2025)</Title>
            <Paragraph>
              This section will contain:
              <ul>
                <li><strong>Figures A.1-A.5:</strong> Cumulative Frequency Plots comparing 2018 and 2025 data</li>
              </ul>
            </Paragraph>
            <Card title="Historical Comparison Charts" bordered={false}>
              <div style={{ height: 400, background: token.colorBgLayout, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Paragraph type="secondary">5 comparison line charts will be rendered here</Paragraph>
              </div>
            </Card>
          </Space>
        );
      
      case 'appendixB':
        return (
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <Title level={2}>Appendix B: Local Authority Comparisons (2018 vs 2025)</Title>
            <Paragraph>
              This section will contain:
              <ul>
                <li><strong>Figures B.1-B.5:</strong> Split-screen maps comparing 2018 and 2025 by county</li>
              </ul>
            </Paragraph>
            <Card title="County Comparison Maps" bordered={false}>
              <div style={{ height: 400, background: token.colorBgLayout, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Paragraph type="secondary">5 split-screen county comparison maps will be rendered here (using existing Swipe tool)</Paragraph>
              </div>
            </Card>
          </Space>
        );
      
      default:
        return <Paragraph>Select a section from the menu</Paragraph>;
    }
  };

  return (
    <Layout style={{ height: '100%', background: token.colorBgContainer }}>
      {/* Left sidebar navigation */}
      <Sider 
        width={280} 
        style={{ 
          background: token.colorBgLayout,
          borderRight: `1px solid ${token.colorBorder}`,
          overflow: 'auto'
        }}
      >
        <div style={{ padding: '16px', borderBottom: `1px solid ${token.colorBorder}` }}>
          <Title level={4} style={{ margin: 0 }}>2025 Regional Report</Title>
        </div>
        <Menu
          mode="inline"
          selectedKeys={[selectedSection]}
          items={menuItems}
          onClick={handleMenuClick}
          style={{ borderRight: 0 }}
        />
      </Sider>

      {/* Main content area */}
      <Content style={{ 
        padding: '24px', 
        overflow: 'auto',
        background: token.colorBgContainer 
      }}>
        {renderSectionContent()}
      </Content>
    </Layout>
  );
};

export default RegionalReport2025;
