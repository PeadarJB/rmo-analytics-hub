// rmo-analytics-hub/src/pages/RegionalReport2025/index.tsx

import React, { useState, useEffect } from 'react';
import { Layout, Menu, Typography, Spin, Alert } from 'antd';
import {
  FileTextOutlined,
  DashboardOutlined,
  ExperimentOutlined,
  BarChartOutlined,
  TableOutlined
} from '@ant-design/icons';
import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import WebMap from '@arcgis/core/WebMap';
import { Section1 } from '@/components/report/section1';
import { Section2 } from '@/components/report/section2';
import { Section3 } from '@/components/report/section3';
import { Section4 } from '@/components/report/section4';

const { Sider, Content } = Layout;
const { Title } = Typography;

// WebMap ID containing the road network data
const WEB_MAP_ID = 'a1b85fde91f541dca218913fb75c61e6';

/**
 * Regional Report 2025 Page
 * 
 * Multi-section interactive report replicating the 2018 Regional Road Report
 * with 2025 data. Organized into sections with navigation.
 */
export const RegionalReport2025: React.FC = () => {
  const [selectedSection, setSelectedSection] = useState<string>('1');
  const [roadLayer, setRoadLayer] = useState<FeatureLayer | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadWebMap();
  }, []);

  /**
   * Load the WebMap and extract the road layer
   */
  const loadWebMap = async () => {
    try {
      const webMap = new WebMap({
        portalItem: {
          id: WEB_MAP_ID
        }
      });

      await webMap.load();

      // Find the RMO regional roads layer
      const roadLayerTitle = 'RMO Regional Roads 2025';
      const layer = webMap.layers.find(
        (l) => l.title === roadLayerTitle
      ) as FeatureLayer;

      if (!layer) {
        throw new Error(`Could not find layer: ${roadLayerTitle}`);
      }

      await layer.load();
      setRoadLayer(layer);
      setError(null);
    } catch (err) {
      console.error('Error loading WebMap:', err);
      setError(err instanceof Error ? err.message : 'Failed to load map data');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Render the selected section component
   */
  const renderSection = () => {
    if (loading) {
      return (
        <div style={{ textAlign: 'center', padding: '100px 0' }}>
          <Spin size="large" tip="Loading road network data..." />
        </div>
      );
    }

    if (error) {
      return (
        <Alert
          message="Error Loading Data"
          description={error}
          type="error"
          showIcon
          style={{ margin: '40px 0' }}
        />
      );
    }

    switch (selectedSection) {
      case '1':
        return <Section1 roadLayer={roadLayer} />;
      case '2':
        return <Section2 />;
      case '3':
        return <Section3 roadLayer={roadLayer} />;
      case '4':
        return <Section4 roadLayer={roadLayer} />;
      default:
        return (
          <Alert
            message="Section Not Implemented"
            description="This section is under development"
            type="info"
            showIcon
          />
        );
    }
  };

  return (
    <Layout style={{ minHeight: '100vh', background: '#f0f2f5' }}>
      {/* Side Navigation */}
      <Sider
        width={280}
        style={{
          background: '#fff',
          boxShadow: '2px 0 8px rgba(0,0,0,0.1)'
        }}
      >
        <div style={{ padding: '24px 16px', background: '#001529' }}>
          <Title
            level={4}
            style={{ color: '#fff', margin: 0, fontSize: '16px' }}
          >
            <FileTextOutlined /> 2025 Regional Road Report
          </Title>
        </div>

        <Menu
          mode="inline"
          selectedKeys={[selectedSection]}
          onClick={({ key }) => setSelectedSection(key)}
          style={{ borderRight: 0, height: '100%' }}
        >
          <Menu.Item key="1" icon={<DashboardOutlined />}>
            Section 1: Network Overview
          </Menu.Item>
          <Menu.Item key="2" icon={<ExperimentOutlined />}>
            Section 2: Methodology
          </Menu.Item>
          <Menu.Item key="3" icon={<BarChartOutlined />}>
            Section 3: National Results
          </Menu.Item>
          <Menu.Item key="4" icon={<TableOutlined />}>
            Section 4: LA Performance
          </Menu.Item>
        </Menu>
      </Sider>

      {/* Main Content */}
      <Layout>
        <Content style={{ padding: '24px', minHeight: 280 }}>
          <div style={{ background: '#fff', padding: '24px', borderRadius: '8px' }}>
            {renderSection()}
          </div>
        </Content>
      </Layout>
    </Layout>
  );
};

export default RegionalReport2025;
