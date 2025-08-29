import React, { useEffect } from 'react';
import useAppStore from '@/store/useAppStore';
import Legend from '@arcgis/core/widgets/Legend';
import LayerList from '@arcgis/core/widgets/LayerList';
import BasemapGallery from '@arcgis/core/widgets/BasemapGallery';
import Expand from '@arcgis/core/widgets/Expand';

const MapWidgets: React.FC = () => {
  const { mapView } = useAppStore();

  useEffect(() => {
    if (!mapView) return;
    const legend = new Legend({ view: mapView });
    const list = new LayerList({ view: mapView });
    const gallery = new BasemapGallery({ view: mapView });

    const exLegend = new Expand({ view: mapView, content: legend, group: 'top-left', expandIcon: 'legend' });
    const exList = new Expand({ view: mapView, content: list, group: 'top-left', expandIcon: 'layers' });
    const exGallery = new Expand({ view: mapView, content: gallery, group: 'top-left', expandIcon: 'basemap' });

    mapView.ui.add([exLegend, exList, exGallery], 'top-left');

    return () => {
      mapView.ui.remove([exLegend, exList, exGallery]);
      legend.destroy(); list.destroy(); gallery.destroy();
      exLegend.destroy(); exList.destroy(); exGallery.destroy();
    };
  }, [mapView]);

  return null;
};

export default MapWidgets;
