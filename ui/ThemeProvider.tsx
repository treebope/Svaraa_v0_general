import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import { useSettings } from '@/features/settings/store';
import { createTheme, type Theme } from './theme';

const ThemeContext = createContext<Theme>(createTheme('caregiver', 'light'));

export function ThemeProvider({ children }: { children: ReactNode }) {
  const mode = useSettings((s) => s.themeMode);
  const preference = useSettings((s) => s.scheme);
  const displayScale = useSettings((s) => s.displayScale);
  const system = useColorScheme();
  const scheme = preference === 'system' ? (system === 'dark' ? 'dark' : 'light') : preference;
  const theme = useMemo(() => createTheme(mode, scheme, displayScale), [mode, scheme, displayScale]);
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  return useContext(ThemeContext);
}
