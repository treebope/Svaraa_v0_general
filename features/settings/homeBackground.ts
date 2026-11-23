import { Platform, type ViewStyle } from 'react-native';

/**
 * Home-app page backgrounds (Chat / Apps / Profile chrome).
 * Placeholder palettes — swap the colour pairs when real artwork lands.
 */
export type HomeBackgroundId = 'rose' | 'sand' | 'mist';

export const HOME_BACKGROUNDS: readonly HomeBackgroundId[] = ['rose', 'sand', 'mist'];

type Stops = { light: [string, string]; dark: [string, string] };

/** Soft rose, warm sand, cool mist — placeholders only. */
const STOPS: Record<HomeBackgroundId, Stops> = {
  rose: { light: ['#F3E4EB', '#F7EFE5'], dark: ['#251C21', '#1D1A1C'] },
  sand: { light: ['#F6E8DA', '#FBF4EC'], dark: ['#2A211C', '#1F1A17'] },
  mist: { light: ['#E5EBF4', '#F0F3F8'], dark: ['#1C222A', '#161A20'] },
};

export function homeBackgroundStops(id: HomeBackgroundId, scheme: 'light' | 'dark'): [string, string] {
  return STOPS[id][scheme];
}

/** Full-bleed page fill for the main app shell. */
export function homePageBackground(id: HomeBackgroundId, scheme: 'light' | 'dark'): ViewStyle {
  const [bg1, bg2] = homeBackgroundStops(id, scheme);
  return Platform.OS === 'web'
    ? ({ backgroundImage: `linear-gradient(172deg, ${bg1}, ${bg2} 72%)` } as ViewStyle)
    : { backgroundColor: bg2 };
}

/** Compact swatch for the Settings picker. */
export function homeBackgroundSwatch(id: HomeBackgroundId, scheme: 'light' | 'dark'): ViewStyle {
  const [bg1, bg2] = homeBackgroundStops(id, scheme);
  return Platform.OS === 'web'
    ? ({ backgroundImage: `linear-gradient(160deg, ${bg1}, ${bg2})` } as ViewStyle)
    : { backgroundColor: bg1 };
}
