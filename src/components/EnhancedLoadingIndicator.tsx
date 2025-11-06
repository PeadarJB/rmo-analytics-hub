// src/components/EnhancedLoadingIndicator.tsx
// PHASE 3: Enhanced Loading Indicator with Strategy Display

import React, { useEffect, useState } from 'react';
import { Spin, Progress, Typography, Space, Card, Tag } from 'antd';
import { LoadingOutlined, ThunderboltOutlined, GlobalOutlined, SwapOutlined } from '@ant-design/icons';
import useAppStore from '@/store/useAppStore';

const { Text, Title } = Typography;

interface EnhancedLoadingIndicatorProps {
  fullscreen?: boolean;
}

/**
 * Enhanced Loading Indicator Component
 * 
 * Shows loading progress with strategy information and current step
 * Displays elapsed time and fallback status
 */
const EnhancedLoadingIndicator: React.FC<EnhancedLoadingIndicatorProps> = ({ 
  fullscreen = false 
}) => {
  const { loading, loadingMessage, layerLoadingState } = useAppStore();
  const [elapsedTime, setElapsedTime] = useState(0);

  // Timer for elapsed time
  useEffect(() => {
    if (!loading) {
      setElapsedTime(0);
      return;
    }

    const startTime = Date.now();
    const interval = setInterval(() => {
      setElapsedTime(Math.round((Date.now() - startTime) / 1000));
    }, 100);

    return () => clearInterval(interval);
  }, [loading]);

  if (!loading) {
    return null;
  }

  const getStrategyIcon = () => {
    switch (layerLoadingState.strategy) {
      case 'direct':
        return <ThunderboltOutlined style={{ color: '#52c41a' }} />;
      case 'webmap':
        return <GlobalOutlined style={{ color: '#1890ff' }} />;
      case 'hybrid':
        return <SwapOutlined style={{ color: '#faad14' }} />;
      default:
        return <LoadingOutlined />;
    }
  };

  const getStrategyLabel = () => {
    const labels = {
      direct: 'Direct Loading',
      webmap: 'WebMap Loading',
      hybrid: 'Hybrid Loading'
    };
    return labels[layerLoadingState.strategy] || 'Loading';
  };

  const getStrategyColor = () => {
    const colors = {
      direct: 'green',
      webmap: 'blue',
      hybrid: 'orange'
    };
    return colors[layerLoadingState.strategy] || 'default';
  };

  const containerStyle: React.CSSProperties = fullscreen
    ? {
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        zIndex: 9999
      }
    : {
        padding: 24,
        textAlign: 'center'
      };

  return (
    <div style={containerStyle}>
      <Card
        style={{ 
          width: fullscreen ? 450 : '100%',
          maxWidth: 450,
          boxShadow: fullscreen ? '0 4px 12px rgba(0,0,0,0.15)' : 'none'
        }}
      >
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          {/* Spinner */}
          <Spin 
            indicator={<LoadingOutlined style={{ fontSize: 48 }} spin />}
            size="large"
          />

          {/* Title */}
          <Title level={4} style={{ margin: 0 }}>
            {loadingMessage || 'Loading...'}
          </Title>

          {/* Strategy Badge */}
          <Space>
            {getStrategyIcon()}
            <Tag color={getStrategyColor()} style={{ fontSize: '14px', padding: '4px 12px' }}>
              {getStrategyLabel()}
            </Tag>
            {layerLoadingState.fallbackUsed && (
              <Tag color="warning">Fallback Used</Tag>
            )}
          </Space>

          {/* Progress Bar */}
          {layerLoadingState.isLoading && layerLoadingState.progress > 0 && (
            <div style={{ width: '100%' }}>
              <Progress 
                percent={layerLoadingState.progress} 
                status="active"
                strokeColor={{
                  '0%': '#108ee9',
                  '100%': '#87d068',
                }}
              />
              <Text type="secondary" style={{ fontSize: '12px' }}>
                {layerLoadingState.currentStep}
              </Text>
            </div>
          )}

          {/* Elapsed Time */}
          <Space>
            <Text type="secondary" style={{ fontSize: '13px' }}>
              Elapsed: {elapsedTime}s
            </Text>
            {layerLoadingState.loadTimeMs > 0 && !layerLoadingState.isLoading && (
              <Text type="success" style={{ fontSize: '13px' }}>
                Completed in {layerLoadingState.loadTimeMs}ms
              </Text>
            )}
          </Space>

          {/* Expected Time */}
          {layerLoadingState.strategy === 'direct' && elapsedTime > 0 && (
            <Text type="secondary" style={{ fontSize: '12px' }}>
              Expected: ~4 seconds
            </Text>
          )}
          {layerLoadingState.strategy === 'webmap' && elapsedTime > 0 && (
            <Text type="secondary" style={{ fontSize: '12px' }}>
              Expected: ~20 seconds
            </Text>
          )}
          {layerLoadingState.strategy === 'hybrid' && elapsedTime > 0 && (
            <Text type="secondary" style={{ fontSize: '12px' }}>
              Expected: ~4 seconds (or fallback to ~20s)
            </Text>
          )}
        </Space>
      </Card>
    </div>
  );
};

export default EnhancedLoadingIndicator;
