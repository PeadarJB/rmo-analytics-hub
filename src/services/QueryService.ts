import type FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import Query from '@arcgis/core/rest/support/Query';
import type MapView from '@arcgis/core/views/MapView';

export default class QueryService {
  static async getUniqueValues(layer: FeatureLayer | null, field: string): Promise<string[]> {
    if (!layer) {
      // Placeholder values for local run without data
      if (field.toLowerCase().includes('la')) return ['Dublin City','Galway County','Limerick City and County'];
      if (field.toLowerCase().includes('route')) return ['R123', 'R456', 'R750'];
      if (field.toLowerCase().includes('year')) return ['2011','2018','2025'];
      return [];
    }
    const q = layer.createQuery();
    q.where = '1=1';
    q.outFields = [field];
    q.returnDistinctValues = true;
    q.returnGeometry = false;
    const res = await layer.queryFeatures(q);
    const vals = new Set<string>();
    res.features.forEach(f => {
      const v = f.attributes[field];
      if (v !== null && v !== undefined) vals.add(String(v));
    });
    return Array.from(vals).sort();
  }

  static async zoomToDefinition(view: MapView | null, layer: FeatureLayer | null, where: string) {
    if (!view || !layer) return;
    const q = layer.createQuery();
    q.where = where;
    q.returnGeometry = true;
    q.outFields = ['OBJECTID'];
    q.returnCentroid = true;
    q.num = 1;
    try {
      const res = await layer.queryExtent(q);
      if (res.extent) await view.goTo(res.extent.expand(1.1));
    } catch {}
  }
}
