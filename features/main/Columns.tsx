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
 * Two side-by-side columns on a wide web window; on a phone or narrow window the two lists simply follow each other,
 * exactly as before, so the phone layout does not change.
 */
export function Columns({ left, right }: { left: ReactNode; right: ReactNode }) {
  const theme = useTheme();
  const wide = useWide();
  if (!wide)
    return (
      <>
        {left}
        {right}
      </>
    );
  const column = { flex: 1, minWidth: 0, gap: theme.space[4] } as const;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: theme.space[4] }}>
      <View style={column}>{left}</View>
      <View style={column}>{right}</View>
    </View>
  );
}
