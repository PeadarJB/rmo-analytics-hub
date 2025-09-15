import React, { useEffect, useRef, useState } from 'react';
import { Card, Select, Space, Spin, Alert, theme, Switch, message } from 'antd';
import { Chart, ChartConfiguration, ChartEvent, ActiveElement } from 'chart.js/auto';
import useAppStore from '@/store/useAppStore';
import { CONFIG, KPI_LABELS, RENDERER_CONFIG, KPI_THRESHOLDS, type KPIKey, getKPIFieldName } from '@/config/appConfig';
import QueryService from '@/services/QueryService';
import StatisticsService from '@/services/StatisticsService';
import type { GroupedConditionStats } from '@/types';
import Query from '@arcgis/core/rest/support/Query';

const groupByOptions = [
  { label: 'Local Authority', value: CONFIG.fields.la },
  { label: 'Route', value: CONFIG.fields.route },
  { label: 'Subgroup', value: 'subgroup' } 
];

const EnhancedChartPanel: React.FC = () => {
  const { roadLayer, activeKpi, currentFilters, mapView, setFilters } = useAppStore();
  const { token } = theme.useToken();
  const chartRef = useRef<HTMLCanvasElement | null>(null);
  const chartInstance = useRef<Chart | null>(null);
  const previousDefinitionExpression = useRef<string>('1=1');

  const [groupBy, setGroupBy] = useState<string>(CONFIG.defaultGroupBy);
  const [groupedData, setGroupedData] = useState<GroupedConditionStats[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [stackedMode, setStackedMode] = useState<boolean>(true);
  const [selectedSegment, setSelectedSegment] = useState<{group: string, condition: string} | null>(null);

  // Store the original definition expression when component mounts
  useEffect(() => {
    if (roadLayer) {
      previousDefinitionExpression.current = (roadLayer as any).definitionExpression || '1=1';
    }
  }, []);

  // Fetch data with condition breakdowns
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      
      try {
        let data: GroupedConditionStats[];
        
        if (stackedMode) {
          // Get detailed condition breakdowns for stacked chart
          data = await StatisticsService.computeGroupedStatisticsWithConditions(
            roadLayer,
            currentFilters,
            activeKpi,
            groupBy
          );
        } else {
          // Get simple averages for regular chart
          const simpleData = await QueryService.computeGroupedStatistics(
            roadLayer,
            getKPIFieldName(activeKpi, currentFilters.year[0] || CONFIG.defaultYears[0]),
            groupBy,
            (roadLayer as any)?.definitionExpression || '1=1'
          );
          
          // Convert to GroupedConditionStats format
          data = simpleData.map(d => ({
            group: d.group,
            avgValue: d.avgValue,
            totalCount: d.count,
            conditions: {
              veryGood: { count: 0, percentage: 0 },
              good: { count: 0, percentage: 0 },
              fair: { count: 0, percentage: 0 },
              poor: { count: 0, percentage: 0 },
              veryPoor: { count: 0, percentage: 0 }
            }
          }));
        }
        
        // Sort by average value
        data.sort((a, b) => b.avgValue - a.avgValue);
        setGroupedData(data);
        
      } catch (e: any) {
        console.error('Error fetching chart data:', e);
        setError(e.message);
        setGroupedData([]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [roadLayer, activeKpi, currentFilters, groupBy, stackedMode]);

  // Handle chart click to filter map features
  const handleChartClick = async (event: ChartEvent, elements: ActiveElement[]) => {
    if (!elements.length || !roadLayer || !mapView) return;
    
    const element = elements[0];
    const datasetIndex = element.datasetIndex;
    const dataIndex = element.index;
    
    // Get the clicked group and condition
    const clickedGroup = groupedData[dataIndex].group;
    const conditions = ['veryGood', 'good', 'fair', 'poor', 'veryPoor'];
    const clickedCondition = conditions[datasetIndex];
    
    // Check if clicking the same segment again (to toggle off)
    if (selectedSegment?.group === clickedGroup && selectedSegment?.condition === clickedCondition) {
      // Reset to previous filter state
      (roadLayer as any).definitionExpression = previousDefinitionExpression.current;
      setSelectedSegment(null);
      message.info('Filter cleared - showing previous selection');
      return;
    }
    
    console.log(`Filtering to: ${clickedGroup} - ${clickedCondition}`);
    setSelectedSegment({ group: clickedGroup, condition: clickedCondition });
    
    // Build where clause for the clicked group and condition
    const year = currentFilters.year[0] || CONFIG.defaultYears[0];
    const kpiField = getKPIFieldName(activeKpi, year);
    
    // Start with existing filters if any
    let whereClause = previousDefinitionExpression.current !== '1=1' 
      ? `(${previousDefinitionExpression.current}) AND ` 
      : '';
    
    // Add group filter
    if (groupBy === 'subgroup') {
      // Handle subgroup special case
      whereClause += buildSubgroupWhereClause(clickedGroup);
    } else {
      whereClause += `${groupBy} = '${clickedGroup.replace("'", "''")}'`;
    }
    
    // Add condition filter based on KPI thresholds
    const conditionClause = buildConditionWhereClause(kpiField, activeKpi, clickedCondition);
    whereClause += ' AND ' + conditionClause;
    
    // Apply the filter to the road layer
    (roadLayer as any).definitionExpression = whereClause;
    
    // Query for the extent of filtered features to zoom
    const query = new Query({
      where: whereClause,
      returnGeometry: false // Not needed for extent query, but being explicit is fine
    });
    
    try {
      const result = await roadLayer.queryExtent(query);
      
      if (result.extent) {
        await mapView.goTo(result.extent.expand(1.2), {
          duration: 1000
        });
        
        // Get count for feedback
        const countResult = await roadLayer.queryFeatureCount(new Query({ where: whereClause }));
        message.success(`Showing ${countResult} segments in ${clickedGroup} with ${clickedCondition.replace(/([A-Z])/g, ' $1').toLowerCase()} condition`);
      }
    } catch (error) {
      console.error('Error applying chart filter:', error);
      message.error('Failed to filter map features');
    }
  };

  // Build subgroup where clause
  const buildSubgroupWhereClause = (subgroup: string): string => {
    const subgroupOption = CONFIG.filters.subgroup.options?.find(opt => 
      opt.label === subgroup
    );
    
    if (subgroupOption) {
      if (subgroupOption.value === 'Rural') {
        return '(Roads_Joined_IsFormerNa = 0 AND Roads_Joined_IsDublin = 0 AND Roads_Joined_IsCityTown = 0 AND Roads_Joined_IsPeat = 0)';
      } else {
        return `${subgroupOption.value} = 1`;
      }
    }
    return '1=1';
  };

  // Build where clause for specific condition class
  const buildConditionWhereClause = (
    kpiField: string,
    kpi: KPIKey,
    conditionClass: string
  ): string => {
    const thresholds = KPI_THRESHOLDS[kpi];
    
    if (kpi === 'iri' || kpi === 'rut' || kpi === 'lpv3') {
      switch(conditionClass) {
        case 'veryGood': 
          return thresholds.veryGood ? `${kpiField} < ${thresholds.veryGood}` : `${kpiField} < ${thresholds.good}`;
        case 'good': 
          return thresholds.veryGood 
            ? `${kpiField} >= ${thresholds.veryGood} AND ${kpiField} < ${thresholds.good}`
            : `${kpiField} >= ${thresholds.good} AND ${kpiField} < ${thresholds.fair}`;
        case 'fair': 
          return `${kpiField} >= ${thresholds.good} AND ${kpiField} < ${thresholds.fair}`;
        case 'poor': 
          return thresholds.poor 
            ? `${kpiField} >= ${thresholds.fair} AND ${kpiField} < ${thresholds.poor}`
            : `${kpiField} >= ${thresholds.fair}`;
        case 'veryPoor': 
          return thresholds.poor ? `${kpiField} >= ${thresholds.poor}` : `${kpiField} >= ${thresholds.fair}`;
        default: 
          return '1=1';
      }
    } else if (kpi === 'csc') {
      // CSC is inverted (higher is better)
      switch(conditionClass) {
        case 'veryGood': 
          return `${kpiField} > ${thresholds.good}`;
        case 'good': 
          return `${kpiField} > ${thresholds.fair} AND ${kpiField} <= ${thresholds.good}`;
        case 'fair': 
          return `${kpiField} > ${thresholds.poor!} AND ${kpiField} <= ${thresholds.fair}`;
        case 'poor': 
          return `${kpiField} > ${thresholds.veryPoor!} AND ${kpiField} <= ${thresholds.poor!}`;
        case 'veryPoor': 
          return `${kpiField} <= ${thresholds.veryPoor!}`;
        default: 
          return '1=1';
      }
    } else if (kpi === 'psci') {
      switch(conditionClass) {
        case 'veryGood': return `${kpiField} > 8`;
        case 'good': return `${kpiField} > 6 AND ${kpiField} <= 8`;
        case 'fair': return `${kpiField} > 4 AND ${kpiField} <= 6`;
        case 'poor': return `${kpiField} > 2 AND ${kpiField} <= 4`;
        case 'veryPoor': return `${kpiField} <= 2`;
        default: return '1=1';
      }
    } else if (kpi === 'mpd') {
      switch(conditionClass) {
        case 'veryGood': 
        case 'good': 
          return `${kpiField} >= ${thresholds.good}`;
        case 'fair': 
          return `${kpiField} >= ${thresholds.poor} AND ${kpiField} < ${thresholds.good}`;
        case 'poor': 
        case 'veryPoor': 
          return `${kpiField} < ${thresholds.poor}`;
        default: 
          return '1=1';
      }
    }
    
    return '1=1';
  };

  // Clear selection when filters change
  useEffect(() => {
    if (roadLayer) {
      previousDefinitionExpression.current = (roadLayer as any).definitionExpression || '1=1';
      setSelectedSegment(null);
    }
  }, [currentFilters]);

  // Render chart
  useEffect(() => {
    if (!chartRef.current || loading || error || !groupedData.length) return;

    const labels = groupedData.map(d => d.group);
    
    let datasets: any[];
    
    if (stackedMode) {
      // Create stacked datasets for each condition class
      const colors = RENDERER_CONFIG.colors.fiveClass;
      
      datasets = [
        {
          label: 'Very Good',
          data: groupedData.map(d => d.conditions.veryGood.percentage),
          backgroundColor: `rgba(${colors.veryGood.slice(0, 3).join(',')}, 0.8)`,
          borderColor: `rgba(${colors.veryGood.slice(0, 3).join(',')}, 1)`,
          borderWidth: 1
        },
        {
          label: 'Good',
          data: groupedData.map(d => d.conditions.good.percentage),
          backgroundColor: `rgba(${colors.good.slice(0, 3).join(',')}, 0.8)`,
          borderColor: `rgba(${colors.good.slice(0, 3).join(',')}, 1)`,
          borderWidth: 1
        },
        {
          label: 'Fair',
          data: groupedData.map(d => d.conditions.fair.percentage),
          backgroundColor: `rgba(${colors.fair.slice(0, 3).join(',')}, 0.8)`,
          borderColor: `rgba(${colors.fair.slice(0, 3).join(',')}, 1)`,
          borderWidth: 1
        },
        {
          label: 'Poor',
          data: groupedData.map(d => d.conditions.poor.percentage),
          backgroundColor: `rgba(${colors.poor.slice(0, 3).join(',')}, 0.8)`,
          borderColor: `rgba(${colors.poor.slice(0, 3).join(',')}, 1)`,
          borderWidth: 1
        },
        {
          label: 'Very Poor',
          data: groupedData.map(d => d.conditions.veryPoor.percentage),
          backgroundColor: `rgba(${colors.veryPoor.slice(0, 3).join(',')}, 0.8)`,
          borderColor: `rgba(${colors.veryPoor.slice(0, 3).join(',')}, 1)`,
          borderWidth: 1
        }
      ];
    } else {
      // Simple bar chart with average values
      datasets = [{
        label: `Average ${KPI_LABELS[activeKpi]}`,
        data: groupedData.map(d => d.avgValue),
        backgroundColor: token.colorPrimary,
        borderRadius: 4
      }];
    }

    const config: ChartConfiguration = {
      type: 'bar',
      data: { labels, datasets },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: stackedMode ? 'point' : 'index',
          intersect: false
        },
        onClick: stackedMode ? handleChartClick : undefined,
        plugins: {
          legend: {
            display: stackedMode,
            position: 'bottom',
            labels: {
              padding: 15,
              font: { size: 11 }
            }
          },
          title: {
            display: true,
            text: `${KPI_LABELS[activeKpi]} by ${groupByOptions.find(o => o.value === groupBy)?.label || groupBy}${
              selectedSegment ? ` - Filtered to ${selectedSegment.group} (${selectedSegment.condition})` : ''
            }`
          },
          tooltip: {
            callbacks: {
              label: (context) => {
                if (stackedMode) {
                  const value = context.parsed.x;
                  const conditionKey = context.dataset.label!.toLowerCase().replace(' ', '') as keyof typeof groupedData[0]['conditions'];
                  const count = groupedData[context.dataIndex].conditions[conditionKey].count;
                  return `${context.dataset.label}: ${value.toFixed(1)}% (${count} segments)`;
                }
                return `${context.dataset.label}: ${context.parsed.x.toFixed(2)}`;
              },
              afterLabel: stackedMode ? () => 'Click to filter map' : undefined
            }
          }
        },
        scales: {
          x: {
            stacked: stackedMode,
            beginAtZero: true,
            max: stackedMode ? 100 : undefined,
            title: {
              display: true,
              text: stackedMode ? 'Percentage (%)' : 'Average Value'
            }
          },
          y: {
            stacked: stackedMode,
            title: {
              display: true,
              text: groupByOptions.find(o => o.value === groupBy)?.label || groupBy
            }
          }
        }
      }
    };

    if (chartInstance.current) {
      chartInstance.current.destroy();
    }

    chartInstance.current = new Chart(chartRef.current, config);

    return () => {
      if (chartInstance.current) {
        chartInstance.current.destroy();
        chartInstance.current = null;
      }
    };
  }, [groupedData, activeKpi, groupBy, loading, error, token, stackedMode, selectedSegment, handleChartClick]);

  return (
    <Card 
      size="small" 
      title="Charts"
      style={{ minHeight: '500px' }}
      extra={
        <Space>
          <Switch
            checked={stackedMode}
            onChange={setStackedMode}
            checkedChildren="Stacked"
            unCheckedChildren="Average"
            size="small"
          />
          <Select
            style={{ width: 180 }}
            options={groupByOptions}
            value={groupBy}
            onChange={setGroupBy}
            size="small"
          />
        </Space>
      }
    >
      {loading && (
        <div style={{ textAlign: 'center', padding: '50px 0' }}>
          <Spin size="large" />
          <div style={{ marginTop: '12px' }}>Loading chart data...</div>
        </div>
      )}
      {error && (
        <Alert message="Error" description={error} type="error" showIcon />
      )}
      {!loading && !error && groupedData.length > 0 && (
        <>
          <canvas ref={chartRef} height={700} />
          {stackedMode && (
            <div style={{ 
              marginTop: '8px', 
              fontSize: '12px', 
              color: token.colorTextSecondary,
              textAlign: 'center'
            }}>
              Click on any bar segment to filter the map • Click again to clear filter
            </div>
          )}
        </>
      )}
    </Card>
  );
};

export default EnhancedChartPanel;