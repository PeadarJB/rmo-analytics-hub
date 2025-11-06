import React, { useEffect, useMemo, useState } from 'react';
import { Card, Select, Button, Space, Badge, Spin, theme } from 'antd'; // ADD Spin
import { FilterOutlined, ClearOutlined } from '@ant-design/icons'; // ADD icons
import useAppStore from '@/store/useAppStore';
import QueryService from '@/services/QueryService';
import { CONFIG } from '@/config/appConfig';
import { ROAD_FIELDS } from '@/config/layerConfig';

const EnhancedFilterPanel: React.FC = () => {
  const { roadLayer, currentFilters, setFilters, applyFilters, clearAllFilters, loading } = useAppStore();
  const [laOptions, setLaOptions] = useState<string[]>([]);
  const [routeOptions, setRouteOptions] = useState<string[]>([]);
  const [availableRoutes, setAvailableRoutes] = useState<string[]>([]);
  const [loadingRoutes, setLoadingRoutes] = useState<boolean>(false);
  const [loadingUniqueValues, setLoadingUniqueValues] = useState<boolean>(false);
  const { token } = theme.useToken();

  // Load unique values for LA on mount
  useEffect(() => {
    const loadUniqueValues = async () => {
      if (!roadLayer || !roadLayer.loaded) {
        console.log('[FilterPanel] Waiting for layer to load...');
        return;
      }

      try {
        setLoadingUniqueValues(true);
        const las = await QueryService.getUniqueValues(roadLayer, ROAD_FIELDS.la);
        const routes = await QueryService.getUniqueValues(roadLayer, ROAD_FIELDS.route);
        setLaOptions(las);
        setRouteOptions(routes);
        setAvailableRoutes(routes); // Initially show all routes
      } catch (error) {
        console.error('[FilterPanel] Error loading unique values:', error);
      } finally {
        setLoadingUniqueValues(false);
      }
    };

    loadUniqueValues();
  }, [roadLayer]); // Only depend on roadLayer

  // Update available routes when LA selection changes
  useEffect(() => {
    const fetchFilteredRoutes = async () => {
      if (!roadLayer) return;

      setLoadingRoutes(true);
      try {
        const routes = await QueryService.queryRoutesForLAs(
          roadLayer,
          currentFilters.localAuthority
        );
        setAvailableRoutes(routes);

        // Clear route selection if selected routes are no longer available
        if (currentFilters.route.length > 0) {
          const validRoutes = currentFilters.route.filter(r => routes.includes(r));
          if (validRoutes.length !== currentFilters.route.length) {
            console.log(`[FilterPanel] Removing ${currentFilters.route.length - validRoutes.length} invalid routes`);
            setFilters({ route: validRoutes });
          }
        }
      } catch (error) {
        console.error('Error fetching filtered routes:', error);
        setAvailableRoutes(routeOptions); // Fallback to all routes
      } finally {
        setLoadingRoutes(false);
      }
    };

    fetchFilteredRoutes();
  }, [roadLayer, currentFilters.localAuthority]);

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
      {(loading || loadingUniqueValues) ? (
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <Spin tip={loadingUniqueValues ? "Loading filter options..." : "Resetting filters..."} />
        </div>
      ) : (
        <Space direction="vertical" style={{ width: '100%' }}>
          {/* ... existing filter controls ... */}
          <div>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>Local Authority</div>
            <Select
              mode="multiple"
              style={{ width: '100%', cursor: 'pointer' }}
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
              style={{ width: '100%', cursor: 'pointer' }}
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
              style={{ width: '100%', cursor: 'pointer' }}
              placeholder={`Select Route (${availableRoutes.length} available)`}
              options={availableRoutes.map(v => ({ label: v, value: v }))}
              value={currentFilters.route}
              onChange={(vals) => setFilters({ route: vals })}
              disabled={loading || loadingRoutes}
              loading={loadingRoutes}
              notFoundContent={loadingRoutes ? 'Loading routes...' : 'No routes available'}
              filterOption={(input, option) =>
                (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
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
