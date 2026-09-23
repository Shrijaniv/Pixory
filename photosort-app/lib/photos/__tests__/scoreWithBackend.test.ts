/**
 * Tests for the sidecar scoring pass — specifically the failure contract that
 * audit findings F2 and L7 turn on:
 *
 *   F2  a scoring failure must be reported, never silently degraded, because
 *       the my-face filter drops every photo that lacks a face count
 *   L7  photos the sidecar never scored must not outrank photos it did
 */
import { SCORING_TIMEOUT_MS, scoreWithBackend } from '../scoring';
import type { BackendPhotoScore } from '../scoring';
import type { LocalPhoto } from '../../store/state';

const URL = 'http://backend.test:8000';

function photo(over: Partial<LocalPhoto> = {}): LocalPhoto {
  return {
    id: 'p1',
    uri: 'ph://p1',
    localUri: 'file:///p1.jpg',
    filename: 'p1.jpg',
    creationTime: 1_700_000_000_000,
    width: 4032,
    height: 3024,
    qualityScore: 0.6,
    isFavorite: false,
    ...over,
  } as LocalPhoto;
}

function photos(n: number): LocalPhoto[] {
  return Array.from({ length: n }, (_, i) =>
    photo({
      id: `p${i}`,
      localUri: `file:///p${i}.jpg`,
      filename: `p${i}.jpg`,
      // Descending so the candidate cut-off is deterministic.
      qualityScore: 1 - i * 0.01,
    }),
  );
}

function score(over: Partial<BackendPhotoScore> = {}): BackendPhotoScore {
  return {
    index: 0,
    sharpness: 0.8,
    face_count: 0,
    happy_face_count: 0,
    brightness: 0.5,
    brightness_quality: 0.7,
    contrast: 0.6,
    saturation: 0.4,
    complexity: 0.3,
    ...over,
  };
}

/** Install a fetch that resolves with the given sidecar payload. */
function mockFetchOk(scores: BackendPhotoScore[]) {
  const fn = jest.fn(async () => ({ ok: true, status: 200, json: async () => ({ scores }) }));
  (global as any).fetch = fn;
  return fn;
}

/**
 * Install a fetch that never resolves and rejects only on abort — matching
 * the real implementation, which rejects *immediately* when handed a signal
 * that is already aborted rather than waiting for an event that will never
 * fire again.
 */
function mockFetchAbortable() {
  const fn = jest.fn(
    (_url: string, init: any) =>
      new Promise((_resolve, reject) => {
        const fail = () => {
          const err = new Error('Aborted');
          err.name = 'AbortError';
          reject(err);
        };
        if (init.signal.aborted) {
          fail();
          return;
        }
        init.signal.addEventListener('abort', fail);
      }),
  );
  (global as any).fetch = fn;
  return fn;
}

