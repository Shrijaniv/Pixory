import * as FileSystem from 'expo-file-system/legacy';
import { deleteStory, getStory, loadStories, newStoryId, saveStory, Story, upsertStory } from '../stories';

// Back the FileSystem mock with an in-memory store so writes round-trip.
const fs = new Map<string, string>();
beforeEach(() => {
  fs.clear();
  (FileSystem.getInfoAsync as jest.Mock).mockImplementation(async (p: string) => ({ exists: fs.has(p) }));
  (FileSystem.readAsStringAsync as jest.Mock).mockImplementation(async (p: string) => {
    if (!fs.has(p)) throw new Error('not found');
    return fs.get(p)!;
  });
  (FileSystem.writeAsStringAsync as jest.Mock).mockImplementation(async (p: string, data: string) => { fs.set(p, data); });
  (FileSystem.deleteAsync as jest.Mock).mockImplementation(async (p: string) => { fs.delete(p); });
});

function makeStory(over: Partial<Story> = {}): Story {
  return {
    id: over.id ?? newStoryId(),
    title: 'Tokyo, in bites',
    coverUri: 'file:///a.jpg',
    photoUris: ['file:///a.jpg', 'file:///b.jpg'],
    date: 1000,
    photoCount: 2,
    status: 'draft',
    savedToAlbum: false,
    ...over,
  };
}

describe('stories store', () => {
  it('returns [] when nothing has been saved', async () => {
    expect(await loadStories()).toEqual([]);
  });

  it('saves and reads back a story', async () => {
    const s = makeStory({ id: 's1' });
    await saveStory(s);
    const all = await loadStories();
    expect(all).toHaveLength(1);
    expect(all[0].id).toBe('s1');
  });

  it('returns stories newest-first', async () => {
    await saveStory(makeStory({ id: 'old', date: 100 }));
    await saveStory(makeStory({ id: 'new', date: 999 }));
    const all = await loadStories();
    expect(all.map((s) => s.id)).toEqual(['new', 'old']);
  });

  it('saveStory replaces a story with the same id (no duplicates)', async () => {
    await saveStory(makeStory({ id: 's1', title: 'First' }));
    await saveStory(makeStory({ id: 's1', title: 'Second' }));
    const all = await loadStories();
    expect(all).toHaveLength(1);
    expect(all[0].title).toBe('Second');
  });

  it('upsertStory creates a row when the id is new', async () => {
    await upsertStory({ id: 'fresh', title: 'Brand new' });
    const s = await getStory('fresh');
    expect(s?.title).toBe('Brand new');
    expect(s?.status).toBe('draft'); // default
  });

  it('upsertStory merges into an existing row, preserving untouched fields', async () => {
    await saveStory(makeStory({ id: 's1', title: 'Keep me', photoCount: 2 }));
    await upsertStory({ id: 's1', status: 'published', captionText: 'hi' });
    const s = await getStory('s1');
    expect(s?.title).toBe('Keep me');       // preserved
    expect(s?.photoCount).toBe(2);          // preserved
    expect(s?.status).toBe('published');    // updated
    expect(s?.captionText).toBe('hi');      // added
  });

  it('getStory returns null for a missing id', async () => {
    expect(await getStory('nope')).toBeNull();
  });

  it('deleteStory removes only the target', async () => {
    await saveStory(makeStory({ id: 'a' }));
    await saveStory(makeStory({ id: 'b' }));
    await deleteStory('a');
    const all = await loadStories();
    expect(all.map((s) => s.id)).toEqual(['b']);
  });

  it('newStoryId produces unique ids', () => {
    expect(newStoryId()).not.toBe(newStoryId());
  });

  it('survives a corrupt stories file without throwing', async () => {
    (FileSystem.getInfoAsync as jest.Mock).mockResolvedValueOnce({ exists: true });
    (FileSystem.readAsStringAsync as jest.Mock).mockResolvedValueOnce('{not json');
    expect(await loadStories()).toEqual([]);
  });
});
