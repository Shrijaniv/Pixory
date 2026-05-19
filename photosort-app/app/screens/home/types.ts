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
    description: "Has a consistent grid. Will reject a perfect moment because the colors clash. Picks the photo that fits the palette, not the one where everyone's laughing hardest.",
  },
  {
    id: 'social',
    name: 'The Social Connector',
    description: 'Every slide needs to have people in it. Landscapes feel empty. "Tag me in that one" is the goal. They want their friends to share it.',
  },
  {
    id: 'logger',
    name: 'The Experience Logger',
    description: '"I was here, I did this." Documentary instinct. Slightly rough edges feel authentic. They\'d post the blurry photo from the boat because it was a real moment.',
  },
  {
    id: 'storyteller',
    name: 'The Storyteller',
    description: "They think in sequences. They'll swap a better photo for a worse one because it transitions better to the next slide.",
  },
  {
    id: 'mood',
    name: 'The Mood Poster',
    description: 'Only posts when the light is right. Golden hour, soft shadows, atmosphere — the feeling in the photo is the post.',
  },
];

export function formatDateDisplay(s: string): string {
  if (!s) return 'Select';
  const d = new Date(s + 'T12:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
