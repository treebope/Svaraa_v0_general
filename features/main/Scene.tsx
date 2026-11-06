import type { ReactNode } from 'react';
import { View } from 'react-native';
import { useIsFocused } from 'expo-router';

/**
 * Root of a tab screen. The tab navigator keeps every visited tab mounted and, on the web, leaves the ones you are
 * not on visible underneath. This hides them, so only the open tab is drawn (and only its text box can be typed in).
 */
export function Scene({ children }: { children: ReactNode }) {
  const focused = useIsFocused();
  return <View style={{ flex: 1, display: focused ? 'flex' : 'none' }}>{children}</View>;
}
