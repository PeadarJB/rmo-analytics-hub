import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { Card, Select, Space, Spin, Alert, theme, Switch, message, Button, Tag } from 'antd';
import { Chart, ChartConfiguration, ChartEvent, ActiveElement } from 'chart.js/auto';
import { useDebouncedCallback } from '@/hooks/useDebounce';
import useAppStore from '@/store/useAppStore';
import { CONFIG, RENDERER_CONFIG, getKPIFieldName } from '@/config/appConfig';
import { KPI_LABELS, type KPIKey } from '@/config/kpiConfig';
import QueryService from '@/services/QueryService';
import { getChartThemeColors } from '@/utils/themeHelpers';
import StatisticsService from '@/services/StatisticsService';
import type { FilterState, GroupedConditionStats } from '@/types';
import Query from '@arcgis/core/rest/support/Query';
import type { SummaryStatistics } from '@/types';

const groupByOptions = [
  { label: 'Local Authority', value: CONFIG.fields.la },
  { label: 'Route', value: CONFIG.fields.route },
  { label: 'Subgroup', value: 'subgroup' } 
];

const buildSubgroupWhereClause = (subgroup: string): string => {
  const subgroupOption = CONFIG.filters.subgroup.options?.find(opt => 
    opt.label === subgroup
  );
  
  if (subgroupOption) {
    // This logic is based on how subgroups are defined in the data
    const fieldName = CONFIG.filters.subgroup.options.find(o => o.code === subgroupOption.code)?.value;
    if (fieldName) {
      return `${fieldName} = 1`;
    }
  }
  // Fallback for 'Rural' or if not found
  if (subgroup === 'Rural') {
    const definedSubgroups = CONFIG.filters.subgroup.options
      .filter(o => o.value !== 'Rural')
      .map(o => `${o.value} = 0`)
      .join(' AND ');
    return `(${definedSubgroups})`;
  }
  return '1=1';
};

const buildConditionWhereClause = (
  kpi: KPIKey,
  year: number,
  conditionClass: string
): string => {
  const classValue = {
    'veryGood': 1,
    'good': 2,
    'fair': 3,
    'poor': 4,
    'veryPoor': 5
  }[conditionClass];

  if (classValue) {
    const classFieldName = getKPIFieldName(kpi, year, true);
    return `${classFieldName} = ${classValue}`;
  }
  return '1=1';
};

