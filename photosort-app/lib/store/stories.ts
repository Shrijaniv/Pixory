/**
 * Stories history — persists each curation as a Story record so the Home hub,
 * Profile grids, and Story Detail screen can show past work.
 * Stored in DocumentDirectory; survives app restarts.
 */
import * as FileSystem from 'expo-file-system/legacy';
import { PersonaType } from './state';

export interface Story {
  id: string;
  title: string;            // from store.vibe (fallback "Untitled story")
  coverUri: string;         // first selected photo localUri
  photoUris: string[];      // ordered selection snapshot
  date: number;             // ms epoch (creation)
  photoCount: number;
  status: 'draft' | 'published';
  savedToAlbum: boolean;
  captionText?: string;
  hashtags?: string[];
  persona?: PersonaType | null;
}

const STORIES_FILE = (FileSystem.documentDirectory ?? '') + 'pixory_stories_v1.json';

export async function loadStories(): Promise<Story[]> {
  try {
    const info = await FileSystem.getInfoAsync(STORIES_FILE);
    if (!info.exists) return [];
    const raw = await FileSystem.readAsStringAsync(STORIES_FILE);
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Newest first
    return (parsed as Story[]).sort((a, b) => b.date - a.date);
  } catch {
    return [];
  }
}

async function writeStories(stories: Story[]): Promise<void> {
  try {
    await FileSystem.writeAsStringAsync(STORIES_FILE, JSON.stringify(stories));
  } catch { /* ignore */ }
}

/** Insert a new story (or replace one with the same id). */
export async function saveStory(story: Story): Promise<void> {
  const all = await loadStories();
  const next = [story, ...all.filter((s) => s.id !== story.id)];
  await writeStories(next);
}

/**
 * Merge a partial update into an existing story by id. Creates the row if the
 * id isn't found yet (using the supplied fields + sensible defaults).
 */
export async function upsertStory(
  patch: Partial<Story> & { id: string },
): Promise<void> {
  const all = await loadStories();
  const existing = all.find((s) => s.id === patch.id);
  const merged: Story = {
    id: patch.id,
    title: patch.title ?? existing?.title ?? 'Untitled story',
    coverUri: patch.coverUri ?? existing?.coverUri ?? '',
    photoUris: patch.photoUris ?? existing?.photoUris ?? [],
    date: patch.date ?? existing?.date ?? Date.now(),
    photoCount: patch.photoCount ?? existing?.photoCount ?? (patch.photoUris ?? existing?.photoUris ?? []).length,
    status: patch.status ?? existing?.status ?? 'draft',
    savedToAlbum: patch.savedToAlbum ?? existing?.savedToAlbum ?? false,
    captionText: patch.captionText ?? existing?.captionText,
    hashtags: patch.hashtags ?? existing?.hashtags,
    persona: patch.persona ?? existing?.persona ?? null,
  };
  const next = [merged, ...all.filter((s) => s.id !== patch.id)];
  await writeStories(next);
}

export async function getStory(id: string): Promise<Story | null> {
  const all = await loadStories();
  return all.find((s) => s.id === id) ?? null;
}

export async function deleteStory(id: string): Promise<void> {
  const all = await loadStories();
  await writeStories(all.filter((s) => s.id !== id));
}

/** Generate a unique story id. */
export function newStoryId(): string {
  return `story_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
