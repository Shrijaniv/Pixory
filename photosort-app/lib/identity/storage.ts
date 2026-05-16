/**
 * Face identity storage — persists the user's Facenet128 reference embedding
 * to DocumentDirectory so it survives app restarts.
 */
import * as FileSystem from 'expo-file-system/legacy';

export interface FaceIdentity {
  embedding: number[];  // Facenet128 vector (128 floats)
  refPhotoUri: string;  // file:// URI of the reference photo (for display)
  createdAt: number;    // ms epoch timestamp
}

const IDENTITY_FILE = (FileSystem.documentDirectory ?? '') + 'pixory_identity_v1.json';

export async function saveIdentity(identity: FaceIdentity): Promise<void> {
  await FileSystem.writeAsStringAsync(IDENTITY_FILE, JSON.stringify(identity));
}

export async function loadIdentity(): Promise<FaceIdentity | null> {
  try {
    const info = await FileSystem.getInfoAsync(IDENTITY_FILE);
    if (!info.exists) return null;
    const raw    = await FileSystem.readAsStringAsync(IDENTITY_FILE);
    const parsed = JSON.parse(raw) as FaceIdentity;
    if (!Array.isArray(parsed.embedding) || parsed.embedding.length === 0) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function clearIdentity(): Promise<void> {
  try {
    await FileSystem.deleteAsync(IDENTITY_FILE, { idempotent: true });
  } catch { /* ignore */ }
}

export async function hasIdentity(): Promise<boolean> {
  try {
    const info = await FileSystem.getInfoAsync(IDENTITY_FILE);
    return info.exists;
  } catch {
    return false;
  }
}
