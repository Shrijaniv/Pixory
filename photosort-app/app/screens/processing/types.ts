import { Caption } from '../../../lib/store';

export interface Step { id: string; message: string; done: boolean; }

export function defaultCaptions(): Caption[] {
  return [
    { mood: 'wanderlust', text: 'Chasing moments worth remembering. ✨', hashtags: ['travel', 'wanderlust', 'explore'] },
    { mood: 'minimal', text: 'Some moments speak for themselves.', hashtags: ['minimal', 'photography'] },
    { mood: 'story', text: 'Every photo tells a story. Here is a chapter of mine.', hashtags: ['memories', 'story', 'life'] },
    { mood: 'playful', text: 'Good vibes only 🌟', hashtags: ['vibes', 'fun', 'happy'] },
  ];
}
