import { ThemeProvider } from 'antd-style';
import React from 'react';

export const lightThemeTokens = {
  token: {
    colorPrimary: '#722ed1',
    colorSuccess: '#52c41a',
    colorWarning: '#faad14',
    colorError: '#ff4d4f',
    borderRadius: 8
  }
};

export const darkThemeTokens = {
  token: {
    colorPrimary: '#b37feb',
    colorSuccess: '#95de64',
    colorWarning: '#ffd666',
    colorError: '#ff7875',
    colorBgLayout: '#0F1115',
    colorBgContainer: '#141414',
    colorBgElevated: '#1F1F1F',
    colorBorder: '#434343',
    colorBorderSecondary: '#303030',
    borderRadius: 8,
    colorBgBase: '#0F1115',
    colorTextBase: '#E6E6E6'
  },
  algorithm: undefined
};

export const withTheme = (mode: 'light' | 'dark', children: React.ReactNode) =>
  React.createElement(
    ThemeProvider,
    { theme: mode === 'dark' ? darkThemeTokens : lightThemeTokens },
    children
  );
