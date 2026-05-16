/**
 * Pixory design tokens — single source of truth for all visual constants.
 * Every styles.ts file imports from here. No hex strings elsewhere.
 */

export const Colors = {
  // Brand
  primary:        '#0061A3',
  primaryBright:  '#0095F6',
  primaryLight:   '#EAF5FF',
  secondary:      '#B7004F',

  // Gradients (use with expo-linear-gradient)
  gradientStart:  '#B7004F',
  gradientEnd:    '#0061A3',
  igGradient:     ['#f09433', '#e6683c', '#dc2743', '#cc2366', '#bc1888'] as const,

  // Surfaces
  bg:             '#FAF9F9',
  surface:        '#FFFFFF',
  surfaceAlt:     '#F5F5F5',
  surfaceDark:    '#000000',
  surfaceDark2:   '#111111',
  surfaceDark3:   '#1A1A1A',

  // Text
  text:           '#1B1C1C',
  textMuted:      '#3F4752',
  textInverse:    '#FFFFFF',
  placeholder:    '#BFC7D4',

  // Borders
  border:         '#BFC7D4',
  borderDark:     '#2A2A2A',

  // Status
  success:        '#34C759',
  error:          '#FF3B30',
  warning:        '#FF9500',

  // Story role badge colours
  roleHook:       '#FF6B35',
  roleWorld:      '#4ECDC4',
  roleLife:       '#FFE66D',
  roleDetail:     '#C77DFF',
  roleCloser:     '#FF3B5C',
} as const;

export const Spacing = {
  xs:  4,
  sm:  8,
  md:  12,
  lg:  16,
  xl:  20,
  xxl: 32,
} as const;

export const Radius = {
  sm:   4,
  md:   8,
  lg:   10,
  xl:   12,
  xxl:  16,
  full: 9999,
} as const;

/**
 * Typography scale.
 * Fonts loaded via expo-font in _layout.tsx.
 * Falls back to system fonts until loaded.
 */
export const Typography = {
  displayLg: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 24,
    lineHeight: 32,
    letterSpacing: -0.48,
  },
  displayMd: {
    fontFamily: 'PlusJakartaSans-SemiBold',
    fontSize: 18,
    lineHeight: 24,
  },
  bodyLg: {
    fontFamily: 'Inter-Regular',
    fontSize: 16,
    lineHeight: 24,
  },
  bodyMd: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    lineHeight: 20,
  },
  bodySm: {
    fontFamily: 'Inter-Regular',
    fontSize: 13,
    lineHeight: 18,
  },
  labelCaps: {
    fontFamily: 'Inter-Bold',
    fontSize: 11,
    lineHeight: 16,
    letterSpacing: 0.55,
    textTransform: 'uppercase' as const,
  },
  labelBold: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 14,
    lineHeight: 20,
  },
} as const;

/** Map story role → badge colour */
export const RoleColors: Record<string, string> = {
  hook:   Colors.roleHook,
  world:  Colors.roleWorld,
  life:   Colors.roleLife,
  detail: Colors.roleDetail,
  closer: Colors.roleCloser,
};
