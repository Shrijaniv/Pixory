import { requireNativeModule } from 'expo-modules-core';

export interface VisionScore {
  sharpness: number;  // 0–1: Laplacian variance normalized (higher = sharper)
  faceCount: number;  // integer number of detected faces
  saliency: number;   // 0–1: confidence of most salient region
}

export interface AssetLocation {
  id: string;
  latitude: number;
  longitude: number;
}

// Throws if native module is not available (e.g. Expo Go)
const VisionScorer = requireNativeModule('VisionScorer');

export function scorePhoto(localUri: string): Promise<VisionScore> {
  return VisionScorer.scorePhoto(localUri);
}

/**
 * Batch-fetch GPS coordinates for a list of PHAsset local identifiers.
 * Uses PHAsset.fetchAssets directly — more reliable than getAssetInfoAsync.
 * Returns only assets that have a non-zero CLLocation.
 */
export function getAssetLocations(assetIds: string[]): Promise<AssetLocation[]> {
  return VisionScorer.getAssetLocations(assetIds);
}