const EnhancedChartPanel: React.FC = React.memo(() => {
  const {
    roadLayer,
    activeKpi,
    currentFilters,
    mapView,
    setFilters,
    chartSelections,
    isChartFilterActive,
    toggleChartSelection,
    clearChartSelections,
    themeMode
  } = useAppStore();
  const { token } = theme.useToken();
  const chartRef = useRef<HTMLCanvasElement | null>(null);
  const chartInstance = useRef<Chart | null>(null);
  const previousDefinitionExpression = useRef<string>('1=1');
  const renderCount = useRef(0);

  const [groupBy, setGroupBy] = useState<string>(CONFIG.defaultGroupBy);
  const [groupedData, setGroupedData] = useState<GroupedConditionStats[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [stackedMode, setStackedMode] = useState<boolean>(true);
  const [selectedSegment, setSelectedSegment] = useState<{group: string, condition: string} | null>(null);
  const [dataStatus, setDataStatus] = useState<'loading' | 'success' | 'no-data' | 'error'>('loading');
  const [errorDetails, setErrorDetails] = useState<string>('');

  // Track renders for performance monitoring
  renderCount.current += 1;
  console.log(`[Chart Render] #${renderCount.current}`);

  // Get theme-aware colors
  const themeColors = useMemo(() => 
    RENDERER_CONFIG.getThemeAwareColors(), 
    [themeMode] // Depend on themeMode to refetch colors when theme changes
  );

  // Use store-based selections for highlighting
  const highlightedBars = useMemo(() => {
    const highlighted = new Set<string>();
    chartSelections
      .filter(sel => sel.kpi === activeKpi)
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

  // Data fetching logic
  const fetchData = async (
    layer: __esri.FeatureLayer, 
    filters: FilterState, 
    kpi: KPIKey, 
    grpBy: string, 
    isStacked: boolean
  ) => {
    setLoading(true);
    setError(null);
    setDataStatus('loading');

    try {
      let data: GroupedConditionStats[];
      
      if (isStacked) {
        data = await StatisticsService.computeGroupedStatisticsWithConditions(
          layer,
          filters,
          kpi,
          grpBy
        );
      } else {
        let simpleData;
        const kpiField = getKPIFieldName(kpi, filters.year || CONFIG.defaultYear);
        const whereClause = (layer as any)?.definitionExpression || '1=1';

        if (grpBy === 'subgroup') {
          console.log('[Chart Debug] Fetching subgroup averages...');
          simpleData = await QueryService.computeSubgroupStatistics(
            layer,
            kpiField,
            whereClause
          );
        } else {
          console.log('[Chart Debug] Fetching simple averages for:', {
            activeKpi: kpi,
            year: filters.year || CONFIG.defaultYear,
            groupBy: grpBy,
            definitionExpression: whereClause
          });
          simpleData = await QueryService.computeGroupedStatistics(
            layer,
            kpiField,
            grpBy,
            whereClause
          );
        }
        
        console.log('[Chart Debug] Raw QueryService result:', simpleData);
        
        data = simpleData.map(d => {
          console.log('[Chart Debug] Processing group:', d.group, 'avgValue:', d.avgValue, 'count:', d.count);
          const partialStats: Partial<SummaryStatistics> = {
            avgValue: d.avgValue || 0,
            totalSegments: d.count || 0,
          };
          return ({
            group: d.group,
            stats: partialStats as SummaryStatistics
          });
        });
        
        console.log('[Chart Debug] Final converted data:', data);
      }
      
      if (!data || data.length === 0) {
        setDataStatus('no-data');
        setErrorDetails(`No ${groupByOptions.find(o => o.value === grpBy)?.label || grpBy} data available for ${KPI_LABELS[kpi]} in the current selection.`);
        setGroupedData([]);
        return;
      }
      
      const hasValidValues = isStacked 
        ? data.some(d => d.stats.totalSegments > 0)
        : data.some(d => d.stats.avgValue && d.stats.avgValue > 0);

      if (!isStacked) {
        data.sort((a, b) => (b.stats.avgValue || 0) - (a.stats.avgValue || 0));
      }
        
      if (!hasValidValues) {
        setDataStatus('no-data');
        setErrorDetails(`All ${KPI_LABELS[kpi]} values are zero or unavailable for the current filters.`);
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

  // Create a debounced version of the data fetcher
  const debouncedFetchData = useDebouncedCallback(fetchData, 300);

  // Effect to trigger data fetching when dependencies change
  useEffect(() => {
    if (!roadLayer) {
      setDataStatus('no-data');
      setErrorDetails('Road layer not available.');
      setGroupedData([]);
      return;
    }
    debouncedFetchData(roadLayer, currentFilters, activeKpi, groupBy, stackedMode);
  }, [roadLayer, activeKpi, currentFilters, groupBy, stackedMode, debouncedFetchData]);

  const handleChartClick = useCallback(async (event: ChartEvent, elements: ActiveElement[]) => {
    if (!elements.length || !roadLayer || !mapView) return;
    
    const element = elements[0];
    const datasetIndex = element.datasetIndex;
    const dataIndex = element.index;
    
    const clickedGroup = groupedData[dataIndex].group;
    const conditions = ['veryGood', 'good', 'fair', 'poor', 'veryPoor'];
    const clickedCondition = conditions[datasetIndex];
    
    const selection = {
      group: clickedGroup,
      condition: clickedCondition,
      kpi: activeKpi,
      year: currentFilters.year || CONFIG.defaultYear
    };
    
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
    
    toggleChartSelection(selection, isMultiSelect);
    await applyChartSelectionsToMap();
    
  }, [groupedData, roadLayer, mapView, activeKpi, currentFilters, toggleChartSelection, chartSelections]);

  const applyChartSelectionsToMap = useCallback(async () => {
    if (!roadLayer || !mapView) return;
    
    const state = useAppStore.getState();
    const selections = state.chartSelections;
    
    if (selections.length === 0) {
      (roadLayer as any).definitionExpression = previousDefinitionExpression.current;
      setSelectedSegment(null);
      message.info('Chart filter cleared');
      return;
    }
    
    const whereClauses = selections.map(selection => {
      const year = selection.year;

      let groupClause = '';
      if (groupBy === 'subgroup') {
        groupClause = buildSubgroupWhereClause(selection.group);
      } else {
        groupClause = `${groupBy} = '${selection.group.replace("'", "''")}'`;
      }

      const conditionClause = buildConditionWhereClause(selection.kpi, year, selection.condition);

      return `(${groupClause} AND ${conditionClause})`;
    });

    let combinedWhere = whereClauses.join(' OR ');

    if (previousDefinitionExpression.current !== '1=1') {
      combinedWhere = `(${previousDefinitionExpression.current}) AND (${combinedWhere})`;
    }

    console.log('[Chart Filter] Applying WHERE clause:', combinedWhere);
    (roadLayer as any).definitionExpression = combinedWhere;
    
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

  useEffect(() => {
    if (roadLayer) {
      previousDefinitionExpression.current = (roadLayer as any).definitionExpression || '1=1';
      setSelectedSegment(null);
    }
  }, [currentFilters]);

  // Helper function to create chart colors with theme awareness
  const createChartColors = useCallback((conditionType: keyof typeof themeColors, groupData: GroupedConditionStats[]) => {
    const baseColor = themeColors[conditionType];
    
    return {
      backgroundColor: groupData.map(d => {
        const key = `${d.group}_${conditionType}`;
        const opacity = highlightedBars.has(key) ? 1.0 : 0.8;
        return `rgba(${(baseColor as number[]).slice(0, 3).join(',')}, ${opacity})`;
      }),
      borderColor: groupData.map(d => {
        const key = `${d.group}_${conditionType}`;
        const opacity = highlightedBars.has(key) ? 1.0 : 0.6;
        return `rgba(${(baseColor as number[]).slice(0, 3).join(',')}, ${opacity})`;
      }),
      borderWidth: groupData.map(d => {
        const key = `${d.group}_${conditionType}`;
        return highlightedBars.has(key) ? 3 : 1;
      })
    };
  }, [themeColors, highlightedBars]);

  const chartDatasets = useMemo(() => {
    if (dataStatus !== 'success' || !groupedData.length) return [];
    
    const labels = groupedData.map(d => d.group);
    let datasets: any[];
    if (stackedMode) {
      datasets = [
        {
          label: 'Very Good',
          data: groupedData.map(d => d.stats.veryGoodPct),
          ...createChartColors('veryGood', groupedData)
        },
        {
          label: 'Good',
          data: groupedData.map(d => d.stats.goodPct),
          ...createChartColors('good', groupedData)
        },
        {
          label: 'Fair',
          data: groupedData.map(d => d.stats.fairPct),
          ...createChartColors('fair', groupedData)
        },
        {
          label: 'Poor',
          data: groupedData.map(d => d.stats.poorPct),
          ...createChartColors('poor', groupedData)
        },
        {
          label: 'Very Poor',
          data: groupedData.map(d => d.stats.veryPoorPct),
          ...createChartColors('veryPoor', groupedData)
        }
      ];
    } else {
      const chartData = groupedData.map(d => d.stats.avgValue);
      console.log('[Chart Debug] Chart data for rendering:', chartData);
      datasets = [{
        label: `Average ${KPI_LABELS[activeKpi]}`,
        data: chartData,
        backgroundColor: token.colorPrimary,
        borderRadius: 4,
        borderWidth: 1,
        borderColor: token.colorPrimary
      }];
      
      const hasValidData = chartData.some(val => val && val > 0);
      if (!hasValidData) {
        console.warn('[Chart Debug] All chart values are zero or null!');
      }
    }
    return datasets;
  }, [groupedData, dataStatus, stackedMode, activeKpi, token, createChartColors]);

  const chartConfig = useMemo(() => {
    const labels = groupedData.map(d => d.group);
    const chartThemeColors = getChartThemeColors();

    const config: ChartConfiguration = {
      type: 'bar',
      data: { labels, datasets: chartDatasets },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: stackedMode ? 'point' : 'index',
          intersect: false
        },
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
              font: { size: 11 },
              color: chartThemeColors.labels
            }
          },
          title: {
            display: true,
            text: `${KPI_LABELS[activeKpi]} by ${groupByOptions.find(o => o.value === groupBy)?.label || groupBy}${
              selectedSegment ? ` - Filtered to ${selectedSegment.group} (${selectedSegment.condition})` : ''
            }`,
            color: chartThemeColors.labels
          },
          tooltip: {
            backgroundColor: chartThemeColors.tooltipBg,
            titleColor: chartThemeColors.labels,
            bodyColor: chartThemeColors.labels,
            borderColor: token.colorBorder,
            borderWidth: 1,
            callbacks: {
              label: (context) => {
                if (stackedMode) {
                  const value = context.parsed.x;
                  if (value === null) return '';
                  const conditionKey = (context.dataset.label!.toLowerCase().replace(' ', '') + 'Count') as keyof SummaryStatistics;
                  const count = (groupedData[context.dataIndex].stats as any)[conditionKey] || 0;
                  return `${context.dataset.label}: ${value.toFixed(1)}% (${count} segments)`;
                }
                const xValue = context.parsed.x;
                if (xValue === null) return '';
                return `${context.dataset.label}: ${xValue.toFixed(2)}`;
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
              text: stackedMode ? 'Percentage (%)' : 'Average Value',
              color: chartThemeColors.labels
            },
            ticks: {
              color: chartThemeColors.labels
            },
            grid: {
              color: chartThemeColors.gridLines
            }
          },
          y: {
            stacked: stackedMode,
            title: {
              display: true,
              text: groupByOptions.find(o => o.value === groupBy)?.label || groupBy,
              color: chartThemeColors.labels
            },
            ticks: {
              color: chartThemeColors.labels
            },
            grid: {
              color: chartThemeColors.gridLines
            }
          }
        }
      }
    };

    return config;
  }, [groupedData, chartDatasets, activeKpi, groupBy, stackedMode, selectedSegment, handleChartClick, token]);

  // Initialize or update chart
  useEffect(() => {
    if (!chartRef.current || dataStatus !== 'success' || !groupedData.length) return;

    // Create chart instance only once
    if (!chartInstance.current) {
      console.log('[Chart Init] Creating new chart instance');
      chartInstance.current = new Chart(chartRef.current, chartConfig);
    } else {
      // Update existing chart in-place
      console.log('[Chart Update] Updating chart in-place');

      // Update data
      chartInstance.current.data = chartConfig.data;

      // Update options
      chartInstance.current.options = chartConfig.options as any;

      // Update without animation for instant feedback
      chartInstance.current.update('none');
    }
  }, [dataStatus, groupedData, chartConfig]);

  // Cleanup only on unmount
  useEffect(() => {
    return () => {
      if (chartInstance.current) {
        console.log('[Chart Cleanup] Destroying chart instance');
        chartInstance.current.destroy();
        chartInstance.current = null;
      }
    };
  }, []);

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
              onClick={async () => {
                clearChartSelections();
                if (roadLayer) {
                  (roadLayer as any).definitionExpression = previousDefinitionExpression.current;
                }
                setSelectedSegment(null);
                // ADD: Zoom back to original extent
                if (mapView) {
                  await mapView.goTo(CONFIG.map, {
                    duration: 1000,
                    easing: 'ease-in-out'
                  });
                }
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
      <div style={{ position: 'relative', minHeight: '700px' }}>

        {/* --- STATE OVERLAYS (Spinner/Alerts) --- */}
        {/* This div will overlay on top of the chart canvas */}
        {(loading || dataStatus === 'error' || dataStatus === 'no-data') && (
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 10,
            // Add a semi-transparent background to dim the chart
            backgroundColor: themeMode === 'dark' ? 'rgba(31, 41, 55, 0.7)' : 'rgba(255, 255, 255, 0.7)',
            backdropFilter: 'blur(2px)',
            padding: '20px'
          }}>

            {loading && (
              <div style={{ textAlign: 'center' }}>
                <Spin size="large" />
                <div style={{ marginTop: '12px', color: token.colorText }}>Loading chart data...</div>
              </div>
            )}

            {dataStatus === 'error' && (
              <Alert
                message="Chart Loading Error"
                description={`Failed to load ${KPI_LABELS[activeKpi]} data: ${errorDetails}`}
                type="error"
                showIcon
              />
            )}

            {dataStatus === 'no-data' && (
              <Alert
                message="No Chart Data Available"
                description={errorDetails}
                type="info"
                showIcon
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
          </div>
        )}

        {/* --- CHART CONTAINER --- */}
        {/* This container is now ALWAYS rendered */}
        <div style={{
          position: 'relative',
          height: '700px',
          // Hide the container if data isn't ready, but don't unmount it
          visibility: (dataStatus === 'success' && groupedData.length > 0) ? 'visible' : 'hidden'
        }}>
          <canvas ref={chartRef} />
        </div>

        {/* --- FOOTER TEXT --- */}
        {/* Conditionally render this text */}
        {stackedMode && !loading && dataStatus === 'success' && groupedData.length > 0 && (
          <div style={{
            marginTop: '8px',
            fontSize: '12px',
            color: token.colorTextSecondary,
            textAlign: 'center'
          }}>
            Click to select • Ctrl+Click for multiple selections • Click again to deselect
          </div>
        )}
      </div>
    </Card>
  );
});

EnhancedChartPanel.displayName = 'EnhancedChartPanel';

export default EnhancedChartPanel;