/**
 * Face identity storage — persists the user's Facenet128 reference embedding
 * to DocumentDirectory so it survives app restarts.
 */
import * as FileSystem from 'expo-file-system/legacy';

export type IdentityEngine = 'deepface' | 'insightface';

export interface FaceIdentity {
  embedding: number[];  // primary embedding (kept for back-compat with v1 identities)
  /** Per-engine embeddings so the my-face filter works under either engine (A/B). */
  embeddings?: Partial<Record<IdentityEngine, number[]>>;
  /** Engine that produced the primary `embedding`. */
  engine?: IdentityEngine;
  refPhotoUri: string;  // file:// URI of the reference photo (for display)
  createdAt: number;    // ms epoch timestamp
}

/** Pick the stored embedding for a given engine, falling back to the primary. */
export function embeddingForEngine(id: FaceIdentity, engine: IdentityEngine): number[] | null {
  const e = id.embeddings?.[engine];
  if (e && e.length) return e;
  // Legacy identities only have the primary embedding; only valid if it matches the engine.
  if ((id.engine ?? 'deepface') === engine && id.embedding.length) return id.embedding;
  return null;
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
