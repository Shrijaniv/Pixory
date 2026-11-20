/**
 * Photo library access — fetches photos from the device and filters by location.
 */
import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library';
import { LocalPhoto } from '../store/state';
import { haversineKm } from './haversine';
import { computeByteQuality } from './quality';

// Native module — dev builds only. Falls back to getAssetInfoAsync location.
let nativeGetAssetLocations: ((ids: string[]) => Promise<Array<{ id: string; latitude: number; longitude: number }>>) | null = null;
try {
  const mod = require('../../modules/vision-scorer');
  nativeGetAssetLocations = mod.getAssetLocations;
} catch { /* Expo Go or module not linked */ }

/** Fetch photos from the device library filtered by date range. */
export async function getPhotos(options: {
  dateFrom?: Date;
  dateTo?: Date;
  limit?: number;
  onProgress?: (msg: string) => void;
}): Promise<LocalPhoto[]> {
  const { dateFrom, dateTo, limit = 500, onProgress } = options;

  onProgress?.('Reading photo library...');

  let allAssets: MediaLibrary.Asset[] = [];
  let cursor: string | undefined;

  do {
    const page = await MediaLibrary.getAssetsAsync({
      mediaType: MediaLibrary.MediaType.photo,
      createdAfter:  dateFrom?.getTime(),
      createdBefore: dateTo?.getTime(),
      first: Math.min(limit - allAssets.length, 100),
      after: cursor,
      sortBy: [MediaLibrary.SortBy.creationTime],
    });
    allAssets = [...allAssets, ...page.assets];
    cursor = page.hasNextPage ? page.endCursor : undefined;
  } while (cursor && allAssets.length < limit);

  onProgress?.(`Found ${allAssets.length} photos — reading metadata...`);

  // Batch GPS via PHAsset.location (native, dev builds only)
  const nativeLocationMap = new Map<string, { lat: number; lon: number }>();
  if (nativeGetAssetLocations) {
    try {
      const locs = await nativeGetAssetLocations(allAssets.map((a) => a.id));
      for (const loc of locs) {
        nativeLocationMap.set(loc.id, { lat: loc.latitude, lon: loc.longitude });
      }
      onProgress?.(`GPS: ${nativeLocationMap.size} of ${allAssets.length} photos have coordinates (via PHAsset)`);
    } catch { /* fall through */ }
  }

  const photos: LocalPhoto[] = [];
  for (let i = 0; i < allAssets.length; i++) {
    const asset = allAssets[i];
    if (i % 20 === 0) onProgress?.(`Loading metadata ${i + 1}/${allAssets.length}...`);
    try {
      const info = await MediaLibrary.getAssetInfoAsync(asset.id, { shouldDownloadFromNetwork: false });
      if (!info.localUri) continue; // not locally available (iCloud only)

      let fileSize: number | undefined;
      try {
        const stat = await FileSystem.getInfoAsync(info.localUri);
        if (stat.exists) fileSize = (stat as any).size as number;
      } catch { /* size unavailable */ }

      const isFavorite = (info as any).isFavorite === true;
      // Normalised to [0, 1] so scored and unscored photos share one scale.
      // See lib/photos/quality.ts for why this is a log map.
      const { qualityScore, rawByteScore } = computeByteQuality(
        asset.width * asset.height,
        fileSize,
        isFavorite,
      );

      const nativeLoc = nativeLocationMap.get(asset.id);
      const rawLat = parseFloat(info.location?.latitude as any);
      const rawLon = parseFloat(info.location?.longitude as any);
      const lat = nativeLoc?.lat ?? (Number.isFinite(rawLat) ? rawLat : undefined);
      const lon = nativeLoc?.lon ?? (Number.isFinite(rawLon) ? rawLon : undefined);

      photos.push({
        id: asset.id,
        uri: asset.uri,
        localUri: info.localUri,
        filename: asset.filename,
        creationTime: asset.creationTime,
        lat,
        lon,
        width: asset.width,
        height: asset.height,
        fileSize,
        qualityScore,
        rawByteScore,
        isFavorite,
      });
    } catch { /* skip unavailable assets */ }
  }

  const withGps = photos.filter((p) => p.lat != null && p.lon != null).length;
  if (withGps === 0 && photos.length > 0) {
    onProgress?.(`⚠ 0 of ${photos.length} photos have GPS data — location filter will be skipped`);
  } else if (withGps > 0 && !nativeGetAssetLocations) {
    onProgress?.(`${withGps} of ${photos.length} photos have GPS coordinates`);
  }

  return photos;
}

/** Filter photos within radiusKm of a lat/lon point using Haversine distance. */
export function filterByLocation(
  photos: LocalPhoto[],
  lat: number,
  lon: number,
  radiusKm: number,
): LocalPhoto[] {
  return photos.filter((p) => {
    if (!Number.isFinite(p.lat) || !Number.isFinite(p.lon)) return false;
    return haversineKm(p.lat!, p.lon!, lat, lon) <= radiusKm;
  });
}
