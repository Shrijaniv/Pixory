/**
 * Pixory design tokens — single source of truth for all visual constants.
 * Dark, Instagram-flavored redesign: pure-black base, single amber→coral accent.
 * Every styles.ts file imports from here. No hex strings elsewhere.
 */

export const Colors = {
  // Base (pure black, layered charcoal surfaces)
  bg:           '#0A0A0B',  // app background
  surface:      '#161618',  // inputs, cards, secondary buttons
  surfaceAlt:   '#141416',  // preview cards, info chips
  elevated:     '#1F1F22',  // elevated components
  toggleOff:    '#2A2A2E',  // toggle track when off

  // Lines / borders (rgba over the black base)
  line:         'rgba(255,255,255,0.08)',
  lineMid:      'rgba(255,255,255,0.10)',
  lineStrong:   'rgba(255,255,255,0.16)',

  // Text
  text:         '#FAFAFA',
  textMuted:    '#9A9AA2',
  textFaint:    '#7A7A82',
  textDim:      '#5E5E66',
  textInverse:  '#FFFFFF',

  // Accent — "Sunset" amber→coral. THE single brand accent.
  accentSolid:      '#FF7A4D',
  accentText:       '#FF8A5A',
  accentGlow:       'rgba(255,90,78,0.40)',
  accentWash:       'rgba(255,90,78,0.08)',
  accentWashBorder: 'rgba(255,90,78,0.18)',
  heroPillText:     '#B23A22',  // text on the white pill inside hero cards

  // Status (semantic)
  success:      '#4ED17A',
  successWash:  'rgba(78,209,122,0.12)',
  draft:        '#FFAE3D',
  draftWash:    'rgba(255,174,61,0.13)',
  error:        '#FF6B5A',

  // Hashtag run colour in captions
  hashtag:      '#5B8DEF',

  // Story role badge colours (review)
  roleHook:     '#FF6B35',
  roleWorld:    '#4ECDC4',
  roleLife:     '#FFE66D',
  roleDetail:   '#C77DFF',
  roleCloser:   '#FF3B5C',
} as const;

/** Gradient tuples for expo-linear-gradient (`colors={...}`). */
export const Gradients = {
  accent:      ['#FFAE3D', '#FF5A4E'] as readonly [string, string],
  accentHero:  ['#FFAE3D', '#FF7A45', '#FF5A4E'] as readonly [string, string, string],
  logo:        ['#FFC65A', '#FFAE3D', '#FF5A4E'] as readonly [string, string, string],
  // Conic-ish warm sweep for the processing ring (approximated with a linear run)
  ring:        ['#FFC65A', '#FFAE3D', '#FF5A4E', '#FF8A45', '#FFC65A'] as readonly [string, string, string, string, string],
  // Instagram 5-stop brand gradient — RESERVED for the Connect screen icon only.
  ig:          ['#FEDA75', '#FA7E1E', '#D62976', '#962FBF', '#4F5BD5'] as readonly [string, string, string, string, string],
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
  sm:    8,
  md:    10,
  tile:  12,
  input: 14,
  lg:    15,
  fab:   16,
  card:  20,
  sheet: 22,
  full:  9999,
} as const;

/**
 * Typography scale. Fonts loaded via expo-font in _layout.tsx.
 * Schibsted Grotesk for UI/headings; Space Mono for tiny numeric/label accents.
 */
export const Typography = {
  display: {
    fontFamily: 'SchibstedGrotesk_800ExtraBold',
    fontSize: 24,
    lineHeight: 30,
    letterSpacing: -0.48,
  },
  displayLg: {
    fontFamily: 'SchibstedGrotesk_800ExtraBold',
    fontSize: 30,
    lineHeight: 34,
    letterSpacing: -0.6,
  },
  title: {
    fontFamily: 'SchibstedGrotesk_700Bold',
    fontSize: 17,
    lineHeight: 22,
  },
  titleSm: {
    fontFamily: 'SchibstedGrotesk_700Bold',
    fontSize: 14,
    lineHeight: 19,
  },
  bodyLg: {
    fontFamily: 'SchibstedGrotesk_500Medium',
    fontSize: 14,
    lineHeight: 21,
  },
  bodyMd: {
    fontFamily: 'SchibstedGrotesk_400Regular',
    fontSize: 13,
    lineHeight: 20,
  },
  bodySm: {
    fontFamily: 'SchibstedGrotesk_400Regular',
    fontSize: 12,
    lineHeight: 18,
  },
  labelMono: {
    fontFamily: 'SpaceMono_700Bold',
    fontSize: 10,
    letterSpacing: 1.4,
    textTransform: 'uppercase' as const,
  },
  mono: {
    fontFamily: 'SpaceMono_700Bold',
    fontSize: 11,
    letterSpacing: 0.5,
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
