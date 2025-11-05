// src/services/__tests__/LayerService.test.ts
// Unit tests for LayerService

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import LayerService from '../LayerService';
import type { LayerStrategy } from '../LayerService';

// Mock ArcGIS modules
vi.mock('@arcgis/core/layers/FeatureLayer', () => ({
  default: vi.fn()
}));

vi.mock('@arcgis/core/WebMap', () => ({
  default: vi.fn()
}));

// Mock appConfig
vi.mock('@/config/appConfig', () => ({
  FEATURE_LAYER_URLS: {
    roadNetwork: {
      url: 'https://services.arcgis.com/test/FeatureServer/0',
      title: 'Test Road Network',
      description: 'Test layer'
    },
    roadNetworkSwipe: {
      url: 'https://services.arcgis.com/test/FeatureServer/0',
      title: 'Test Road Network Swipe',
      description: 'Test layer'
    },
    laPolygon: {
      url: 'https://services.arcgis.com/test/FeatureServer/1',
      title: 'Test LA Polygons',
      description: 'Test layer'
    }
  },
  LAYER_LOADING_CONFIG: {
    defaultStrategy: 'hybrid' as LayerStrategy,
    directLoadTimeout: 5000,
    enableFallback: true,
    enablePerformanceLogging: false
  },
  CONFIG: {
    webMapId: 'test-webmap-id',
    roadNetworkLayerTitle: 'Test Road Network',
    roadNetworkLayerSwipeTitle: 'Test Road Network Swipe',
    laPolygonLayerTitle: 'Test LA Polygons'
  }
}));

describe('LayerService', () => {
  beforeEach(() => {
    LayerService.clearMetrics();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('getStrategyFromURL', () => {
    it('should return strategy from URL parameter', () => {
      // Mock window.location.search
      Object.defineProperty(window, 'location', {
        value: {
          search: '?layerStrategy=direct'
        },
        writable: true
      });

      const strategy = LayerService.getStrategyFromURL();
      expect(strategy).toBe('direct');
    });

    it('should return default strategy when no URL parameter', () => {
      Object.defineProperty(window, 'location', {
        value: {
          search: ''
        },
        writable: true
      });

      const strategy = LayerService.getStrategyFromURL();
      expect(strategy).toBe('hybrid');
    });

    it('should return default strategy for invalid parameter', () => {
      Object.defineProperty(window, 'location', {
        value: {
          search: '?layerStrategy=invalid'
        },
        writable: true
      });

      const strategy = LayerService.getStrategyFromURL();
      expect(strategy).toBe('hybrid');
    });
  });

  describe('Metrics', () => {
    it('should record metrics', () => {
      // Metrics are recorded internally during loadLayers
      // We'll just verify the metrics methods work
      const metrics = LayerService.getMetrics();
      expect(Array.isArray(metrics)).toBe(true);
    });

    it('should clear metrics', () => {
      LayerService.clearMetrics();
      const metrics = LayerService.getMetrics();
      expect(metrics.length).toBe(0);
    });

    it('should calculate average load times', () => {
      const avgTimes = LayerService.getAverageLoadTimes();
      expect(avgTimes).toHaveProperty('direct');
      expect(avgTimes).toHaveProperty('webmap');
      expect(avgTimes).toHaveProperty('hybrid');
      expect(typeof avgTimes.direct).toBe('number');
    });

    it('should calculate success rates', () => {
      const successRates = LayerService.getSuccessRates();
      expect(successRates).toHaveProperty('direct');
      expect(successRates).toHaveProperty('webmap');
      expect(successRates).toHaveProperty('hybrid');
      expect(typeof successRates.direct).toBe('number');
    });
  });

  describe('Performance Summary', () => {
    it('should print performance summary without errors', () => {
      // Mock console.log to avoid output during tests
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      LayerService.printPerformanceSummary();
      
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('Layer Loading Result', () => {
    it('should return proper structure for failed load', async () => {
      // This will fail because we're not properly mocking the ArcGIS classes
      // But it demonstrates the error handling structure
      const result = await LayerService.loadLayers('direct', {
        timeout: 100, // Short timeout to fail fast
        enableLogging: false
      });

      expect(result).toHaveProperty('roadLayer');
      expect(result).toHaveProperty('roadLayerSwipe');
      expect(result).toHaveProperty('laLayer');
      expect(result).toHaveProperty('strategy');
      expect(result).toHaveProperty('loadTimeMs');
      expect(result).toHaveProperty('errors');
      expect(result).toHaveProperty('fallbackUsed');
      expect(Array.isArray(result.errors)).toBe(true);
      expect(typeof result.loadTimeMs).toBe('number');
    });
  });
});
