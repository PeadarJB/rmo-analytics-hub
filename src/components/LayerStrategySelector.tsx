// src/components/LayerStrategySelector.tsx
// PHASE 3: Layer Loading Strategy Selector Component

import React from 'react';
import { Card, Radio, Space, Typography, Tag, Tooltip, Alert } from 'antd';
import { 
  ThunderboltOutlined, 
  GlobalOutlined, 
  SwapOutlined,
  InfoCircleOutlined 
} from '@ant-design/icons';
import type { LayerStrategy } from '@/services/LayerService';
import useAppStore from '@/store/useAppStore';

const { Text, Paragraph } = Typography;

/**
 * Layer Strategy Selector Component
 * 
 * Allows users to choose between Direct, WebMap, or Hybrid loading strategies
 * Shows current strategy and performance metrics
 */
const LayerStrategySelector: React.FC = () => {
  const { layerStrategy, setLayerStrategy, layerLoadingState } = useAppStore();

  const handleStrategyChange = (strategy: LayerStrategy) => {
    setLayerStrategy(strategy);
  };

  const strategies = [
    {
      value: 'direct' as LayerStrategy,
      icon: <ThunderboltOutlined />,
      label: 'Direct',
      color: 'green',
      description: 'Fastest - Loads layers directly from Feature Service URLs',
      avgTime: '~4 seconds',
      pros: ['⚡ Fastest loading', '🎯 Direct connection'],
      cons: ['⚠️ Requires valid URLs configured']
    },
    {
      value: 'webmap' as LayerStrategy,
      icon: <GlobalOutlined />,
      label: 'WebMap',
      color: 'blue',
      description: 'Legacy - Loads layers from WebMap configuration',
      avgTime: '~20 seconds',
      pros: ['🛡️ Always reliable', '📦 Uses WebMap config'],
      cons: ['🐌 Slower loading', '🔍 Layer title matching required']
    },
    {
      value: 'hybrid' as LayerStrategy,
      icon: <SwapOutlined />,
      label: 'Hybrid',
      color: 'orange',
      description: 'Recommended - Tries direct first, falls back to WebMap if needed',
      avgTime: '~4 seconds + fallback',
      pros: ['⚡ Fast with fallback', '🛡️ Reliable', '✅ Best of both'],
      cons: ['🔀 More complex']
    }
  ];

  return (
    <Card
      title={
        <Space>
          <span>Layer Loading Strategy</span>
          <Tooltip title="Controls how feature layers are loaded into the application">
            <InfoCircleOutlined style={{ color: '#8c8c8c' }} />
          </Tooltip>
        </Space>
      }
      size="small"
    >
      <Radio.Group
        value={layerStrategy}
        onChange={(e) => handleStrategyChange(e.target.value)}
        style={{ width: '100%' }}
      >
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          {strategies.map((strategy) => (
            <Radio key={strategy.value} value={strategy.value}>
              <Space direction="vertical" size="small" style={{ marginLeft: 8 }}>
                <Space>
                  {strategy.icon}
                  <Text strong>{strategy.label}</Text>
                  <Tag color={strategy.color}>{strategy.avgTime}</Tag>
                  {layerStrategy === strategy.value && (
                    <Tag color="blue">Current</Tag>
                  )}
                </Space>
                <Text type="secondary" style={{ fontSize: '12px' }}>
                  {strategy.description}
                </Text>
                <Space wrap size={4}>
                  {strategy.pros.map((pro, idx) => (
                    <Tag key={idx} style={{ fontSize: '11px', margin: 0 }}>
                      {pro}
                    </Tag>
                  ))}
                </Space>
              </Space>
            </Radio>
          ))}
        </Space>
      </Radio.Group>

      {layerLoadingState.fallbackUsed && (
        <Alert
          type="warning"
          message="Fallback Used"
          description="Direct loading failed, WebMap fallback was used successfully."
          showIcon
          style={{ marginTop: 16 }}
          closable
        />
      )}

      {layerLoadingState.errors.length > 0 && (
        <Alert
          type="error"
          message="Loading Errors"
          description={layerLoadingState.errors.join(', ')}
          showIcon
          style={{ marginTop: 16 }}
          closable
        />
      )}

      <Paragraph type="secondary" style={{ marginTop: 16, marginBottom: 0, fontSize: '12px' }}>
        💡 Tip: Use <Text code>?layerStrategy=direct</Text> in URL to test different strategies
      </Paragraph>
    </Card>
  );
};

export default LayerStrategySelector;
