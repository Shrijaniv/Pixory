import { PersonaType } from '../../../lib/store';

export const METHODS = [
  { id: 'classic', label: 'Auto Select', sublabel: 'Fast · on-device quality scoring' },
  { id: 'claude', label: 'Claude AI', sublabel: 'Best results · uses backend API key' },
  { id: 'openai', label: 'GPT-4o', sublabel: 'OpenAI vision · uses backend API key' },
];

export const PERSONAS: { id: PersonaType; name: string; description: string }[] = [
  {
    id: 'aesthete',
    name: 'The Aesthete',
    description: 'Keeps a consistent grid — palette over chaos. Picks the photo that fits the colors, not the one where everyone\'s laughing hardest.',
  },
  {
    id: 'social',
    name: 'The Social Connector',
    description: 'Every slide needs people in it. Landscapes feel empty. "Tag me in that one" is the goal.',
  },
  {
    id: 'logger',
    name: 'The Experience Logger',
    description: '"I was here, I did this." Documentary instinct — slightly rough edges feel authentic and real.',
  },
  {
    id: 'storyteller',
    name: 'The Storyteller',
    description: 'Thinks in sequences. Will swap a better photo for a worse one because it transitions better to the next slide.',
  },
  {
    id: 'mood',
    name: 'The Mood Poster',
    description: 'Only posts when the light is right. Golden hour, soft shadows, atmosphere — the feeling is the post.',
  },
];

export function formatDateDisplay(s: string): string {
  if (!s) return 'Select';
  const d = new Date(s + 'T12:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/** Render a compact date-range label for the Dates pill. */
export function formatRange(from: string, to: string): string {
  if (!from && !to) return 'Any dates';
  if (from && to) return `${formatDateDisplay(from)} – ${formatDateDisplay(to)}`;
  return formatDateDisplay(from || to);
}
