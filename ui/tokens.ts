/**
 * Design tokens. Values come from docs/ui-guide (Svaraa website look: cream canvas, plum primary).
 * Names follow the web token names (--bg-canvas -> canvas, etc.). Never hard-code a colour outside this file.
 */
export type ColorSet = {
  canvas: string;
  surface: string;
  surfaceSolid: string;
  sunken: string;
  brand: string;
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  heading: string;
  action: string;
  actionPressed: string;
  onAction: string;
  accentMemory: string;
  accentSpirit: string;
  accentItalic: string;
  focus: string;
  border: string;
  borderSubtle: string;
  good: string;
  goodTint: string;
  attention: string;
  attentionTint: string;
  safety: string;
  safetyTint: string;
  info: string;
  infoTint: string;
  /** Solid red for the safety button and banner (white text), same in both schemes. */
  dangerSolid: string;
  onDanger: string;
  scrim: string;
};

export const lightColors: ColorSet = {
  canvas: '#FBF7F2',
  surface: 'rgba(255,255,255,0.55)',
  surfaceSolid: '#FFFFFF',
  sunken: 'rgba(111,29,71,0.06)',
  brand: '#4A1532',
  textPrimary: '#3A3340',
  textSecondary: '#6B6474',
  textTertiary: '#7B7483',
  heading: '#4A1532',
  action: '#6F1D47',
  actionPressed: '#5A173A',
  onAction: '#FFF8F2',
  accentMemory: '#C8505B',
  accentSpirit: '#B88A44',
  accentItalic: '#C8505B',
  focus: '#6F1D47',
  border: 'rgba(255,255,255,0.65)',
  borderSubtle: 'rgba(110,29,71,0.1)',
  good: '#167A41',
  goodTint: '#E5F6EC',
  attention: '#8F5A0F',
  attentionTint: '#FBF1DC',
  safety: '#C53030',
  safetyTint: '#FDECEC',
  info: '#2C64A8',
  infoTint: '#E4EEF9',
  dangerSolid: '#C53030',
  onDanger: '#FFFFFF',
  scrim: 'rgba(34,9,26,0.45)',
};

export const darkColors: ColorSet = {
  canvas: '#18171A',
  surface: 'rgba(40,38,43,0.48)',
  surfaceSolid: '#242227',
  sunken: 'rgba(0,0,0,0.28)',
  brand: '#4A1532',
  textPrimary: '#E9E3DC',
  textSecondary: '#B3AAB3',
  textTertiary: '#928A95',
  heading: '#F5EFE7',
  action: '#E2BD72',
  actionPressed: '#EDCB86',
  onAction: '#22180C',
  accentMemory: '#E8A0A6',
  accentSpirit: '#D9B065',
  accentItalic: '#E6BF74',
  focus: '#E2BD72',
  border: 'rgba(255,255,255,0.14)',
  borderSubtle: 'rgba(255,255,255,0.1)',
  good: '#4CCF80',
  goodTint: 'rgba(76,207,128,0.14)',
  attention: '#E8B34F',
  attentionTint: 'rgba(232,179,79,0.14)',
  safety: '#F07272',
  safetyTint: 'rgba(240,114,114,0.14)',
  info: '#8FB4E3',
  infoTint: 'rgba(143,180,227,0.14)',
  dangerSolid: '#C53030',
  onDanger: '#FFFFFF',
  scrim: 'rgba(0,0,0,0.6)',
};

/** Spacing steps: 4, 8, 12, 16, 24, 32, 48, 64. */
export const space = { 1: 4, 2: 8, 3: 12, 4: 16, 5: 24, 6: 32, 7: 48, 8: 64 } as const;

export const radius = { sm: 10, md: 14, lg: 18, xl: 24, xxl: 32, full: 999 } as const;

export type TypeVariant =
  'display' | 'title1' | 'title2' | 'heading' | 'bodyLg' | 'body' | 'bodySm' | 'label' | 'caption' | 'kicker';

export type TypeStyle = {
  size: number;
  line: number;
  weight: '400' | '500' | '600';
  /** Serif display face (Newsreader) or UI face (Inter). */
  face: 'display' | 'ui';
  tracking?: number;
  uppercase?: boolean;
};

/**
 * Type scale for the app. A step smaller than the web guide's marketing sizes, so screens read as a
 * compact, professional app rather than a landing page (see docs/ui-guide, "App type scale").
 */
export const typeScale: Record<TypeVariant, TypeStyle> = {
  display: { size: 32, line: 40, weight: '400', face: 'display' },
  title1: { size: 26, line: 32, weight: '400', face: 'display' },
  title2: { size: 21, line: 28, weight: '400', face: 'display' },
  heading: { size: 16, line: 22, weight: '600', face: 'ui' },
  bodyLg: { size: 16, line: 24, weight: '400', face: 'ui' },
  body: { size: 15, line: 22, weight: '400', face: 'ui' },
  bodySm: { size: 13, line: 18, weight: '400', face: 'ui' },
  label: { size: 14, line: 20, weight: '500', face: 'ui' },
  caption: { size: 12, line: 16, weight: '400', face: 'ui' },
  kicker: { size: 11, line: 14, weight: '500', face: 'ui', tracking: 1.2, uppercase: true },
};

export const motion = { quick: 120, standard: 200, gentle: 320 } as const;

export const shadow = {
  card: {
    shadowColor: '#4A1532',
    shadowOpacity: 0.1,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 2,
  },
  raised: {
    shadowColor: '#4A1532',
    shadowOpacity: 0.16,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 14 },
    elevation: 6,
  },
} as const;
