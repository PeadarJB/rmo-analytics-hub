// src/pages/RegionalReport2025/index.tsx
import React, { useState, useEffect, lazy, Suspense } from 'react';
import { Layout, Menu, Typography, theme, Card, Space, Spin } from 'antd';
import type { MenuProps } from 'antd';
import {
  BarChartOutlined,
  LineChartOutlined,
  AppstoreOutlined,
  ExperimentOutlined
} from '@ant-design/icons';
import useAppStore from '@/store/useAppStore';

// Lazy load section components
const NetworkOverviewSection = lazy(() => import('@/components/report/section1/NetworkOverviewSection'));
const MethodologySection = lazy(() => import('@/components/report/section2/MethodologySection'));
const Section3 = lazy(() => import('@/components/report/section3/Section3'));
const Section4 = lazy(() => import('@/components/report/section4/Section4').then(module => ({ default: module.Section4 })));

const { Sider, Content } = Layout;
const { Title, Paragraph } = Typography;

type MenuItem = Required<MenuProps>['items'][number];

const RegionalReport2025: React.FC = () => {
  const { token } = theme.useToken();
  const [selectedSection, setSelectedSection] = useState<string>('section1');
  const { initializeLayersDirectly, roadLayer, loading, loadingMessage } = useAppStore();

  // Initialize layers when component mounts
  useEffect(() => {
    if (!roadLayer) {
      initializeLayersDirectly();
    }
  }, [initializeLayersDirectly, roadLayer]);

  // Define report sections
  const menuItems: MenuItem[] = [
    {
      key: 'section1',
      icon: <AppstoreOutlined />,
      label: 'Section 1: Network Overview',
    },
    {
      key: 'section2',
      icon: <ExperimentOutlined />,
      label: 'Section 2: Methodology',
    },
    {
      key: 'section3',
      icon: <BarChartOutlined />,
      label: 'Section 3: Performance Summary',
    },
    {
      key: 'section4',
      icon: <BarChartOutlined />,
      label: 'Section 4: LA Performance',
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
    if (loading || !roadLayer) {
      return (
        <div style={{
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '48px'
        }}>
          <Spin size="large" tip={loadingMessage || 'Loading report data...'} />
        </div>
      );
    }

    switch (selectedSection) {
      case 'section1':
        return (
          <Suspense fallback={
            <div style={{
              height: 400,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Spin size="large" tip="Loading Section 1..." />
            </div>
          }>
            <NetworkOverviewSection year={2025} />
          </Suspense>
        );

      case 'section2':
        return (
          <Suspense fallback={
            <div style={{
              height: 400,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Spin size="large" tip="Loading Section 2..." />
            </div>
          }>
            <MethodologySection />
          </Suspense>
        );
      
      case 'section3':
        return (
          <Suspense fallback={
            <div style={{
              height: 400,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Spin size="large" tip="Loading Section 3..." />
            </div>
          }>
            <Section3 year={2025} />
          </Suspense>
        );

      case 'section4':
        return (
          <Suspense fallback={
            <div style={{
              height: 400,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Spin size="large" tip="Loading Section 4..." />
            </div>
          }>
            <Section4 roadLayer={roadLayer} />
          </Suspense>
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
            <Card title="Historical Comparison Charts" variant="borderless">
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
            <Card title="County Comparison Maps" variant="borderless">
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
