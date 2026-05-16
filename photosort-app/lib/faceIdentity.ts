import * as FileSystem from 'expo-file-system/legacy';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface FaceIdentity {
  embedding: number[];     // Facenet128 embedding vector (128 floats)
  refPhotoUri: string;     // file:// URI of the reference photo (for display in UI)
  createdAt: number;       // ms epoch timestamp
}

// ── Storage ───────────────────────────────────────────────────────────────────

const IDENTITY_FILE = (FileSystem.documentDirectory ?? '') + 'pixory_identity_v1.json';

export async function saveIdentity(identity: FaceIdentity): Promise<void> {
  await FileSystem.writeAsStringAsync(IDENTITY_FILE, JSON.stringify(identity));
}

export async function loadIdentity(): Promise<FaceIdentity | null> {
  try {
    const info = await FileSystem.getInfoAsync(IDENTITY_FILE);
    if (!info.exists) return null;
    const raw = await FileSystem.readAsStringAsync(IDENTITY_FILE);
    const parsed = JSON.parse(raw) as FaceIdentity;
    // Basic validation
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
