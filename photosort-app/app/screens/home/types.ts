/** Format a story's meta line: "Apr 3 · 10 photos". */
export function formatStoryMeta(date: number, photoCount: number): string {
  const d = new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `${d} · ${photoCount} photo${photoCount === 1 ? '' : 's'}`;
}
