/**
 * Face-identity storage tests.
 *
 * The critical behaviour is `isIdentityStale`: DeepFace produces 128-d Facenet
 * vectors and InsightFace 512-d ArcFace ones. Comparing across them is
 * meaningless, so an identity registered under the old engine must be
 * detectable rather than silently skipped (audit F4).
 */
import * as FileSystem from 'expo-file-system/legacy';
import {
  FaceIdentity,
  clearIdentity,
  embeddingForEngine,
  hasIdentity,
  isIdentityStale,
  loadIdentity,
  saveIdentity,
} from '../storage';

const IDENTITY_FILE = 'file:///mock-doc-dir/pixory_identity_v1.json';

const fs = new Map<string, string>();

beforeEach(() => {
  fs.clear();
  (FileSystem.getInfoAsync as jest.Mock).mockImplementation(async (p: string) => ({
    exists: fs.has(p),
  }));
  (FileSystem.readAsStringAsync as jest.Mock).mockImplementation(async (p: string) => {
    if (!fs.has(p)) throw new Error('not found');
    return fs.get(p)!;
  });
  (FileSystem.writeAsStringAsync as jest.Mock).mockImplementation(
    async (p: string, data: string) => {
      fs.set(p, data);
    },
  );
  (FileSystem.deleteAsync as jest.Mock).mockImplementation(async (p: string) => {
    fs.delete(p);
  });
});

const arc = (v = 0.1) => Array(512).fill(v);
const facenet = (v = 0.2) => Array(128).fill(v);

function identity(over: Partial<FaceIdentity> = {}): FaceIdentity {
  return {
    embedding: arc(),
    embeddings: { insightface: arc() },
    engine: 'insightface',
    refPhotoUri: 'file:///selfie.jpg',
    createdAt: 1_700_000_000_000,
    ...over,
  };
}

describe('embeddingForEngine', () => {
  it('returns the per-engine embedding when one is stored', () => {
    const id = identity({ embeddings: { insightface: arc(0.3), deepface: facenet(0.4) } });

    expect(embeddingForEngine(id, 'insightface')).toEqual(arc(0.3));
    expect(embeddingForEngine(id, 'deepface')).toEqual(facenet(0.4));
  });

  it('falls back to the primary embedding when it matches the requested engine', () => {
    const id = identity({ embeddings: undefined, engine: 'insightface', embedding: arc(0.5) });

    expect(embeddingForEngine(id, 'insightface')).toEqual(arc(0.5));
  });

  it('refuses the primary embedding when it came from the other engine', () => {
    const id = identity({ embeddings: undefined, engine: 'deepface', embedding: facenet() });

    expect(embeddingForEngine(id, 'insightface')).toBeNull();
  });

  it('treats a v1 identity with no engine field as deepface', () => {
    const id = identity({ embeddings: undefined, engine: undefined, embedding: facenet() });

    expect(embeddingForEngine(id, 'deepface')).toEqual(facenet());
    expect(embeddingForEngine(id, 'insightface')).toBeNull();
  });

  it('ignores an empty per-engine array and falls through', () => {
    const id = identity({ embeddings: { insightface: [] }, engine: 'deepface', embedding: facenet() });

    expect(embeddingForEngine(id, 'insightface')).toBeNull();
  });

  it('returns null when the primary embedding is empty', () => {
    const id = identity({ embeddings: undefined, engine: 'insightface', embedding: [] });

    expect(embeddingForEngine(id, 'insightface')).toBeNull();
  });
});

describe('isIdentityStale (audit F4)', () => {
  it('flags a DeepFace-only identity under InsightFace', () => {
    const legacy = identity({ embeddings: undefined, engine: 'deepface', embedding: facenet() });

    expect(isIdentityStale(legacy, 'insightface')).toBe(true);
  });

  it('flags a pre-engine v1 identity under InsightFace', () => {
    const v1 = identity({ embeddings: undefined, engine: undefined, embedding: facenet() });

    expect(isIdentityStale(v1, 'insightface')).toBe(true);
  });

  it('does not flag an identity that carries the right embedding', () => {
    expect(isIdentityStale(identity(), 'insightface')).toBe(false);
  });

  it('does not flag an identity holding both engines', () => {
    const both = identity({ embeddings: { insightface: arc(), deepface: facenet() } });

    expect(isIdentityStale(both, 'insightface')).toBe(false);
    expect(isIdentityStale(both, 'deepface')).toBe(false);
  });

  it('is not stale when there is no identity at all — that is a different state', () => {
    expect(isIdentityStale(null, 'insightface')).toBe(false);
  });
});

describe('load / save / clear', () => {
  it('round-trips an identity', async () => {
    const id = identity();
    await saveIdentity(id);

    expect(await loadIdentity()).toEqual(id);
  });

  it('returns null when nothing is saved', async () => {
    expect(await loadIdentity()).toBeNull();
  });

  it('rejects a file with no embedding array', async () => {
    fs.set(IDENTITY_FILE, JSON.stringify({ refPhotoUri: 'file:///x.jpg' }));

    expect(await loadIdentity()).toBeNull();
  });

  it('rejects a file with an empty embedding', async () => {
    fs.set(IDENTITY_FILE, JSON.stringify({ embedding: [], refPhotoUri: 'file:///x.jpg' }));

    expect(await loadIdentity()).toBeNull();
  });

  it('rejects a corrupt file', async () => {
    fs.set(IDENTITY_FILE, 'not json at all');

    expect(await loadIdentity()).toBeNull();
  });

  it('reports whether an identity exists', async () => {
    expect(await hasIdentity()).toBe(false);
    await saveIdentity(identity());
    expect(await hasIdentity()).toBe(true);
  });

  it('reports no identity when the check itself fails', async () => {
    (FileSystem.getInfoAsync as jest.Mock).mockRejectedValueOnce(new Error('EIO'));

    expect(await hasIdentity()).toBe(false);
  });

  it('clears a saved identity', async () => {
    await saveIdentity(identity());

    await clearIdentity();

    expect(await loadIdentity()).toBeNull();
  });

  it('never throws when clearing fails', async () => {
    (FileSystem.deleteAsync as jest.Mock).mockRejectedValueOnce(new Error('locked'));

    await expect(clearIdentity()).resolves.toBeUndefined();
  });
});
