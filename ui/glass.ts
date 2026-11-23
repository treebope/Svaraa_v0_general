import { Platform, type ViewStyle } from 'react-native';
import type { ColorScheme } from './theme';

export type GlassKind = 'panel' | 'chrome' | 'card' | 'tile';

const BLUR: Record<GlassKind, number> = {
  panel: 36,
  chrome: 28,
  card: 24,
  tile: 20,
};

/**
 * Frosted glass surface (visionOS-ish). Blur + soft edge highlight on web; translucent fill on native.
 * Fills should already be rgba so the page gradient shows through.
 */
export function glassStyle(opts: {
  scheme: ColorScheme;
  fill: string;
  border: string;
  kind?: GlassKind;
  radius?: number;
}): ViewStyle {
  const kind = opts.kind ?? 'card';
  const blur = BLUR[kind];
  const light = opts.scheme === 'light';
  const style: ViewStyle = {
    backgroundColor: opts.fill,
    borderWidth: 1,
    borderColor: opts.border,
    ...(opts.radius !== undefined ? { borderRadius: opts.radius } : null),
  };

  if (Platform.OS !== 'web') return style;

  const inset = light ? 'inset 0 1px 0 rgba(255,255,255,0.72)' : 'inset 0 1px 0 rgba(255,255,255,0.1)';
  const drop = light
    ? '0 18px 48px rgba(74,21,50,0.1), 0 2px 8px rgba(74,21,50,0.06)'
    : '0 18px 48px rgba(0,0,0,0.45), 0 2px 8px rgba(0,0,0,0.25)';

  return {
    ...style,
    // RN web accepts these CSS properties.
    ...({
      backdropFilter: `blur(${blur}px) saturate(1.45)`,
      WebkitBackdropFilter: `blur(${blur}px) saturate(1.45)`,
      boxShadow: `${drop}, ${inset}`,
      transitionProperty: 'transform, box-shadow, background-color, border-color',
      transitionDuration: '220ms',
      transitionTimingFunction: 'cubic-bezier(0.22, 1, 0.36, 1)',
    } as ViewStyle),
  };
}
