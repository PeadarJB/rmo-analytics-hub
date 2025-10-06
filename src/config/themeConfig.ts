import { ThemeConfig } from 'antd';
import { ThemeProvider } from 'antd-style';
import React from 'react';

/**
 * Maps CSS custom properties to Ant Design theme tokens
 * This creates a single source of truth for theming
 */
export const getLightThemeConfig = (): ThemeConfig => ({
  token: {
    // Brand colors from RMO logo
    colorPrimary: '#009FE3', // RMO Blue
    colorSuccess: '#16A34A',
    colorWarning: '#F59E0B',
    colorError: '#EF4444',
    colorInfo: '#00B8E5', // RMO Cyan
    
    // Typography
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    fontSize: 16,
    fontSizeHeading1: 36,
    fontSizeHeading2: 30,
    fontSizeHeading3: 24,
    fontSizeHeading4: 20,
    fontSizeHeading5: 18,
    
    // Layout
    borderRadius: 8,
    controlHeight: 40,
    
    // Spacing
    padding: 16,
    margin: 16,
    
    // Colors
    colorBgBase: '#FFFFFF',
    colorBgContainer: '#FFFFFF',
    colorBgElevated: '#FFFFFF',
    colorBgLayout: '#F9FAFB',
    
    colorTextBase: '#111827',
    colorText: '#111827',
    colorTextSecondary: '#4B5563',
    colorTextTertiary: '#6B7280',
    colorTextQuaternary: '#9CA3AF',
    
    colorBorder: '#E5E7EB',
    colorBorderSecondary: '#F3F4F6',
  },
  components: {
    Button: {
      controlHeight: 40,
      controlHeightSM: 32,
      controlHeightLG: 48,
      primaryColor: '#FFFFFF',
    },
    Input: {
      controlHeight: 40,
    },
    Select: {
      controlHeight: 40,
    },
    Card: {
      borderRadiusLG: 8,
    }
  }
});

export const getDarkThemeConfig = (): ThemeConfig => ({
  token: {
    // Brand colors (adjusted for dark theme)
    colorPrimary: '#33BFF7', // Lighter RMO Blue
    colorSuccess: '#22C55E',
    colorWarning: '#F59E0B',
    colorError: '#EF4444',
    colorInfo: '#00B8E5',
    
    // Same typography
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    fontSize: 16,
    
    // Layout
    borderRadius: 8,
    controlHeight: 40,
    
    // Dark mode colors
    colorBgBase: '#030712',
    colorBgContainer: '#111827',
    colorBgElevated: '#1F2937',
    colorBgLayout: '#030712',
    
    colorTextBase: '#F3F4F6',
    colorText: '#F3F4F6',
    colorTextSecondary: '#D1D5DB',
    colorTextTertiary: '#6B7280',
    colorTextQuaternary: '#4B5563',
    
    colorBorder: '#374151',
    colorBorderSecondary: '#1F2937',
  },
  components: {
    Button: {
      controlHeight: 40,
      primaryColor: '#FFFFFF',
    },
    Input: {
      controlHeight: 40,
    },
    Select: {
      controlHeight: 40,
    },
    Card: {
      borderRadiusLG: 8,
    }
  }
});

/**
 * Wraps children with the appropriate theme provider
 */
export const withTheme = (mode: 'light' | 'dark', children: React.ReactNode) => {
  const theme = mode === 'dark' ? getDarkThemeConfig() : getLightThemeConfig();
  
  return React.createElement(
    ThemeProvider,
    { theme },
    children
  );
};