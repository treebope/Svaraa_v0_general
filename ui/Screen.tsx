import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from './ThemeProvider';

/**
 * Page frame: safe areas, scrolling, standard padding, and a readable width on wide screens.
 * `footer` stays pinned at the bottom (primary buttons).
 */
export function Screen({
  children,
  footer,
  bottomInset = true,
  transparent = false,
}: {
  children: ReactNode;
  footer?: ReactNode;
  /** Set false when a tab bar already covers the bottom edge. */
  bottomInset?: boolean;
  /** Let the parent's background show through (the main app's soft gradient). */
  transparent?: boolean;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: transparent ? 'transparent' : theme.colors.canvas }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          flexGrow: 1,
          padding: theme.space[4] + theme.space[1],
          paddingTop: theme.space[4] + insets.top,
          paddingBottom: theme.space[4] + (footer || !bottomInset ? 0 : insets.bottom),
          gap: theme.space[4],
          maxWidth: 520,
          width: '100%',
          alignSelf: 'center',
        }}
      >
        {children}
      </ScrollView>
      {footer ? (
        <View
          style={{
            paddingHorizontal: theme.space[4] + theme.space[1],
            paddingTop: theme.space[3],
            paddingBottom: theme.space[4] + (bottomInset ? insets.bottom : 0),
            gap: theme.space[2],
            maxWidth: 520,
            width: '100%',
            alignSelf: 'center',
          }}
        >
          {footer}
        </View>
      ) : null}
    </KeyboardAvoidingView>
  );
}
