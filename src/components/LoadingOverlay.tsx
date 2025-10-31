import React from 'react';
import { Spin } from 'antd';

interface LoadingOverlayProps {
  visible: boolean;
  message?: string | null;
}

const overlayStyle: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: 'rgba(17, 24, 39, 0.45)',
  backdropFilter: 'blur(2px)',
  zIndex: 999,
  pointerEvents: 'none',
};

const cardStyle: React.CSSProperties = {
  pointerEvents: 'auto',
  padding: '20px 28px',
  borderRadius: 8,
  backgroundColor: '#ffffff',
  boxShadow: '0 10px 30px rgba(15, 23, 42, 0.25)',
  textAlign: 'center',
  maxWidth: 280,
};

const messageStyle: React.CSSProperties = {
  marginTop: 12,
  fontSize: 14,
  fontWeight: 500,
  color: '#1f2937',
};

const LoadingOverlay: React.FC<LoadingOverlayProps> = ({ visible, message }) => {
  if (!visible) {
    return null;
  }

  return (
    <div style={overlayStyle}>
      <div style={cardStyle}>
        <Spin size="large" />
        {message ? <div style={messageStyle}>{message}</div> : null}
      </div>
    </div>
  );
};

export default LoadingOverlay;
