// src/components/report/section1/RoadWidthChart.tsx
import React, { useEffect, useRef, useState } from 'react';
import { Card, Spin, Alert, theme } from 'antd';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ChartOptions
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { networkDataService, RoadWidthDistribution } from '@/services/NetworkDataService';
import useAppStore from '@/store/useAppStore';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

interface RoadWidthChartProps {
  year?: number;
  height?: number;
}

const RoadWidthChart: React.FC<RoadWidthChartProps> = ({
  year = 2025,
  height = 400
}) => {
  const { token } = theme.useToken();
  const { roadLayer, themeMode } = useAppStore();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<RoadWidthDistribution[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      if (!roadLayer) {
        setError('Road layer not available');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        networkDataService.setRoadLayer(roadLayer);
        const distribution = await networkDataService.getRoadWidthDistribution(year);
        setData(distribution);
      } catch (err) {
        console.error('Error fetching road width distribution:', err);
        setError('Failed to load road width data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [roadLayer, year]);

  // Prepare chart data
  const chartData = {
    labels: data.map(d => d.width.toFixed(1)),
    datasets: [
      {
        label: `Road Width Cumulative Frequency (${year})`,
        data: data.map(d => d.cumulativePercent),
        borderColor: token.colorPrimary,
        backgroundColor: `${token.colorPrimary}22`,
        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 4,
        tension: 0.4,
        fill: true
      }
    ]
  };

  // Chart options
  const options: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: 'top' as const,
        labels: {
          color: themeMode === 'dark' ? token.colorTextBase : token.colorText,
          font: {
            size: 12
          }
        }
      },
      title: {
        display: false
      },
      tooltip: {
        mode: 'index',
        intersect: false,
        callbacks: {
          label: (context) => {
            const y = context.parsed.y ?? 0;
            return `${y.toFixed(1)}% of roads ≤ ${context.label}m wide`;
          }
        }
      }
    },
    scales: {
      x: {
        title: {
          display: true,
          text: 'Road Width (metres)',
          color: themeMode === 'dark' ? token.colorTextBase : token.colorText,
          font: {
            size: 13,
            weight: 'bold'
          }
        },
        ticks: {
          color: themeMode === 'dark' ? token.colorTextSecondary : token.colorTextSecondary,
          maxRotation: 45,
          minRotation: 0
        },
        grid: {
          color: themeMode === 'dark' ? token.colorBorderSecondary : token.colorBorder
        }
      },
      y: {
        title: {
          display: true,
          text: 'Cumulative Percentage (%)',
          color: themeMode === 'dark' ? token.colorTextBase : token.colorText,
          font: {
            size: 13,
            weight: 'bold'
          }
        },
        min: 0,
        max: 100,
        ticks: {
          color: themeMode === 'dark' ? token.colorTextSecondary : token.colorTextSecondary,
          callback: (value) => `${value}%`
        },
        grid: {
          color: themeMode === 'dark' ? token.colorBorderSecondary : token.colorBorder
        }
      }
    },
    interaction: {
      mode: 'nearest',
      axis: 'x',
      intersect: false
    }
  };

  if (loading) {
    return (
      <Card
        title={`Figure 1.2: Road Width Cumulative Frequency (${year})`}
        variant="borderless"
      >
        <div style={{
          height,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <Spin size="large" tip="Loading road width data..." />
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card
        title={`Figure 1.2: Road Width Cumulative Frequency (${year})`}
        variant="borderless"
      >
        <Alert
          message="Error"
          description={error}
          type="error"
          showIcon
        />
      </Card>
    );
  }

  return (
    <Card
      title={`Figure 1.2: Road Width Cumulative Frequency (${year})`}
      variant="borderless"
    >
      <div style={{ height }}>
        <Line data={chartData} options={options} />
      </div>
      <div style={{
        marginTop: 16,
        fontSize: 12,
        color: token.colorTextSecondary
      }}>
        This chart shows the cumulative frequency distribution of road widths across
        the regional road network. The X-axis represents road width in metres, while
        the Y-axis shows the percentage of roads that are equal to or narrower than
        that width.
      </div>
    </Card>
  );
};

export default RoadWidthChart;
