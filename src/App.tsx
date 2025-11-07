// src/App.tsx
import React, { Suspense, useState } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { Layout, Typography, theme, Spin, Tooltip, App as AntdApp } from 'antd';
import { withTheme } from '@/config/themeConfig';
import useAppStore from '@/store/useAppStore';
import { CONFIG } from '@/config/appConfig';
import { routes } from '@/routes';
import NavigationSider from '@/components/NavigationSider';
import HeaderControls from '@/components/HeaderControls';

const { Header, Content } = Layout;
const { Title } = Typography;

// Inner component that uses routing
const AppContent: React.FC = () => {
  const { themeMode } = useAppStore();
  const [siderHovered, setSiderHovered] = useState(false);
  const { token } = theme.useToken();
  const location = useLocation();

  // Find current route to determine if we should show header controls
  const currentRoute = routes.find(r => r.path === location.pathname);
  const isOverviewPage = location.pathname === '/';

  return (
    <Layout style={{ height: '100vh', overflow: 'hidden' }}>
      {/* Left Sidebar Navigation */}
      <NavigationSider 
        collapsed={!siderHovered}
        onMouseEnter={() => setSiderHovered(true)}
        onMouseLeave={() => setSiderHovered(false)}
      />

      <Layout style={{ height: '100%', overflow: 'hidden' }}>
        {/* Header */}
        <Header style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: themeMode === 'dark' ? '#1F2937' : '#FFFFFF',
          borderBottom: `1px solid ${token.colorBorder}`,
          padding: '0 16px',
          flexShrink: 0
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <img
              src="/img/PMS-Logo-150x150.png"
              alt="PMS Logo"
              style={{ height: '40px', width: 'auto' }}
            />
            <Title
              level={4}
              style={{
                margin: 0,
                color: themeMode === 'dark' ? '#F3F4F6' : '#111827'
              }}
            >
              {CONFIG.title}
            </Title>
          </div>

          {/* HEADER CONTROLS - Visible only on Overview page */}
          <HeaderControls visible={isOverviewPage} />
        </Header>

        {/* Main Content Area */}
        <Content style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
          <Suspense fallback={
            <div style={{ 
              height: '100%', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center' 
            }}>
              <Spin size="large" tip="Loading page..." />
            </div>
          }>
            <Routes>
              {routes.map(route => {
                const Component = route.element;
                return (
                  <Route 
                    key={route.path} 
                    path={route.path} 
                    element={<Component />} 
                  />
                );
              })}
            </Routes>
          </Suspense>
        </Content>
      </Layout>
    </Layout>
  );
};

const App: React.FC = () => {
  const { themeMode } = useAppStore();

  return withTheme(themeMode, (
    <AntdApp>
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>
    </AntdApp>
  ));
};

export default App;
