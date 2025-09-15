import React, { useEffect } from 'react';
import useAppStore from '@/store/useAppStore';
import { theme } from 'antd';
import Legend from '@arcgis/core/widgets/Legend';
import LayerList from '@arcgis/core/widgets/LayerList';
import BasemapGallery from '@arcgis/core/widgets/BasemapGallery';
import Expand from '@arcgis/core/widgets/Expand';

const MapWidgets: React.FC = () => {
  const { mapView, themeMode } = useAppStore();
  const { token } = theme.useToken();

  useEffect(() => {
    if (!mapView) return;
    
    // Create theme-aware widget styling
    const widgetTheme = themeMode === 'dark' ? 'dark' : 'light';

    // Create widgets
    const legend = new Legend({ 
      view: mapView,
      style: 'card',
      container: document.createElement('div')
    });

    // Apply theme styling to legend container
    if (legend.container) {
      legend.container.style.backgroundColor = token.colorBgContainer;
      legend.container.style.color = token.colorText;
      legend.container.classList.add(`esri-widget--${widgetTheme}`);
    }
    
    const list = new LayerList({ 
      view: mapView,
      container: document.createElement('div'),
      listItemCreatedFunction: (event) => {
        // ADD: Simplify layer list items
        const item = event.item;
        if (item.layer && item.layer.type !== 'group') {
          item.panel = {
            content: 'legend',
            open: false
          };
        }
      }
    });

    // Apply theme styling to layer list container
    if (list.container) {
      list.container.style.backgroundColor = token.colorBgContainer;
      list.container.style.color = token.colorText;
      list.container.classList.add(`esri-widget--${widgetTheme}`);
    }
    
    const gallery = new BasemapGallery({ 
      view: mapView,
      container: document.createElement('div'),
      source: {
        query: {
          id: '6b0d83c9fc2e4e8e9dc5e8e5e8e5e8e5' // Optional: limit to specific basemaps
        }
      }
    });

    // Apply theme styling to basemap gallery container
    if (gallery.container) {
      gallery.container.style.backgroundColor = token.colorBgContainer;
      gallery.container.style.color = token.colorText;
      gallery.container.classList.add(`esri-widget--${widgetTheme}`);
    }

    // Create expand widgets with better configuration
    const exLegend = new Expand({ 
      view: mapView, 
      content: legend, 
      group: 'top-left', 
      expandIcon: 'legend',
      expandTooltip: 'Legend', // ADD: Tooltip
      expanded: true, // ADD: Start expanded for visibility
      mode: 'floating' // ADD: Better positioning mode
    });
    
    const exList = new Expand({ 
      view: mapView, 
      content: list, 
      group: 'top-left', 
      expandIcon: 'layers',
      expandTooltip: 'Layer List', // ADD: Tooltip
      mode: 'floating' // ADD: Better positioning mode
    });
    
    const exGallery = new Expand({ 
      view: mapView, 
      content: gallery, 
      group: 'top-left', 
      expandIcon: 'basemap',
      expandTooltip: 'Basemap Gallery', // ADD: Tooltip
      mode: 'floating' // ADD: Better positioning mode
    });

    // CHANGE: Adjust positioning to avoid overlap with panels
    // Position Legend at top-left (default position, most important)
    mapView.ui.add(exLegend, 'top-left');
    
    // Position LayerList below Legend
    mapView.ui.add(exList, {
      position: 'top-left',
      index: 1
    });
    
    // Position BasemapGallery at bottom-left to avoid panel conflicts
    mapView.ui.add(exGallery, 'top-left');

    // Cleanup
    return () => {
      mapView.ui.remove([exLegend, exList, exGallery]);
      legend.destroy(); 
      list.destroy(); 
      gallery.destroy();
      exLegend.destroy(); 
      exList.destroy(); 
      exGallery.destroy();
    };
  }, [mapView, themeMode, token]);

  return null;
};

export default MapWidgets;