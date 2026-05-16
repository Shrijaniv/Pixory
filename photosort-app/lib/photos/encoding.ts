/** Photo encoding utilities for sending to AI APIs. */
import * as FileSystem from 'expo-file-system/legacy';

/** Read a local photo as a base64 JPEG string. */
export async function photoToBase64(localUri: string): Promise<string> {
  return FileSystem.readAsStringAsync(localUri, {
    encoding: FileSystem.EncodingType.Base64,
  });
}
