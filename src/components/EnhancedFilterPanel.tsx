import React, { useEffect, useMemo, useState } from 'react';
import { Card, Select, Button, Space, Badge } from 'antd';
import useAppStore from '@/store/useAppStore';
import QueryService from '@/services/QueryService';
import { CONFIG } from '@/config/appConfig';

const EnhancedFilterPanel: React.FC = () => {
  const { roadLayer, currentFilters, setFilters, applyFilters, clearAllFilters } = useAppStore();
  const [laOptions, setLaOptions] = useState<string[]>([]);
  const [routeOptions, setRouteOptions] = useState<string[]>([]);
  const [yearOptions, setYearOptions] = useState<string[]>(CONFIG.filters.year.options?.map(o => String(o.value)) || []);

  useEffect(() => {
    QueryService.getUniqueValues(roadLayer, CONFIG.fields.la).then(setLaOptions);
    QueryService.getUniqueValues(roadLayer, CONFIG.fields.route).then(setRouteOptions);
    QueryService.getUniqueValues(roadLayer, CONFIG.fields.year).then((vals) => {
      if (vals.length) setYearOptions(vals);
    });
  }, [roadLayer]);

  const counter = useMemo(() => {
    return (currentFilters.localAuthority.length ? 1 : 0) +
           (currentFilters.subgroup.length ? 1 : 0) +
           (currentFilters.route.length ? 1 : 0) +
           (currentFilters.year.length ? 1 : 0);
  }, [currentFilters]);

  return (
    <Card size="small" title={<Space>Filters <Badge count={counter} /></Space>} actions={[
      <Button key="clear" onClick={clearAllFilters}>Clear All</Button>,
      <Button key="apply" type="primary" onClick={applyFilters}>Apply Filters</Button>
    ]}>
      <Space direction="vertical" style={{ width: '100%' }}>
        <div>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Local Authority</div>
          <Select
            mode="multiple"
            style={{ width: '100%' }}
            placeholder="Select Local Authority"
            options={laOptions.map(v => ({ label: v, value: v }))}
            value={currentFilters.localAuthority}
            onChange={(vals) => setFilters({ localAuthority: vals })}
          />
        </div>

        <div>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Subgroup</div>
          <Select
            mode="multiple"
            style={{ width: '100%' }}
            placeholder="Select Subgroup"
            options={CONFIG.filters.subgroup.options?.map(o => ({ label: o.label, value: o.value }))}
            value={currentFilters.subgroup}
            onChange={(vals) => setFilters({ subgroup: vals })}
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
          />
        </div>

        <div>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Year</div>
          <Select
            mode="multiple"
            style={{ width: '100%' }}
            placeholder="Select Survey Year"
            options={yearOptions.map(v => ({ label: v, value: Number(v) }))}
            value={currentFilters.year}
            onChange={(vals) => setFilters({ year: vals })}
          />
        </div>
      </Space>
    </Card>
  );
};

export default EnhancedFilterPanel;
