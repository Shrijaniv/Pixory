import { confirmedUserUris, type FaceMatch } from '../matching';

const photo = (localUri: string) => ({ localUri });
const match = (index: number, present: boolean, similarity = 0.5): FaceMatch => ({
  index, user_face_present: present, similarity,
});

describe('confirmedUserUris', () => {
  const submitted = [photo('a'), photo('b'), photo('c')];

  it('collects only positively matched photos', () => {
    const result = confirmedUserUris(
      [match(0, true), match(1, false), match(2, true)],
      submitted,
    );

    expect([...result].sort()).toEqual(['a', 'c']);
  });

  it('confirms nothing when every match is negative', () => {
    expect(confirmedUserUris([match(0, false), match(1, false)], submitted).size).toBe(0);
  });

  it('resolves indices against the submitted list, not the original', () => {
    // Photo "b" failed to encode, so only a and c were submitted. A match on
    // index 1 therefore means "c" — reading it against the original list
    // would wrongly attribute the result to "b".
    const actuallySubmitted = [photo('a'), photo('c')];

    const result = confirmedUserUris([match(1, true)], actuallySubmitted);

    expect([...result]).toEqual(['c']);
  });

  it('leaves a photo that was never submitted unconfirmed', () => {
    const result = confirmedUserUris([match(0, true)], [photo('a')]);

    expect(result.has('b')).toBe(false);
  });

  it.each([
    ['an empty match list', []],
    ['undefined', undefined],
    ['null', null],
  ])('returns an empty set for %s', (_label, matches) => {
    expect(confirmedUserUris(matches as FaceMatch[] | undefined | null, submitted).size).toBe(0);
  });

  it('ignores an out-of-range index rather than throwing', () => {
    const result = confirmedUserUris([match(99, true), match(-1, true)], submitted);

    expect(result.size).toBe(0);
  });

  it('ignores a malformed match entry', () => {
    const result = confirmedUserUris(
      [undefined as unknown as FaceMatch, match(0, true)],
      submitted,
    );

    expect([...result]).toEqual(['a']);
  });

  it('deduplicates repeated matches for one photo', () => {
    const result = confirmedUserUris([match(0, true), match(0, true)], submitted);

    expect(result.size).toBe(1);
  });

  it('handles an empty submitted list', () => {
    expect(confirmedUserUris([match(0, true)], []).size).toBe(0);
  });

  it('ignores similarity — presence is the matcher\'s decision to make', () => {
    const result = confirmedUserUris([match(0, true, 0.01)], submitted);

    expect([...result]).toEqual(['a']);
  });
});
