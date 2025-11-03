// src/components/report/section2/PSCIDiagram.tsx
import React from 'react';
import { Card, theme } from 'antd';

interface PSCIDiagramProps {
  height?: number;
}

const PSCIDiagram: React.FC<PSCIDiagramProps> = ({ height = 400 }) => {
  const { token } = theme.useToken();

  // PSCI rating definitions
  const ratings = [
    { 
      rating: 10, 
      label: 'Excellent', 
      description: 'No defects visible',
      color: '#006400' // Dark green
    },
    { 
      rating: 9, 
      label: 'Very Good', 
      description: 'Minor defects',
      color: '#228B22' // Forest green
    },
    { 
      rating: 8, 
      label: 'Good', 
      description: 'Some minor defects',
      color: '#32CD32' // Lime green
    },
    { 
      rating: 7, 
      label: 'Satisfactory', 
      description: 'Noticeable defects',
      color: '#7CFC00' // Lawn green
    },
    { 
      rating: 6, 
      label: 'Fair', 
      description: 'Moderate defects',
      color: '#ADFF2F' // Green yellow
    },
    { 
      rating: 5, 
      label: 'Fair', 
      description: 'Significant defects',
      color: '#FFFF00' // Yellow
    },
    { 
      rating: 4, 
      label: 'Poor', 
      description: 'Extensive defects',
      color: '#FFA500' // Orange
    },
    { 
      rating: 3, 
      label: 'Poor', 
      description: 'Serious defects',
      color: '#FF8C00' // Dark orange
    },
    { 
      rating: 2, 
      label: 'Very Poor', 
      description: 'Severe deterioration',
      color: '#FF4500' // Orange red
    },
    { 
      rating: 1, 
      label: 'Failed', 
      description: 'Complete failure',
      color: '#DC143C' // Crimson
    }
  ];

  return (
    <Card
      title="Figure 2.1: PSCI Rating 1 to 10"
      variant="borderless"
    >
      <div style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        gap: '8px',
        padding: '16px 0'
      }}>
        {ratings.map(({ rating, label, description, color }) => (
          <div
            key={rating}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '16px',
              padding: '12px 16px',
              borderRadius: token.borderRadius,
              border: `1px solid ${token.colorBorder}`,
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateX(4px)';
              e.currentTarget.style.boxShadow = token.boxShadow;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateX(0)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            {/* Rating Number */}
            <div style={{
              width: 60,
              height: 60,
              borderRadius: '50%',
              backgroundColor: color,
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 24,
              fontWeight: 'bold',
              flexShrink: 0,
              boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
            }}>
              {rating}
            </div>

            {/* Rating Label */}
            <div style={{ 
              minWidth: 100,
              fontWeight: 600,
              fontSize: 16,
              color: token.colorText
            }}>
              {label}
            </div>

            {/* Description */}
            <div style={{ 
              flex: 1,
              color: token.colorTextSecondary,
              fontSize: 14
            }}>
              {description}
            </div>

            {/* Color Bar */}
            <div style={{
              width: 80,
              height: 20,
              backgroundColor: color,
              borderRadius: token.borderRadius,
              border: `1px solid ${token.colorBorder}`,
              flexShrink: 0
            }} />
          </div>
        ))}
      </div>

      <div style={{ 
        marginTop: 24, 
        padding: 16,
        background: token.colorInfoBg,
        borderRadius: token.borderRadius,
        border: `1px solid ${token.colorInfoBorder}`
      }}>
        <div style={{ 
          fontSize: 12, 
          color: token.colorTextSecondary,
          lineHeight: 1.6
        }}>
          <strong>PSCI (Pavement Surface Condition Index)</strong> is a visual rating system 
          used to assess the overall condition of road pavements. Trained surveyors evaluate 
          the pavement surface and assign a rating from 1 (Failed) to 10 (Excellent) based on 
          the presence and severity of defects such as cracking, rutting, patching, and surface 
          deterioration. A rating of 5 or above is generally considered acceptable condition, 
          while ratings below 5 indicate the need for maintenance or rehabilitation.
        </div>
      </div>
    </Card>
  );
};

export default PSCIDiagram;
