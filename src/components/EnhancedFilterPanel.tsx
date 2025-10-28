import React, { useEffect, useMemo, useState } from 'react';
import { Card, Select, Button, Space, Badge, Spin, theme } from 'antd'; // ADD Spin
import { FilterOutlined, ClearOutlined } from '@ant-design/icons'; // ADD icons
import useAppStore from '@/store/useAppStore';
import QueryService from '@/services/QueryService';
import { CONFIG } from '@/config/appConfig';

const EnhancedFilterPanel: React.FC = () => {
  const { roadLayer, currentFilters, setFilters, applyFilters, clearAllFilters, loading } = useAppStore();
  const [laOptions, setLaOptions] = useState<string[]>([]);
  const [routeOptions, setRouteOptions] = useState<string[]>([]);
  const { token } = theme.useToken();

  useEffect(() => {
    // Load unique values for LA and Route only
    QueryService.getUniqueValues(roadLayer, CONFIG.fields.la).then(setLaOptions);
    QueryService.getUniqueValues(roadLayer, CONFIG.fields.route).then(setRouteOptions);
  }, [roadLayer]);

  const counter = useMemo(() => {
    return (currentFilters.localAuthority.length ? 1 : 0) +
           (currentFilters.subgroup.length ? 1 : 0) +
           (currentFilters.route.length ? 1 : 0);
  }, [currentFilters]);

  return (
    <Card 
      size="small" 
      title={<Space>Filters <Badge count={counter} /></Space>} 
      actions={[
        <Button 
          key="clear" 
          onClick={clearAllFilters}
          disabled={loading}
          icon={<ClearOutlined />}
          danger
        >
          Clear All
        </Button>,
        <Button 
          key="apply" 
          type="primary" 
          onClick={applyFilters}
          disabled={loading}
          icon={<FilterOutlined />}
          loading={loading}
        >
          Apply Filters
        </Button>
      ]}
    >
      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <Spin tip="Resetting filters..." />
        </div>
      ) : (
        <Space direction="vertical" style={{ width: '100%' }}>
          {/* ... existing filter controls ... */}
          <div>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>Local Authority</div>
            <Select
              mode="multiple"
              style={{ width: '100%' }}
              placeholder="Select Local Authority"
              options={laOptions.map(v => ({ label: v, value: v }))}
              value={currentFilters.localAuthority}
              onChange={(vals) => setFilters({ localAuthority: vals })}
              disabled={loading}
            />
          </div>
      
          <div>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>Subgroup</div>
            <Select
              mode="multiple"
              style={{ width: '100%' }}
              placeholder="Select Subgroup"
              options={CONFIG.filters.subgroup.options?.map(o => ({ 
                label: o.label, 
                value: o.code
              }))}
              value={currentFilters.subgroup}
              onChange={(vals) => setFilters({ subgroup: vals })}
              disabled={loading}
            />
          </div>
      
          <div>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>Route</div>
            <Select
              mode="multiple"
              showSearch
              style={{ width: '100%' }}
              placeholder="Select Route"
              options={routeOptions.map(v => ({ label: v, value: v }))}
              value={currentFilters.route}
              onChange={(vals) => setFilters({ route: vals })}
              disabled={loading}
            />
          </div>
        </Space>
      )}
      {counter > 0 && !loading && (
        <div style={{ 
          marginTop: 12, 
          padding: '8px 12px', 
          background: token.colorPrimaryBg,
          borderRadius: 4,
          fontSize: 12,
          color: token.colorPrimary
        }}>
          {counter} filter{counter > 1 ? 's' : ''} active. Clear All will reset while keeping year {currentFilters.year}.
        </div>
      )}
    </Card>
  );
};

export default EnhancedFilterPanel;
