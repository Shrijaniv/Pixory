/**
 * Photo-label tests.
 *
 * The label is the only channel through which the model receives objective,
 * on-device measurements. `quality` previously carried the raw byte proxy and
 * rendered as "quality 250000000/100" on every photo, while the system prompt
 * instructed the model to prefer higher-quality photos (audit L3).
 */
import { describe, expect, it } from 'vitest';
import { buildPhotoLabel } from '../aiCurator';
import type { PhotoMetadata } from '../../types/curateTypes';

const label = (meta?: PhotoMetadata, favorited = false, name = 'IMG_1.jpg') =>
  buildPhotoLabel(0, name, meta, favorited);

describe('quality tag (audit L3)', () => {
  it.each([
    [0, '0/100'],
    [0.5, '50/100'],
    [0.724, '72/100'],
    [1, '100/100'],
  ])('renders a normalised score of %p as %s', (quality, expected) => {
    expect(label({ quality })).toContain(`quality ${expected}`);
  });

  it.each([
    ['the old raw byte proxy', 2_500_000],
    ['a negative score', -1],
    ['NaN', NaN],
    ['Infinity', Infinity],
    ['just above one', 1.0001],
  ])('omits the tag entirely for %s', (_label, quality) => {
    expect(label({ quality })).not.toContain('quality');
  });

  it('omits the tag when quality is absent', () => {
    expect(label({ shot_type: 'wide' })).not.toContain('quality');
  });

  it('never emits a value outside 0-100', () => {
    for (const q of [0, 0.001, 0.5, 0.999, 1]) {
      const match = label({ quality: q }).match(/quality (\d+)\/100/);
      expect(match).not.toBeNull();
      const value = Number(match![1]);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(100);
    }
  });
});

describe('the rest of the label', () => {
  it('starts with the index and filename', () => {
    expect(label(undefined, false, 'IMG_42.jpg')).toMatch(/^Photo 0: IMG_42\.jpg/);
  });

  it('falls back to a generated name when none is supplied', () => {
    expect(buildPhotoLabel(3, undefined, undefined, false)).toContain('photo_3');
  });

  it('emits no tag section when there is no metadata', () => {
    expect(label()).toBe('Photo 0: IMG_1.jpg');
  });

  it('includes the shot type', () => {
    expect(label({ shot_type: 'closeup' })).toContain('closeup');
  });

  it.each([
    [1, '1 person'],
    [2, '2 people'],
    [7, '7 people'],
  ])('renders a face count of %p as "%s"', (face_count, expected) => {
    expect(label({ face_count })).toContain(expected);
  });

  it('omits the people tag when no face was detected', () => {
    expect(label({ face_count: 0 })).not.toContain('person');
    expect(label({ face_count: 0 })).not.toContain('people');
  });

  it('adds the smiling count when there is one', () => {
    expect(label({ face_count: 3, happy_face_count: 2 })).toContain('3 people, 2 smiling');
  });

  it('omits the smiling count when it is zero', () => {
    expect(label({ face_count: 3, happy_face_count: 0 })).not.toContain('smiling');
  });

  it('marks photos the poster appears in', () => {
    expect(label({ is_user: true })).toContain("you're in it");
    expect(label({ is_user: false })).not.toContain("you're in it");
  });

  it('marks favourites', () => {
    expect(label(undefined, true)).toContain('♥ favorited');
    expect(label(undefined, false)).not.toContain('♥');
  });

  it('carries the near-duplicate group label', () => {
    expect(label({ dup_group: 'B' })).toContain('near-dup B');
  });

  it('separates tags with a middle dot after an em dash', () => {
    const out = label({ shot_type: 'wide', quality: 0.8, face_count: 2 }, true);
    expect(out).toContain(' — ');
    expect(out.split(' — ')[1].split(' · ').length).toBe(4);
  });

  it('renders a capture time', () => {
    expect(label({ taken_at: Date.UTC(2024, 11, 17, 15, 30) })).toMatch(/Dec 17|Dec 18/);
  });

  it('omits a capture time of zero rather than rendering the epoch', () => {
    expect(label({ taken_at: 0 })).not.toContain('1970');
  });
});