beforeEach(() => {
  jest.useRealTimers();
  (global as any).fetch = jest.fn();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('failure contract (audit F2)', () => {
  it('reports failure and returns every photo when no backend URL is set', async () => {
    const input = photos(5);
    const result = await scoreWithBackend(input, '');

    expect(result.scored).toBe(false);
    expect(result.scoredCount).toBe(0);
    expect(result.error).toMatch(/backend url/i);
    expect(result.photos).toHaveLength(5);
  });

  it('reports failure on a non-OK HTTP status without dropping photos', async () => {
    (global as any).fetch = jest.fn(async () => ({ ok: false, status: 503, json: async () => ({}) }));

    const result = await scoreWithBackend(photos(4), URL);

    expect(result.scored).toBe(false);
    expect(result.error).toContain('503');
    expect(result.photos).toHaveLength(4);
  });

  it('reports failure when the network throws', async () => {
    (global as any).fetch = jest.fn(async () => {
      throw new Error('Network request failed');
    });

    const result = await scoreWithBackend(photos(3), URL);

    expect(result.scored).toBe(false);
    expect(result.error).toContain('Network request failed');
    expect(result.photos).toHaveLength(3);
  });

  it('reports failure when the sidecar returns a malformed body', async () => {
    (global as any).fetch = jest.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ unexpected: true }),
    }));

    const result = await scoreWithBackend(photos(3), URL);

    expect(result.scored).toBe(false);
    expect(result.error).toMatch(/malformed/i);
  });

  it('reports failure when no photo could be encoded', async () => {
    const manipulator = require('expo-image-manipulator');
    manipulator.manipulateAsync.mockRejectedValueOnce(new Error('unreadable'));
    manipulator.manipulateAsync.mockRejectedValueOnce(new Error('unreadable'));

    const result = await scoreWithBackend(photos(2), URL);

    expect(result.scored).toBe(false);
    expect(result.error).toMatch(/encode/i);
    expect(result.photos).toHaveLength(2);
  });

  it('surfaces every failure through onProgress so the user sees it', async () => {
    (global as any).fetch = jest.fn(async () => {
      throw new Error('boom');
    });
    const onProgress = jest.fn();

    await scoreWithBackend(photos(2), URL, { onProgress });

    expect(onProgress).toHaveBeenCalledWith(expect.stringContaining('⚠'));
  });

  it('never returns fewer photos than it was given, whatever happens', async () => {
    const cases: Array<() => void> = [
      () => { (global as any).fetch = jest.fn(async () => { throw new Error('x'); }); },
      () => { (global as any).fetch = jest.fn(async () => ({ ok: false, status: 500, json: async () => ({}) })); },
      () => { mockFetchOk([]); },
      () => { mockFetchOk([score({ index: 0 })]); },
    ];
    for (const install of cases) {
      install();
      const result = await scoreWithBackend(photos(7), URL);
      expect(result.photos).toHaveLength(7);
    }
  });
});

