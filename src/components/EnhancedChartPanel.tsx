import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { Card, Select, Space, Spin, Alert, theme, Switch, message, Button, Tag } from 'antd';
import { Chart, ChartConfiguration, ChartEvent, ActiveElement } from 'chart.js/auto';
import useAppStore from '@/store/useAppStore';
import { CONFIG, KPI_LABELS, RENDERER_CONFIG, KPI_THRESHOLDS, type KPIKey, getKPIFieldName } from '@/config/appConfig';
import QueryService from '@/services/QueryService';
import { getChartThemeColors } from '@/utils/themeHelpers';
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

  const [groupBy, setGroupBy] = useState<string>(CONFIG.defaultGroupBy);
  const [groupedData, setGroupedData] = useState<GroupedConditionStats[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [stackedMode, setStackedMode] = useState<boolean>(true);
  const [selectedSegment, setSelectedSegment] = useState<{group: string, condition: string} | null>(null);
  const [dataStatus, setDataStatus] = useState<'loading' | 'success' | 'no-data' | 'error'>('loading');
  const [errorDetails, setErrorDetails] = useState<string>('');

  // Get theme-aware colors
  const themeColors = useMemo(() => 
    RENDERER_CONFIG.getThemeAwareColors(token), 
    [token]
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

  // Fetch data with condition breakdowns
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      
      try {
        setDataStatus('loading');
        let data: GroupedConditionStats[];
        
        if (stackedMode) {
          data = await StatisticsService.computeGroupedStatisticsWithConditions(
            roadLayer,
            currentFilters,
            activeKpi,
            groupBy
          );
        } else {
          // MODIFICATION START: Add logic to handle subgroup correctly
          let simpleData;
          const kpiField = getKPIFieldName(activeKpi, currentFilters.year[0] || CONFIG.defaultYears[0]);
          const whereClause = (roadLayer as any)?.definitionExpression || '1=1';

          if (groupBy === 'subgroup') {
            console.log('[Chart Debug] Fetching subgroup averages...');
            simpleData = await QueryService.computeSubgroupStatistics(
              roadLayer,
              kpiField,
              whereClause
            );
          } else {
            console.log('[Chart Debug] Fetching simple averages for:', {
              activeKpi,
              year: currentFilters.year[0] || CONFIG.defaultYears[0],
              groupBy,
              definitionExpression: whereClause
            });
            simpleData = await QueryService.computeGroupedStatistics(
              roadLayer,
              kpiField,
              groupBy,
              whereClause
            );
          }
          // MODIFICATION END
          
          console.log('[Chart Debug] Raw QueryService result:', simpleData);
          
          data = simpleData.map(d => {
            console.log('[Chart Debug] Processing group:', d.group, 'avgValue:', d.avgValue, 'count:', d.count);
            return {
              group: d.group,
              avgValue: d.avgValue || 0,
              totalCount: d.count || 0,
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
        
        data.sort((a, b) => b.avgValue - a.avgValue);
        
        if (!data || data.length === 0) {
          setDataStatus('no-data');
          setErrorDetails(`No ${groupByOptions.find(o => o.value === groupBy)?.label || groupBy} data available for ${KPI_LABELS[activeKpi]} in the current selection.`);
          setGroupedData([]);
          return;
        }
        
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
    
    const clickedGroup = groupedData[dataIndex].group;
    const conditions = ['veryGood', 'good', 'fair', 'poor', 'veryPoor'];
    const clickedCondition = conditions[datasetIndex];
    
    const selection = {
      group: clickedGroup,
      condition: clickedCondition,
      kpi: activeKpi,
      year: currentFilters.year[0] || CONFIG.defaultYears[0]
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
      const kpiField = getKPIFieldName(selection.kpi, year);
      
      let groupClause = '';
      if (groupBy === 'subgroup') {
        groupClause = buildSubgroupWhereClause(selection.group);
      } else {
        groupClause = `${groupBy} = '${selection.group.replace("'", "''")}'`;
      }
      
      const conditionClause = buildConditionWhereClause(kpiField, selection.kpi, selection.condition);
      
      return `(${groupClause} AND ${conditionClause})`;
    });

    let combinedWhere = whereClauses.join(' OR ');
    
    if (previousDefinitionExpression.current !== '1=1') {
      combinedWhere = `(${previousDefinitionExpression.current}) AND (${combinedWhere})`;
    }

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

  useEffect(() => {
    if (roadLayer) {
      previousDefinitionExpression.current = (roadLayer as any).definitionExpression || '1=1';
      setSelectedSegment(null);
    }
  }, [currentFilters]);

  // Helper function to create chart colors with theme awareness
  const createChartColors = (conditionType: keyof typeof themeColors.fiveClass, groupData: GroupedConditionStats[]) => {
    const baseColor = themeColors.fiveClass[conditionType];
    
    return {
      backgroundColor: groupData.map(d => {
        const key = `${d.group}_${conditionType}`;
        const opacity = highlightedBars.has(key) ? 1.0 : 0.8;
        return `rgba(${baseColor.slice(0, 3).join(',')}, ${opacity})`;
      }),
      borderColor: groupData.map(d => {
        const key = `${d.group}_${conditionType}`;
        const opacity = highlightedBars.has(key) ? 1.0 : 0.6;
        return `rgba(${baseColor.slice(0, 3).join(',')}, ${opacity})`;
      }),
      borderWidth: groupData.map(d => {
        const key = `${d.group}_${conditionType}`;
        return highlightedBars.has(key) ? 3 : 1;
      })
    };
  };

  // Render chart - now depends on themeMode to trigger re-render
  useEffect(() => {
    if (!chartRef.current || dataStatus !== 'success' || !groupedData.length) return;

    const labels = groupedData.map(d => d.group);
    
    let datasets: any[];
    
    if (stackedMode) {
      datasets = [
        {
          label: 'Very Good',
          data: groupedData.map(d => d.conditions.veryGood.percentage),
          ...createChartColors('veryGood', groupedData)
        },
        {
          label: 'Good',
          data: groupedData.map(d => d.conditions.good.percentage),
          ...createChartColors('good', groupedData)
        },
        {
          label: 'Fair',
          data: groupedData.map(d => d.conditions.fair.percentage),
          ...createChartColors('fair', groupedData)
        },
        {
          label: 'Poor',
          data: groupedData.map(d => d.conditions.poor.percentage),
          ...createChartColors('poor', groupedData)
        },
        {
          label: 'Very Poor',
          data: groupedData.map(d => d.conditions.veryPoor.percentage),
          ...createChartColors('veryPoor', groupedData)
        }
      ];
    } else {
      const chartData = groupedData.map(d => d.avgValue);
      console.log('[Chart Debug] Chart data for rendering:', chartData);
      console.log('[Chart Debug] GroupedData avgValues:', groupedData.map(d => ({ group: d.group, avgValue: d.avgValue })));
      
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

    const chartThemeColors = getChartThemeColors();

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
  }, [groupedData, activeKpi, groupBy, dataStatus, token, stackedMode, selectedSegment, highlightedBars, chartSelections, handleChartClick, themeColors, themeMode]);

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
          <div style={{ marginTop: '12px', color: token.colorText }}>Loading chart data...</div>
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
          <div style={{ position: 'relative', height: '700px' }}>
            <canvas ref={chartRef} />
          </div>
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