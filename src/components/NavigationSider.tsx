// src/components/NavigationSider.tsx
import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Layout, Tooltip, theme } from 'antd';
import { routes } from '@/routes';

const { Sider } = Layout;

interface NavigationSiderProps {
  collapsed: boolean;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}

const NavigationSider: React.FC<NavigationSiderProps> = ({ 
  collapsed, 
  onMouseEnter, 
  onMouseLeave 
}) => {
  const { token } = theme.useToken();
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <Sider 
      collapsed={collapsed}
      width={220} 
      style={{
        background: token.colorBgLayout,
        borderRight: `1px solid ${token.colorBorder}`,
        overflow: 'hidden',
        transition: 'all 0.3s ease'
      }}
      trigger={null}
      collapsedWidth={60}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {routes.map(route => {
        const isActive = location.pathname === route.path;
        
        return (
          <div 
            key={route.path}
            style={{ 
              textAlign: collapsed ? 'center' : 'left', 
              padding: collapsed ? '12px 0' : '0 12px' 
            }}
          >
            <Tooltip title={collapsed ? route.label : ''} placement="right">
              <div 
                onClick={() => navigate(route.path)}
                style={{ 
                  color: isActive ? token.colorPrimary : token.colorText,
                  cursor: 'pointer', 
                  padding: '12px', 
                  borderRadius: '4px',
                  background: isActive ? token.colorPrimaryBg : 'transparent',
                  fontWeight: isActive ? 600 : 400,
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px'
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.background = token.colorBgTextHover;
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.background = 'transparent';
                  }
                }}
              >
                {collapsed ? route.icon : (
                  <>
                    {route.icon}
                    <span>{route.label}</span>
                  </>
                )}
              </div>
            </Tooltip>
          </div>
        );
      })}
    </Sider>
  );
};

export default NavigationSider;
