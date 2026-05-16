import { Dimensions } from 'react-native';

export const SCREEN_W = Dimensions.get('window').width;
export const THUMB_SIZE = 56;

export const MOOD_META: Record<string, { icon: string; color: string }> = {
  wanderlust: { icon: '✈️', color: '#FF6B35' },
  minimal:    { icon: '◻', color: '#555555' },
  story:      { icon: '📖', color: '#A855F7' },
  playful:    { icon: '🎉', color: '#0095F6' },
};

export type MoodKey = 'wanderlust' | 'minimal' | 'story' | 'playful';

export const PIXORY_CREDIT = 'Curated with Pixory ✨';
