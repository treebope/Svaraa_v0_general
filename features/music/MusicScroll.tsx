import type { ReactNode } from 'react';
import { ScrollView, View, type ViewStyle } from 'react-native';
import { useMainPalette } from '@/features/main/palette';
import { useTheme } from '@/ui';

/** Shared Music-tab section height so Songs / Spotify / YouTube sit in the same band. */
export const MUSIC_SECTION_HEIGHT = 420;

/**
 * Bounded pane under the Songs / Spotify / YouTube tabs.
 * Content scrolls inside; the outer Apps page can still scroll around it.
 */
export function MusicScroll({
  children,
  maxHeight = MUSIC_SECTION_HEIGHT,
  framed = true,
  contentContainerStyle,
  style,
}: {
  children: ReactNode;
  maxHeight?: number;
  /** Soft border + tile fill (turn off when the child paints its own surface). */
  framed?: boolean;
  contentContainerStyle?: ViewStyle;
  style?: ViewStyle;
}) {
  const theme = useTheme();
  const p = useMainPalette();
  return (
    <View
      style={[
        {
          height: maxHeight,
          borderRadius: 16,
          overflow: 'hidden',
          ...(framed
            ? {
                borderWidth: 1,
                borderColor: p.line2,
                backgroundColor: p.tile,
              }
            : null),
        },
        style,
      ]}
    >
      <ScrollView
        nestedScrollEnabled
        showsVerticalScrollIndicator
        style={{ flex: 1 }}
        contentContainerStyle={[
          {
            gap: theme.space[2],
            padding: framed ? 8 : 0,
            flexGrow: 1,
          },
          contentContainerStyle,
        ]}
      >
        {children}
      </ScrollView>
    </View>
  );
}
