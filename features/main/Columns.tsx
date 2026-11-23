import type { ReactNode } from 'react';
import { View } from 'react-native';
import { useTheme } from '@/ui';
import { useWide } from './useWide';

/** The widest a page gets on a wide web window, and the usual phone column. */
export const WIDE_PAGE = 1100;

/** Page width for `Screen`: the full wide-web width in a desktop browser, the phone column everywhere else. */
export function usePageWidth(): number {
  return useWide() ? WIDE_PAGE : 520;
}

/**
 * Two side-by-side columns on a wide web window; on a phone or narrow window the two lists simply follow each other.
 * `equalHeight` stretches both columns to the taller one (for a single card on each side).
 */
export function Columns({
  left,
  right,
  equalHeight = true,
}: {
  left: ReactNode;
  right: ReactNode;
  /** When true (default), both columns share the taller height. Turn off when a column has stacked content under its card. */
  equalHeight?: boolean;
}) {
  const theme = useTheme();
  const wide = useWide();
  if (!wide)
    return (
      <>
        {left}
        {right}
      </>
    );
  // flexBasis 0 so both sides get the same width regardless of content size.
  const column = {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
    minWidth: 0,
    gap: theme.space[4],
    ...(equalHeight ? { alignSelf: 'stretch' as const } : null),
  };
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: equalHeight ? 'stretch' : 'flex-start',
        gap: theme.space[5],
        width: '100%',
      }}
    >
      <View style={column}>{left}</View>
      <View style={column}>{right}</View>
    </View>
  );
}
