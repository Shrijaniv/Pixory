import * as MediaLibrary from 'expo-media-library';

export async function requestPermission(): Promise<{ granted: boolean; limited: boolean }> {
  const result = await MediaLibrary.requestPermissionsAsync();
  const granted = result.status === 'granted';
  // iOS 14+ may grant "Selected Photos" (limited) — GPS filtering won't work in this mode.
  const limited = (result as any).accessPrivileges === 'limited';
  return { granted, limited };
}
