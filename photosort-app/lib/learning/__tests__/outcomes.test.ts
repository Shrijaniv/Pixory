/**
 * Outcome resolution — the fix for audit L5 (double counting) and half of L1
 * (kept picks recorded as promotions).
 */
import { resolveOutcomes } from '../outcomes';
import type { LocalPhoto } from '../../store/state';

function photo(uri: string, over: Partial<LocalPhoto> = {}): LocalPhoto {
  return {
    id: uri, uri: `ph://${uri}`, localUri: uri, filename: `${uri}.jpg`,
    creationTime: 0, width: 100, height: 100, qualityScore: 0.5,
    sharpness: 0.8, faceCount: 1, brightnessQuality: 0.7,
    contrast: 0.6, saturation: 0.5, complexity: 0.3,
    ...over,
  } as LocalPhoto;
}

/** Resolve against a library where every URI has a scored record. */
function resolve(final: string[], proposed: string[], known = [...final, ...proposed]) {
  const lib = new Map(known.map((u) => [u, photo(u)]));
  return resolveOutcomes(final, new Set(proposed), (u) => lib.get(u));
}

const byUri = (out: ReturnType<typeof resolve>) =>
  Object.fromEntries(out.map((o) => [o.photo.localUri, o.outcome]));

describe('the four cases', () => {
  it('marks an untouched AI pick as kept, not promoted (audit L1)', () => {
    expect(byUri(resolve(['a'], ['a']))).toEqual({ a: 'kept' });
  });

  it('marks a photo the user added as promoted', () => {
    expect(byUri(resolve(['a', 'b'], ['a']))).toEqual({ a: 'kept', b: 'promoted' });
  });

  it('marks a removed AI pick as rejected', () => {
    expect(byUri(resolve(['a'], ['a', 'b']))).toEqual({ a: 'kept', b: 'rejected' });
  });

  it('says nothing about a runner-up the user never touched', () => {
    const lib = new Map([['a', photo('a')], ['spare', photo('spare')]]);
    const out = resolveOutcomes(['a'], new Set(['a']), (u) => lib.get(u));

    expect(out.map((o) => o.photo.localUri)).not.toContain('spare');
  });
});

describe('a session the user never edited', () => {
  it('produces only kept outcomes', () => {
    const picks = ['a', 'b', 'c', 'd', 'e'];

    const out = resolve(picks, picks);

    expect(out).toHaveLength(5);
    expect(out.every((o) => o.outcome === 'kept')).toBe(true);
  });

  it('produces no decisive outcome at all', () => {
    const picks = ['a', 'b', 'c'];

    const out = resolve(picks, picks);

    expect(out.filter((o) => o.outcome !== 'kept')).toHaveLength(0);
  });
});

describe('idempotency (audit L5)', () => {
  it('records one outcome per photo however the user got there', () => {
    // Promote -> deselect -> promote ends in the carousel; it is one decision.
    expect(byUri(resolve(['a'], []))).toEqual({ a: 'promoted' });
  });

  it('treats a re-added AI pick by where it ended up, not how it got there', () => {
    expect(byUri(resolve(['a'], ['a']))).toEqual({ a: 'kept' });
  });

  it('never returns the same photo twice', () => {
    const out = resolve(['a', 'b', 'c'], ['a', 'b', 'd', 'e']);
    const uris = out.map((o) => o.photo.localUri);

    expect(new Set(uris).size).toBe(uris.length);
  });

  it('collapses a duplicated URI in the final selection', () => {
    const lib = new Map([['a', photo('a')]]);

    const out = resolveOutcomes(['a', 'a', 'a'], new Set(['a']), (u) => lib.get(u));

    expect(out).toHaveLength(1);
  });

  it('is stable when run twice on the same input', () => {
    const first = byUri(resolve(['a', 'b'], ['a', 'c']));
    const second = byUri(resolve(['a', 'b'], ['a', 'c']));

    expect(first).toEqual(second);
  });
});

describe('photos without measurements (audit L4)', () => {
  it('skips a photo the library cannot resolve', () => {
    const lib = new Map([['a', photo('a')]]);

    const out = resolveOutcomes(['a', 'from-library'], new Set(['a']), (u) => lib.get(u));

    expect(out.map((o) => o.photo.localUri)).toEqual(['a']);
  });

  it('skips an unresolvable proposed photo too', () => {
    const lib = new Map([['a', photo('a')]]);

    const out = resolveOutcomes(['a'], new Set(['a', 'gone']), (u) => lib.get(u));

    expect(out).toHaveLength(1);
  });
});

describe('edge cases', () => {
  it('returns nothing for an empty session', () => {
    expect(resolve([], [])).toEqual([]);
  });

  it('marks every proposal rejected when the user clears the carousel', () => {
    const out = resolve([], ['a', 'b', 'c']);

    expect(out).toHaveLength(3);
    expect(out.every((o) => o.outcome === 'rejected')).toBe(true);
  });

  it('marks everything promoted when nothing was proposed', () => {
    const out = resolve(['a', 'b'], []);

    expect(out.every((o) => o.outcome === 'promoted')).toBe(true);
  });

  it('handles a completely replaced selection', () => {
    expect(byUri(resolve(['x', 'y'], ['a', 'b']))).toEqual({
      x: 'promoted', y: 'promoted', a: 'rejected', b: 'rejected',
    });
  });

  it('accepts any iterable for the final selection', () => {
    const lib = new Map([['a', photo('a')]]);

    const out = resolveOutcomes(new Set(['a']), new Set(['a']), (u) => lib.get(u));

    expect(out).toHaveLength(1);
  });
});