describe('timeout and cancellation (audit O6)', () => {
  it('defaults to a two-minute budget', () => {
    expect(SCORING_TIMEOUT_MS).toBe(120_000);
  });

  it('aborts the request once the timeout elapses', async () => {
    mockFetchAbortable();

    const result = await scoreWithBackend(photos(2), URL, { timeoutMs: 10 });

    expect(result.scored).toBe(false);
    expect(result.error).toMatch(/timed out/i);
  });

  it('honours an abort signal supplied by the caller', async () => {
    const caller = new AbortController();
    mockFetchAbortable();

    const pending = scoreWithBackend(photos(2), URL, { signal: caller.signal });
    caller.abort();
    const result = await pending;

    expect(result.scored).toBe(false);
    expect(result.error).toMatch(/cancelled/i);
  });

  it('bails out before encoding when the caller signal is already aborted', async () => {
    const caller = new AbortController();
    caller.abort();
    const fetchMock = mockFetchAbortable();
    const manipulator = require('expo-image-manipulator');
    manipulator.manipulateAsync.mockClear();

    const result = await scoreWithBackend(photos(20), URL, { signal: caller.signal });

    expect(result.scored).toBe(false);
    expect(result.error).toMatch(/cancelled/i);
    // Neither encoding nor the network call should have been attempted.
    expect(manipulator.manipulateAsync).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('passes an abort signal to fetch on every call', async () => {
    const fetchMock = mockFetchOk([score({ index: 0 })]);

    await scoreWithBackend(photos(1), URL);

    expect(fetchMock).toHaveBeenCalledWith(
      `${URL}/api/score_photos`,
      expect.objectContaining({ signal: expect.anything() }),
    );
  });
});

describe('successful scoring', () => {
  it('reports success and counts the photos it scored', async () => {
    mockFetchOk([score({ index: 0 }), score({ index: 1 })]);

    const result = await scoreWithBackend(photos(3), URL);

    expect(result.scored).toBe(true);
    expect(result.scoredCount).toBe(2);
    expect(result.error).toBeUndefined();
  });

  it('attaches every sidecar signal to the photo record', async () => {
    mockFetchOk([
      score({
        index: 0,
        face_count: 3,
        happy_face_count: 2,
        sharpness: 0.77,
        brightness_quality: 0.66,
        contrast: 0.55,
        saturation: 0.44,
        complexity: 0.33,
        shot_type: 'closeup',
        subject_ratio: 0.22,
        group_size: 'group',
        phash: 'abc123',
      }),
    ]);

    const { photos: out } = await scoreWithBackend(photos(1), URL);

    expect(out[0]).toMatchObject({
      faceCount: 3,
      happyFaceCount: 2,
      sharpness: 0.77,
      brightnessQuality: 0.66,
      contrast: 0.55,
      saturation: 0.44,
      complexity: 0.33,
      shotType: 'closeup',
      subjectRatio: 0.22,
      groupSize: 'group',
      phash: 'abc123',
    });
  });

  it.each([-1, 999])('ignores an out-of-range index (%p) from the sidecar', async (index) => {
    mockFetchOk([score({ index })]);

    const result = await scoreWithBackend(photos(2), URL);

    expect(result.scored).toBe(true);
    expect(result.scoredCount).toBe(0);
    expect(result.photos.every((p) => p.sharpness === undefined)).toBe(true);
  });

  it('keeps every resulting score within [0, 1] (audit L3)', async () => {
    mockFetchOk(
      Array.from({ length: 10 }, (_, i) =>
        score({ index: i, sharpness: i / 9, face_count: i, happy_face_count: i }),
      ),
    );

    const { photos: out } = await scoreWithBackend(photos(10), URL);

    for (const p of out) {
      expect(p.qualityScore).toBeGreaterThanOrEqual(0);
      expect(p.qualityScore).toBeLessThanOrEqual(1);
    }
  });

  it('sends the selected face engine to the sidecar', async () => {
    const fetchMock = mockFetchOk([score({ index: 0 })]);

    await scoreWithBackend(photos(1), URL, { faceEngine: 'insightface' });

    const body = JSON.parse((fetchMock.mock.calls[0] as any[])[1].body);
    expect(body.face_engine).toBe('insightface');
  });
});

describe('unscored remainder (audit L7)', () => {
  it('discounts photos beyond the candidate limit', async () => {
    const input = photos(5).map((p) => ({ ...p, qualityScore: 0.9 }));
    mockFetchOk([score({ index: 0 }), score({ index: 1 })]);

    const { photos: out } = await scoreWithBackend(input, URL, { candidateLimit: 2 });

    const unscored = out.filter((p) => p.sharpness === undefined);
    expect(unscored).toHaveLength(3);
    for (const p of unscored) {
      expect(p.qualityScore).toBeCloseTo(0.45, 10); // 0.9 * 0.5 confidence
    }
  });

  it('ranks a scored photo above an unscored one of equal starting quality', async () => {
    const input = photos(4).map((p) => ({ ...p, qualityScore: 0.8 }));
    // Deliberately mediocre vision scores — even these must win.
    mockFetchOk([score({ index: 0, sharpness: 0.5 }), score({ index: 1, sharpness: 0.5 })]);

    const { photos: out } = await scoreWithBackend(input, URL, { candidateLimit: 2 });

    const best = [...out].sort((a, b) => b.qualityScore - a.qualityScore);
    expect(best.slice(0, 2).every((p) => p.sharpness !== undefined)).toBe(true);
  });

  it('leaves the remainder untouched when scoring failed, so nothing is double-penalised', async () => {
    const input = photos(4).map((p) => ({ ...p, qualityScore: 0.8 }));
    (global as any).fetch = jest.fn(async () => {
      throw new Error('down');
    });

    const { photos: out } = await scoreWithBackend(input, URL, { candidateLimit: 2 });

    expect(out.every((p) => p.qualityScore === 0.8)).toBe(true);
  });

  it('returns candidates and remainder together, with no photo lost or duplicated', async () => {
    const input = photos(30);
    mockFetchOk(Array.from({ length: 10 }, (_, i) => score({ index: i })));

    const { photos: out } = await scoreWithBackend(input, URL, { candidateLimit: 10 });

    expect(out).toHaveLength(30);
    expect(new Set(out.map((p) => p.id)).size).toBe(30);
  });
});
