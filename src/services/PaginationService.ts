/**
 * PaginationService.ts
 *
 * Utility service for paginated queries on ArcGIS FeatureLayer
 * Handles querying all features when dataset exceeds maxRecordCount
 */

import type FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import type Query from '@arcgis/core/rest/support/Query';
import type Graphic from '@arcgis/core/Graphic';

interface PaginatedQueryOptions {
  where: string;
  outFields: string[];
  returnGeometry?: boolean;
  orderByFields?: string[];
  onProgress?: (current: number, total?: number) => void;
}

interface PaginatedQueryResult {
  features: Graphic[];
  totalCount: number;
  pagesQueried: number;
}

export class PaginationService {
  /**
   * Query all features from a layer with pagination support
   * Automatically detects maxRecordCount and pages through results
   *
   * @param layer - The FeatureLayer to query
   * @param options - Query options
   * @returns Promise with all features and metadata
   */
  static async queryAllFeatures(
    layer: FeatureLayer,
    options: PaginatedQueryOptions
  ): Promise<PaginatedQueryResult> {
    const {
      where,
      outFields,
      returnGeometry = false,
      orderByFields = ['OBJECTID ASC'],
      onProgress
    } = options;

    // Get layer's maxRecordCount from capabilities
    const maxRecords = layer.capabilities?.query?.maxRecordCount || 2000;

    console.log(`[PaginationService] Starting paginated query with maxRecordCount: ${maxRecords}`);
    console.log(`[PaginationService] WHERE clause: ${where}`);

    // First, get total count
    const countQuery = layer.createQuery();
    countQuery.where = where;
    const totalCount = await layer.queryFeatureCount(countQuery);

    console.log(`[PaginationService] Total features to query: ${totalCount}`);

    // If total is less than maxRecords, do single query
    if (totalCount <= maxRecords) {
      const query = layer.createQuery();
      query.where = where;
      query.outFields = outFields;
      query.returnGeometry = returnGeometry;
      query.orderByFields = orderByFields;

      const result = await layer.queryFeatures(query);

      return {
        features: result.features,
        totalCount: result.features.length,
        pagesQueried: 1
      };
    }

    // Paginated query for large datasets
    let allFeatures: Graphic[] = [];
    let start = 0;
    let pagesQueried = 0;
    const estimatedPages = Math.ceil(totalCount / maxRecords);

    while (true) {
      const query = layer.createQuery();
      query.where = where;
      query.outFields = outFields;
      query.returnGeometry = returnGeometry;
      query.orderByFields = orderByFields;
      query.start = start;
      query.num = maxRecords;

      try {
        const result = await layer.queryFeatures(query);
        allFeatures = allFeatures.concat(result.features);
        pagesQueried++;

        console.log(
          `[PaginationService] Page ${pagesQueried}/${estimatedPages}: ` +
          `Retrieved ${result.features.length} features (Total: ${allFeatures.length}/${totalCount})`
        );

        // Report progress if callback provided
        if (onProgress) {
          onProgress(allFeatures.length, totalCount);
        }

        // Check if we got fewer features than requested (last page)
        if (result.features.length < maxRecords) {
          console.log(`[PaginationService] Reached last page. Total features retrieved: ${allFeatures.length}`);
          break;
        }

        // Move to next page
        start += maxRecords;

        // Safety check: if we've retrieved more than total count, something went wrong
        if (allFeatures.length >= totalCount) {
          console.log(`[PaginationService] Retrieved all ${allFeatures.length} features`);
          break;
        }

      } catch (error) {
        console.error(`[PaginationService] Error on page ${pagesQueried + 1}:`, error);
        throw error;
      }
    }

    return {
      features: allFeatures,
      totalCount: allFeatures.length,
      pagesQueried
    };
  }

  /**
   * Query features with progress tracking for UI updates
   * Useful for showing loading progress to users
   */
  static async queryAllFeaturesWithProgress(
    layer: FeatureLayer,
    options: PaginatedQueryOptions,
    progressCallback: (progress: number, message: string) => void
  ): Promise<PaginatedQueryResult> {
    return this.queryAllFeatures(layer, {
      ...options,
      onProgress: (current, total) => {
        if (total) {
          const percentage = Math.round((current / total) * 100);
          progressCallback(percentage, `Loading features: ${current.toLocaleString()} / ${total.toLocaleString()}`);
        }
      }
    });
  }
}

export default PaginationService;
