// src/routes.tsx
import { lazy } from 'react';
import { FileTextOutlined, BarChartOutlined } from '@ant-design/icons';

// Lazy load pages for code splitting
const OverviewDashboard = lazy(() => import('@/pages/OverviewDashboard'));
const RegionalReport2025 = lazy(() => import('@/pages/RegionalReport2025'));

export interface RouteConfig {
  path: string;
  element: React.LazyExoticComponent<React.ComponentType<any>>;
  label: string;
  icon: React.ReactNode;
}

export const routes: RouteConfig[] = [
  {
    path: '/',
    element: OverviewDashboard,
    label: 'Overview Dashboard',
    icon: <BarChartOutlined style={{ fontSize: 24 }} />
  },
  {
    path: '/report-2025',
    element: RegionalReport2025,
    label: '2025 Regional Report',
    icon: <FileTextOutlined style={{ fontSize: 24 }} />
  }
];
