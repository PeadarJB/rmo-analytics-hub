// src/components/LayerPerformanceMetrics.tsx
// PHASE 3: Layer Performance Metrics Display Component

import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Statistic, Progress, Space, Button, Typography, Divider } from 'antd';
import { 
  ThunderboltOutlined, 
  GlobalOutlined, 
  SwapOutlined,
  ReloadOutlined,
  TrophyOutlined 
} from '@ant-design/icons';
import useAppStore from '@/store/useAppStore';

const { Text, Title } = Typography;

/**
 * Layer Performance Metrics Component
 * 
 * Displays performance statistics for different layer loading strategies
 * Shows average load times, success rates, and recommendations
 */
const LayerPerformanceMetrics: React.FC = () => {
  const { getLayerPerformanceMetrics, layerLoadingState } = useAppStore();
  const [metrics, setMetrics] = useState<{
    avgTimes: Record<string, number>;
    successRates: Record<string, number>;
  }>({
    avgTimes: { direct: 0, webmap: 0, hybrid: 0 },
    successRates: { direct: 0, webmap: 0, hybrid: 0 }
  });

  const refreshMetrics = () => {
    const newMetrics = getLayerPerformanceMetrics();
    setMetrics(newMetrics);
  };

  useEffect(() => {
    refreshMetrics();
    
    // Auto-refresh every 5 seconds
    const interval = setInterval(refreshMetrics, 5000);
    
    return () => clearInterval(interval);
  }, []);

  const getStrategyIcon = (strategy: string) => {
    switch (strategy) {
      case 'direct':
        return <ThunderboltOutlined style={{ color: '#52c41a' }} />;
      case 'webmap':
        return <GlobalOutlined style={{ color: '#1890ff' }} />;
      case 'hybrid':
        return <SwapOutlined style={{ color: '#faad14' }} />;
      default:
        return null;
    }
  };

  const getRecommendation = () => {
    const { avgTimes, successRates } = metrics;

    // If direct loading works well, recommend it
    if (successRates.direct >= 95 && avgTimes.direct > 0 && avgTimes.direct < 6000) {
      return {
        strategy: 'direct',
        icon: <ThunderboltOutlined />,
        color: '#52c41a',
        reason: 'Direct loading is fast and reliable'
      };
    }

    // If hybrid has good success rate, recommend it
    if (successRates.hybrid >= 95 && avgTimes.hybrid < 8000) {
      return {
        strategy: 'hybrid',
        icon: <SwapOutlined />,
        color: '#faad14',
        reason: 'Hybrid provides speed with fallback safety'
      };
    }

    // Default to WebMap if others aren't reliable
    return {
      strategy: 'webmap',
      icon: <GlobalOutlined />,
      color: '#1890ff',
      reason: 'WebMap is most reliable for your configuration'
    };
  };

  const recommendation = getRecommendation();
  const hasData = Object.values(metrics.avgTimes).some(time => time > 0);

  return (
    <Card
      title={
        <Space>
          <TrophyOutlined />
          <span>Performance Metrics</span>
        </Space>
      }
      extra={
        <Button 
          size="small" 
          icon={<ReloadOutlined />} 
          onClick={refreshMetrics}
        >
          Refresh
        </Button>
      }
    >
      {!hasData ? (
        <Space direction="vertical" align="center" style={{ width: '100%', padding: '24px 0' }}>
          <Text type="secondary">No performance data available yet</Text>
          <Text type="secondary" style={{ fontSize: '12px' }}>
            Metrics will appear after loading layers
          </Text>
        </Space>
      ) : (
        <>
          {/* Average Load Times */}
          <div style={{ marginBottom: 24 }}>
            <Title level={5}>Average Load Times</Title>
            <Row gutter={[16, 16]}>
              <Col span={8}>
                <Card size="small">
                  <Statistic
                    title={
                      <Space size="small">
                        {getStrategyIcon('direct')}
                        <span>Direct</span>
                      </Space>
                    }
                    value={metrics.avgTimes.direct}
                    suffix="ms"
                    valueStyle={{ 
                      color: '#52c41a',
                      fontSize: '20px'
                    }}
                  />
                </Card>
              </Col>
              <Col span={8}>
                <Card size="small">
                  <Statistic
                    title={
                      <Space size="small">
                        {getStrategyIcon('webmap')}
                        <span>WebMap</span>
                      </Space>
                    }
                    value={metrics.avgTimes.webmap}
                    suffix="ms"
                    valueStyle={{ 
                      color: '#1890ff',
                      fontSize: '20px'
                    }}
                  />
                </Card>
              </Col>
              <Col span={8}>
                <Card size="small">
                  <Statistic
                    title={
                      <Space size="small">
                        {getStrategyIcon('hybrid')}
                        <span>Hybrid</span>
                      </Space>
                    }
                    value={metrics.avgTimes.hybrid}
                    suffix="ms"
                    valueStyle={{ 
                      color: '#faad14',
                      fontSize: '20px'
                    }}
                  />
                </Card>
              </Col>
            </Row>
          </div>

          {/* Success Rates */}
          <div style={{ marginBottom: 24 }}>
            <Title level={5}>Success Rates</Title>
            <Space direction="vertical" style={{ width: '100%' }} size="small">
              <div>
                <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                  <Space>
                    {getStrategyIcon('direct')}
                    <Text>Direct</Text>
                  </Space>
                  <Text strong>{metrics.successRates.direct}%</Text>
                </Space>
                <Progress 
                  percent={metrics.successRates.direct} 
                  strokeColor="#52c41a"
                  showInfo={false}
                />
              </div>

              <div>
                <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                  <Space>
                    {getStrategyIcon('webmap')}
                    <Text>WebMap</Text>
                  </Space>
                  <Text strong>{metrics.successRates.webmap}%</Text>
                </Space>
                <Progress 
                  percent={metrics.successRates.webmap} 
                  strokeColor="#1890ff"
                  showInfo={false}
                />
              </div>

              <div>
                <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                  <Space>
                    {getStrategyIcon('hybrid')}
                    <Text>Hybrid</Text>
                  </Space>
                  <Text strong>{metrics.successRates.hybrid}%</Text>
                </Space>
                <Progress 
                  percent={metrics.successRates.hybrid} 
                  strokeColor="#faad14"
                  showInfo={false}
                />
              </div>
            </Space>
          </div>

          <Divider />

          {/* Recommendation */}
          <div>
            <Title level={5}>Recommended Strategy</Title>
            <Card 
              size="small" 
              style={{ 
                backgroundColor: `${recommendation.color}15`,
                borderColor: recommendation.color
              }}
            >
              <Space direction="vertical">
                <Space>
                  {recommendation.icon}
                  <Text strong style={{ color: recommendation.color }}>
                    {recommendation.strategy.charAt(0).toUpperCase() + recommendation.strategy.slice(1)}
                  </Text>
                </Space>
                <Text type="secondary" style={{ fontSize: '12px' }}>
                  {recommendation.reason}
                </Text>
              </Space>
            </Card>
          </div>

          {/* Current Load Info */}
          {layerLoadingState.loadTimeMs > 0 && (
            <>
              <Divider />
              <Space direction="vertical" style={{ width: '100%' }}>
                <Title level={5}>Last Load</Title>
                <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                  <Text>Strategy:</Text>
                  <Space>
                    {getStrategyIcon(layerLoadingState.strategy)}
                    <Text strong>
                      {layerLoadingState.strategy.charAt(0).toUpperCase() + layerLoadingState.strategy.slice(1)}
                    </Text>
                  </Space>
                </Space>
                <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                  <Text>Load Time:</Text>
                  <Text strong>{layerLoadingState.loadTimeMs}ms</Text>
                </Space>
                <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                  <Text>Fallback Used:</Text>
                  <Text strong>{layerLoadingState.fallbackUsed ? 'Yes' : 'No'}</Text>
                </Space>
              </Space>
            </>
          )}
        </>
      )}

      <Divider />
      
      <Text type="secondary" style={{ fontSize: '11px' }}>
        💡 Metrics update automatically every 5 seconds
      </Text>
    </Card>
  );
};

export default LayerPerformanceMetrics;
