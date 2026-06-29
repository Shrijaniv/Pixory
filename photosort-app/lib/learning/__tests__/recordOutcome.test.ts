import * as FileSystem from 'expo-file-system/legacy';
import type { LocalPhoto } from '../../store/state';
import { loadLearningHistory, recordOutcome } from '../storage';

const fs = new Map<string, string>();
beforeEach(() => {
  fs.clear();
  (FileSystem.getInfoAsync as jest.Mock).mockImplementation(async (p: string) => ({ exists: fs.has(p) }));
  (FileSystem.readAsStringAsync as jest.Mock).mockImplementation(async (p: string) => {
    if (!fs.has(p)) throw new Error('not found');
    return fs.get(p)!;
  });
  (FileSystem.writeAsStringAsync as jest.Mock).mockImplementation(async (p: string, data: string) => { fs.set(p, data); });
});

function photo(over: Partial<LocalPhoto> = {}): LocalPhoto {
  return {
    id: 'p', uri: 'ph://p', localUri: 'file:///p.jpg', filename: 'p.jpg',
    creationTime: 0, width: 100, height: 100, qualityScore: 0.5,
    sharpness: 0.8, faceCount: 1, brightnessQuality: 0.7,
    contrast: 0.6, saturation: 0.5, complexity: 0.3,
    ...over,
  } as LocalPhoto;
}

describe('recordOutcome', () => {
  it('promotes: increments count and captures real features', async () => {
    await recordOutcome(photo({ sharpness: 0.8 }), 'promoted', null);
    const h = await loadLearningHistory();
    expect(h.default.promotedCount).toBe(1);
    expect(h.default.promotedAvg.sharpness).toBeCloseTo(0.8, 5);
    expect(h.default.rejectedCount).toBe(0);
  });

  it('maps faceCount → the right group-size bucket (the bug area)', async () => {
    await recordOutcome(photo({ faceCount: 0 }), 'promoted', null);  // noFace
    await recordOutcome(photo({ faceCount: 1 }), 'promoted', null);  // solo
    await recordOutcome(photo({ faceCount: 3 }), 'promoted', null);  // small (2–3)
    await recordOutcome(photo({ faceCount: 5 }), 'promoted', null);  // group (4+)
    const g = (await loadLearningHistory()).default.groupSize;
    expect(g).toMatchObject({ noFace: 1, solo: 1, small: 1, group: 1, totalPromoted: 4 });
  });

  it('rejects: updates rejected stats and leaves group-size untouched', async () => {
    await recordOutcome(photo({ faceCount: 4 }), 'rejected', null);
    const h = await loadLearningHistory();
    expect(h.default.rejectedCount).toBe(1);
    expect(h.default.promotedCount).toBe(0);
    expect(h.default.groupSize.totalPromoted).toBe(0); // rejections never touch group buckets
  });

  it('keeps a running average across multiple promotes', async () => {
    await recordOutcome(photo({ sharpness: 0.4 }), 'promoted', null);
    await recordOutcome(photo({ sharpness: 0.8 }), 'promoted', null);
    const h = await loadLearningHistory();
    expect(h.default.promotedCount).toBe(2);
    expect(h.default.promotedAvg.sharpness).toBeCloseTo(0.6, 5); // (0.4 + 0.8) / 2
  });

  it('keys learning by persona', async () => {
    await recordOutcome(photo(), 'promoted', 'social');
    const h = await loadLearningHistory();
    expect(h.social.promotedCount).toBe(1);
    expect(h.default).toBeUndefined();
  });

  it('never throws on a write failure (learning must not break curation)', async () => {
    (FileSystem.writeAsStringAsync as jest.Mock).mockRejectedValueOnce(new Error('disk full'));
    await expect(recordOutcome(photo(), 'promoted', null)).resolves.toBeUndefined();
  });
});
