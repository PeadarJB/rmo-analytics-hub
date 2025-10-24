import React from 'react';
import { Card, Switch, Radio, Space, Typography, Divider } from 'antd';
import type { RadioChangeEvent } from 'antd';
import useAppStore from '@/store/useAppStore';
import { LAMetricType } from '@/config/appConfig';
import { EyeOutlined, EyeInvisibleOutlined } from '@ant-design/icons';

const { Text } = Typography;

/**
 * Control panel for LA (Local Authority) polygon layer
 * Provides visibility toggle and metric type selection
 */
const LALayerControl: React.FC = () => {
  const { 
    laLayerVisible, 
    laMetricType, 
    setLALayerVisible, 
    setLAMetricType 
  } = useAppStore();

  const handleVisibilityChange = (checked: boolean) => {
    console.log(`LA Layer visibility: ${checked}`);
    setLALayerVisible(checked);
  };

  const handleMetricTypeChange = (e: RadioChangeEvent) => {
    const newType = e.target.value as LAMetricType;
    console.log(`LA Layer metric type: ${newType}`);
    setLAMetricType(newType);
  };

  return (
    <Card
      title={
        <Space>
          {laLayerVisible ? <EyeOutlined /> : <EyeInvisibleOutlined />}
          <span>County Overview Layer</span>
        </Space>
      }
      size="small"
      style={{ marginBottom: 16 }}
    >
      <Space direction="vertical" style={{ width: '100%' }} size="middle">
        {/* Visibility Toggle */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text>Show County Layer</Text>
          <Switch 
            checked={laLayerVisible} 
            onChange={handleVisibilityChange}
            checkedChildren="ON"
            unCheckedChildren="OFF"
          />
        </div>

        <Divider style={{ margin: '8px 0' }} />

        {/* Metric Type Selection */}
        <div>
          <Text strong style={{ display: 'block', marginBottom: 8 }}>
            Visualization Mode:
          </Text>
          <Radio.Group 
            value={laMetricType} 
            onChange={handleMetricTypeChange}
            disabled={!laLayerVisible}
            style={{ width: '100%' }}
          >
            <Space direction="vertical" style={{ width: '100%' }}>
              <Radio value="average">
                <Space direction="vertical" size={0}>
                  <Text>Average Values</Text>
                  <Text type="secondary" style={{ fontSize: '12px' }}>
                    County average KPI values
                  </Text>
                </Space>
              </Radio>
              <Radio value="fairOrBetter">
                <Space direction="vertical" size={0}>
                  <Text>Fair or Better %</Text>
                  <Text type="secondary" style={{ fontSize: '12px' }}>
                    % of roads in acceptable condition
                  </Text>
                </Space>
              </Radio>
            </Space>
          </Radio.Group>
        </div>

        {/* Info Text */}
        {laLayerVisible && (
          <>
            <Divider style={{ margin: '8px 0' }} />
            <Text type="secondary" style={{ fontSize: '12px' }}>
              {laMetricType === 'average' 
                ? 'Shows county-level averages with threshold-based colors'
                : 'Shows percentage of network in Fair or Better condition'}
            </Text>
          </>
        )}
      </Space>
    </Card>
  );
};

export default LALayerControl;