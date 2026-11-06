import { Platform, useWindowDimensions } from 'react-native';

/** Wide web (desktop browser): the main app shows the sidebar and chat beside the apps. Phones and narrow windows use one tab at a time. */
export const WIDE_BREAKPOINT = 900;

export function useWide(): boolean {
  const { width } = useWindowDimensions();
  return Platform.OS === 'web' && width >= WIDE_BREAKPOINT;
}
