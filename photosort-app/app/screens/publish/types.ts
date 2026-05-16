import { Dimensions } from 'react-native';

export const SCREEN_W = Dimensions.get('window').width;
export const PREVIEW_H = 240;
export const IG_USER_KEY = 'ig_username';
export const IG_PASS_KEY = 'ig_password';

export type SaveStatus = 'idle' | 'saving' | 'success' | 'error';
export type IgStatus = 'idle' | 'posting' | 'success' | 'error';
