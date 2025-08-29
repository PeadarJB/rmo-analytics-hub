import WebMap from '@arcgis/core/WebMap';
import MapView from '@arcgis/core/views/MapView';

export default class MapViewService {
  static async initializeMapView(containerId: string, webMapId: string) {
    const webmap = new WebMap({ portalItem: { id: webMapId } });
    const view = new MapView({
      container: containerId,
      map: webmap,
      constraints: { snapToZoom: false },
      padding: { top: 0 }
    });
    try {
      await view.when();
    } catch (e) {
      const el = document.getElementById(containerId);
      if (el) el.innerHTML = '<div style="padding:12px">Failed to load WebMap. Replace webMapId in appConfig.ts with a valid item ID.</div>';
      throw e;
    }
    return { view, webmap };
  }
}
