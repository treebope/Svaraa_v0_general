import { darkColors, lightColors, radius, space, typeScale, type ColorSet } from './tokens';

export type ThemeMode = 'caregiver' | 'wearer';
export type ColorScheme = 'light' | 'dark';

export type Theme = {
  mode: ThemeMode;
  scheme: ColorScheme;
  colors: ColorSet;
  space: typeof space;
  radius: typeof radius;
  /** Multiplies every font size and line height. Wearer = larger text. */
  fontScale: number;
  /** Smallest height of anything tappable, in dp. Same in both themes. */
  minTarget: number;
  /** Button heights by size. */
  buttonHeight: { sm: number; md: number; lg: number };
  typeScale: typeof typeScale;
};

/** Buttons and tap targets stay the same; only text (and Profile display scale) grows. */
const TARGETS = { minTarget: 44, buttonHeight: { sm: 36, md: 44, lg: 48 } } as const;
const CAREGIVER = { fontScale: 1, ...TARGETS } as const;
const WEARER = { fontScale: 1.1, ...TARGETS } as const;

/**
 * `displayScale` is the Profile UI level (1 / 2 / 3), mapped to 1 / 1.2 / 1.3 for fonts.
 * App tiles use the same factor via `displayScaleFactor`.
 */
export function createTheme(mode: ThemeMode, scheme: ColorScheme, displayScale: 1 | 2 | 3 = 1): Theme {
  const sizes = mode === 'wearer' ? WEARER : CAREGIVER;
  const factor = displayScale === 3 ? 1.3 : displayScale === 2 ? 1.2 : 1;
  return {
    mode,
    scheme,
    colors: scheme === 'dark' ? darkColors : lightColors,
    space,
    radius,
    typeScale,
    fontScale: sizes.fontScale * factor,
    minTarget: sizes.minTarget,
    buttonHeight: { ...sizes.buttonHeight },
  };
}
