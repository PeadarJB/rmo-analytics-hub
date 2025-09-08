import React, { useEffect, useMemo, useState } from 'react';
import { Card, Select, Button, Space, Badge } from 'antd';
import useAppStore from '@/store/useAppStore';
import QueryService from '@/services/QueryService';
import { CONFIG } from '@/config/appConfig';

const EnhancedFilterPanel: React.FC = () => {
  const { roadLayer, currentFilters, setFilters, applyFilters, clearAllFilters } = useAppStore();
  const [laOptions, setLaOptions] = useState<string[]>([]);
  const [routeOptions, setRouteOptions] = useState<string[]>([]);
  
  // FIX: Initialize with numbers from CONFIG, not strings
  const [yearOptions, setYearOptions] = useState<number[]>(
    CONFIG.filters.year.options?.map(o => o.value) || []
  );

  useEffect(() => {
    // Load unique values for LA and Route
    QueryService.getUniqueValues(roadLayer, CONFIG.fields.la).then(setLaOptions);
    QueryService.getUniqueValues(roadLayer, CONFIG.fields.route).then(setRouteOptions);
    
    // FIX: Convert year values to numbers when loading from QueryService
    QueryService.getUniqueValues(roadLayer, CONFIG.fields.year).then((vals) => {
      if (vals.length) {
        // Convert string values to numbers and filter out any invalid values
        const numericYears = vals
          .map(v => parseInt(v, 10))
          .filter(v => !isNaN(v) && v > 2000 && v < 2100); // Basic validation for reasonable years
        
        if (numericYears.length > 0) {
          setYearOptions(numericYears);
        }
      }
    });
  }, [roadLayer]);

  const counter = useMemo(() => {
    return (currentFilters.localAuthority.length ? 1 : 0) +
           (currentFilters.subgroup.length ? 1 : 0) +
           (currentFilters.route.length ? 1 : 0) +
           (currentFilters.year.length ? 1 : 0);
  }, [currentFilters]);

  return (
    <Card 
      size="small" 
      title={<Space>Filters <Badge count={counter} /></Space>} 
      actions={[
        <Button key="clear" onClick={clearAllFilters}>Clear All</Button>,
        <Button key="apply" type="primary" onClick={applyFilters}>Apply Filters</Button>
      ]}
    >
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
            options={CONFIG.filters.subgroup.options?.map(o => ({ 
              label: o.label, 
              value: o.code   // CHANGED from o.value → o.code
            }))}
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
            // FIX: Ensure year options are properly formatted with numeric values
            options={yearOptions.map(v => ({ 
              label: String(v), // Display as string
              value: v          // Store as number
            }))}
            value={currentFilters.year}
            // FIX: Ensure onChange converts values to numbers
            onChange={(vals) => {
              // vals should already be numbers from the options, but ensure they are
              const numericYears = vals.map(v => 
                typeof v === 'number' ? v : parseInt(v as any, 10)
              );
              setFilters({ year: numericYears });
            }}
          />
        </div>
      </Space>
    </Card>
  );
};

export default EnhancedFilterPanel;