import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { Card, Select, Space, Spin, Alert, theme, Switch, message, Button, Tag } from 'antd';
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
  const { 
    roadLayer, 
    activeKpi, 
    currentFilters, 
    mapView, 
    setFilters,
    // ADD THESE:
    chartSelections,
    isChartFilterActive,
    toggleChartSelection,
    clearChartSelections
  } = useAppStore();
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
  const [dataStatus, setDataStatus] = useState<'loading' | 'success' | 'no-data' | 'error'>('loading');
  const [errorDetails, setErrorDetails] = useState<string>('');

  // Use store-based selections for highlighting
  const highlightedBars = useMemo(() => {
    const highlighted = new Set<string>();
    chartSelections
      .filter(sel => sel.kpi === activeKpi) // Only highlight current KPI
      .forEach(sel => {
        highlighted.add(`${sel.group}_${sel.condition}`);
      });
    return highlighted;
  }, [chartSelections, activeKpi]);

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
        setDataStatus('loading');
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
          console.log('[Chart Debug] Fetching simple averages for:', {
            activeKpi,
            year: currentFilters.year[0] || CONFIG.defaultYears[0],
            groupBy,
            definitionExpression: (roadLayer as any)?.definitionExpression || '1=1'
          });
          
          const simpleData = await QueryService.computeGroupedStatistics(
            roadLayer,
            getKPIFieldName(activeKpi, currentFilters.year[0] || CONFIG.defaultYears[0]),
            groupBy,
            (roadLayer as any)?.definitionExpression || '1=1'
          );
          
          console.log('[Chart Debug] Raw QueryService result:', simpleData);
          
          // Convert to GroupedConditionStats format
          data = simpleData.map(d => {
            console.log('[Chart Debug] Processing group:', d.group, 'avgValue:', d.avgValue, 'count:', d.count);
            return {
              group: d.group,
              avgValue: d.avgValue || 0, // ADD DEFAULT VALUE
              totalCount: d.count || 0,  // ADD DEFAULT VALUE
              conditions: {
                veryGood: { count: 0, percentage: 0 },
                good: { count: 0, percentage: 0 },
                fair: { count: 0, percentage: 0 },
                poor: { count: 0, percentage: 0 },
                veryPoor: { count: 0, percentage: 0 }
              }
            }
          });
          
          console.log('[Chart Debug] Final converted data:', data);
        }
        
        // Sort by average value
        data.sort((a, b) => b.avgValue - a.avgValue);
        
        // Enhanced data validation
        if (!data || data.length === 0) {
          setDataStatus('no-data');
          setErrorDetails(`No ${groupByOptions.find(o => o.value === groupBy)?.label || groupBy} data available for ${KPI_LABELS[activeKpi]} in the current selection.`);
          setGroupedData([]);
          return;
        }
        
        // Check if all values are zero/null
        const hasValidValues = stackedMode 
          ? data.some(d => d.totalCount > 0)
          : data.some(d => d.avgValue && d.avgValue > 0);
          
        if (!hasValidValues) {
          setDataStatus('no-data');
          setErrorDetails(`All ${KPI_LABELS[activeKpi]} values are zero or unavailable for the current filters.`);
        } else {
          setDataStatus('success');
          setErrorDetails('');
        }
        
        setGroupedData(data);
        
      } catch (e: any) {
        console.error('Error fetching chart data:', e);
        setDataStatus('error');
        setErrorDetails(e.message || 'Failed to load chart data');
        setGroupedData([]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [roadLayer, activeKpi, currentFilters, groupBy, stackedMode]);

  const handleChartClick = useCallback(async (event: ChartEvent, elements: ActiveElement[]) => {
    if (!elements.length || !roadLayer || !mapView) return;
    
    const element = elements[0];
    const datasetIndex = element.datasetIndex;
    const dataIndex = element.index;
    
    // Get the clicked group and condition
    const clickedGroup = groupedData[dataIndex].group;
    const conditions = ['veryGood', 'good', 'fair', 'poor', 'veryPoor'];
    const clickedCondition = conditions[datasetIndex];
    
    // Create selection object
    const selection = {
      group: clickedGroup,
      condition: clickedCondition,
      kpi: activeKpi,
      year: currentFilters.year[0] || CONFIG.defaultYears[0]
    };
    
    // Check for multi-select modifiers
    const isMultiSelect = event.native && (
      (event.native as any).ctrlKey || 
      (event.native as any).metaKey || 
      (event.native as any).shiftKey
    );
    
    console.log('[Chart Click]', {
      selection,
      isMultiSelect,
      currentSelections: chartSelections.length
    });
    
    // Update selections in store
    toggleChartSelection(selection, isMultiSelect);
    
    // Apply map filtering based on all current selections
    await applyChartSelectionsToMap();
    
  }, [groupedData, roadLayer, mapView, activeKpi, currentFilters, toggleChartSelection, chartSelections]);

  const applyChartSelectionsToMap = useCallback(async () => {
    if (!roadLayer || !mapView) return;
    
    const state = useAppStore.getState();
    const selections = state.chartSelections;
    
    if (selections.length === 0) {
      // No selections - restore previous state
      (roadLayer as any).definitionExpression = previousDefinitionExpression.current;
      setSelectedSegment(null);
      message.info('Chart filter cleared');
      return;
    }
    
    // Build combined WHERE clause for all selections
    const whereClauses = selections.map(selection => {
      const year = selection.year;
      const kpiField = getKPIFieldName(selection.kpi, year);
      
      // Build group filter
      let groupClause = '';
      if (groupBy === 'subgroup') {
        groupClause = buildSubgroupWhereClause(selection.group);
      } else {
        groupClause = `${groupBy} = '${selection.group.replace("'", "''")}'`;
      }
      
      // Build condition filter
      const conditionClause = buildConditionWhereClause(kpiField, selection.kpi, selection.condition);
      
      return `(${groupClause} AND ${conditionClause})`;
    });

    // Combine all selection clauses with OR
    let combinedWhere = whereClauses.join(' OR ');
    
    // Add existing filters if any
    if (previousDefinitionExpression.current !== '1=1') {
      combinedWhere = `(${previousDefinitionExpression.current}) AND (${combinedWhere})`;
    }

    // Apply to road layer
    (roadLayer as any).definitionExpression = combinedWhere;
    
    // Zoom to filtered features
    try {
      const query = new Query({ where: combinedWhere, returnGeometry: false });
      const result = await roadLayer.queryExtent(query);
      
      if (result.extent) {
        await mapView.goTo(result.extent.expand(1.2), { duration: 1000 });
        
        const countResult = await roadLayer.queryFeatureCount(new Query({ where: combinedWhere }));
        message.success(`Showing ${countResult} segments from ${selections.length} chart selection${selections.length > 1 ? 's' : ''}`);
      }
    } catch (error) {
      console.error('Error applying chart filter:', error);
      message.error('Failed to filter map features');
    }
  }, [roadLayer, mapView, groupBy, previousDefinitionExpression]);

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
          backgroundColor: groupedData.map((d, index) => {
            const key = `${d.group}_veryGood`;
            const opacity = highlightedBars.has(key) ? 1.0 : 0.8;
            return `rgba(${colors.veryGood.slice(0, 3).join(',')}, ${opacity})`;
          }),
          borderColor: groupedData.map((d, index) => {
            const key = `${d.group}_veryGood`;
            return highlightedBars.has(key) 
              ? `rgba(${colors.veryGood.slice(0, 3).join(',')}, 1)`
              : `rgba(${colors.veryGood.slice(0, 3).join(',')}, 0.6)`;
          }),
          borderWidth: groupedData.map((d, index) => {
            const key = `${d.group}_veryGood`;
            return highlightedBars.has(key) ? 3 : 1;
          })
        },
        {
          label: 'Good',
          data: groupedData.map(d => d.conditions.good.percentage),
          backgroundColor: groupedData.map((d, index) => {
            const key = `${d.group}_good`;
            const opacity = highlightedBars.has(key) ? 1.0 : 0.8;
            return `rgba(${colors.good.slice(0, 3).join(',')}, ${opacity})`;
          }),
          borderColor: groupedData.map((d, index) => {
            const key = `${d.group}_good`;
            return highlightedBars.has(key) 
              ? `rgba(${colors.good.slice(0, 3).join(',')}, 1)`
              : `rgba(${colors.good.slice(0, 3).join(',')}, 0.6)`;
          }),
          borderWidth: groupedData.map((d, index) => {
            const key = `${d.group}_good`;
            return highlightedBars.has(key) ? 3 : 1;
          })
        },
        {
          label: 'Fair',
          data: groupedData.map(d => d.conditions.fair.percentage),
          backgroundColor: groupedData.map((d, index) => {
            const key = `${d.group}_fair`;
            const opacity = highlightedBars.has(key) ? 1.0 : 0.8;
            return `rgba(${colors.fair.slice(0, 3).join(',')}, ${opacity})`;
          }),
          borderColor: groupedData.map((d, index) => {
            const key = `${d.group}_fair`;
            return highlightedBars.has(key) 
              ? `rgba(${colors.fair.slice(0, 3).join(',')}, 1)`
              : `rgba(${colors.fair.slice(0, 3).join(',')}, 0.6)`;
          }),
          borderWidth: groupedData.map((d, index) => {
            const key = `${d.group}_fair`;
            return highlightedBars.has(key) ? 3 : 1;
          })
        },
        {
          label: 'Poor',
          data: groupedData.map(d => d.conditions.poor.percentage),
          backgroundColor: groupedData.map((d, index) => {
            const key = `${d.group}_poor`;
            const opacity = highlightedBars.has(key) ? 1.0 : 0.8;
            return `rgba(${colors.poor.slice(0, 3).join(',')}, ${opacity})`;
          }),
          borderColor: groupedData.map((d, index) => {
            const key = `${d.group}_poor`;
            return highlightedBars.has(key) 
              ? `rgba(${colors.poor.slice(0, 3).join(',')}, 1)`
              : `rgba(${colors.poor.slice(0, 3).join(',')}, 0.6)`;
          }),
          borderWidth: groupedData.map((d, index) => {
            const key = `${d.group}_poor`;
            return highlightedBars.has(key) ? 3 : 1;
          })
        },
        {
          label: 'Very Poor',
          data: groupedData.map(d => d.conditions.veryPoor.percentage),
          backgroundColor: groupedData.map((d, index) => {
            const key = `${d.group}_veryPoor`;
            const opacity = highlightedBars.has(key) ? 1.0 : 0.8;
            return `rgba(${colors.veryPoor.slice(0, 3).join(',')}, ${opacity})`;
          }),
          borderColor: groupedData.map((d, index) => {
            const key = `${d.group}_veryPoor`;
            return highlightedBars.has(key) 
              ? `rgba(${colors.veryPoor.slice(0, 3).join(',')}, 1)`
              : `rgba(${colors.veryPoor.slice(0, 3).join(',')}, 0.6)`;
          }),
          borderWidth: groupedData.map((d, index) => {
            const key = `${d.group}_veryPoor`;
            return highlightedBars.has(key) ? 3 : 1;
          })
        }
      ];
    } else {
      // Simple bar chart with average values
      const chartData = groupedData.map(d => d.avgValue);
      console.log('[Chart Debug] Chart data for rendering:', chartData);
      console.log('[Chart Debug] GroupedData avgValues:', groupedData.map(d => ({ group: d.group, avgValue: d.avgValue })));
      
      datasets = [{
        label: `Average ${KPI_LABELS[activeKpi]}`,
        data: chartData,
        backgroundColor: token.colorPrimary,
        borderRadius: 4,
        // ADD: Ensure bars are visible even with small values
        borderWidth: 1,
        borderColor: token.colorPrimary
      }];
      
      // DEBUG: Log if all values are zero/null
      const hasValidData = chartData.some(val => val && val > 0);
      if (!hasValidData) {
        console.warn('[Chart Debug] All chart values are zero or null!');
      }
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
        // ADD THIS: Cursor pointer on hover
        onHover: (event, elements) => {
          const canvas = event.native?.target as HTMLCanvasElement;
          if (canvas) {
            canvas.style.cursor = elements.length > 0 && stackedMode ? 'pointer' : 'default';
          }
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
  }, [groupedData, activeKpi, groupBy, loading, error, token, stackedMode, selectedSegment, highlightedBars, chartSelections, handleChartClick]);

  return (
    <Card 
      size="small" 
      title={
        <Space>
          Charts
          {isChartFilterActive && (
            <Tag color="blue">
              {chartSelections.length} selected
            </Tag>
          )}
        </Space>
      }
      style={{ minHeight: '500px' }}
      extra={
        <Space>
          {isChartFilterActive && (
            <Button
              size="small"
              onClick={() => {
                clearChartSelections();
                (roadLayer as any).definitionExpression = previousDefinitionExpression.current;
                setSelectedSegment(null);
              }}
              type="text"
              danger
            >
              Clear Selection
            </Button>
          )}
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

      {dataStatus === 'error' && (
        <Alert 
          message="Chart Loading Error" 
          description={`Failed to load ${KPI_LABELS[activeKpi]} data: ${errorDetails}`}
          type="error" 
          showIcon 
          style={{ margin: '20px' }}
        />
      )}

      {dataStatus === 'no-data' && (
        <Alert 
          message="No Chart Data Available" 
          description={errorDetails}
          type="info" 
          showIcon 
          style={{ margin: '20px' }}
          action={
            <Button 
              size="small" 
              onClick={() => window.location.reload()}
            >
              Refresh
            </Button>
          }
        />
      )}
      
      {!loading && dataStatus === 'success' && groupedData.length > 0 && (
        <>
          <canvas ref={chartRef} height={700} />
          {stackedMode && (
            <div style={{
              marginTop: '8px',
              fontSize: '12px',
              color: token.colorTextSecondary,
              textAlign: 'center'
            }}>
              Click to select • Ctrl+Click for multiple selections • Click again to deselect
            </div>
          )}
        </>
      )}
    </Card>
  );
};

export default EnhancedChartPanel;