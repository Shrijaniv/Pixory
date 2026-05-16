import { Dimensions } from 'react-native';

export interface SelectedItem {
  localUri: string;
  order: number;
}

export const CELL_GAP = 2;
export const COLS = 3;
export const RUNNER_UP_SIZE = 80;
export const MAX_CAROUSEL = 10;

export const SCREEN_W = Dimensions.get('window').width;
export const CELL_SIZE = (SCREEN_W - CELL_GAP * (COLS - 1)) / COLS;

export const ROLE_COLORS: Record<string, string> = {
  hook:   '#FF6B35',  // orange
  world:  '#4ECDC4',  // teal
  life:   '#FFE66D',  // yellow
  detail: '#C77DFF',  // purple
  closer: '#FF3B5C',  // pink-red
};
