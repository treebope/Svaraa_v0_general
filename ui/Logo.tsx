import { Image } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from './ThemeProvider';

const FILES = {
  light: require('../assets/brand/logo-light.png'),
  dark: require('../assets/brand/logo-dark.png'),
} as const;

/** Lotus mark with the svaraa wordmark. Picks the light or dark version from the theme. `height` is in dp. */
export function Logo({ height = 64 }: { height?: number }) {
  const theme = useTheme();
  const { t } = useTranslation();
  return (
    <Image
      source={FILES[theme.scheme]}
      accessibilityRole="image"
      accessibilityLabel={t('auth.welcome.logo')}
      resizeMode="contain"
      style={{ height, width: height * (1399 / 430) }}
    />
  );
}

const MARKS = {
  light: require('../assets/brand/mark-light.png'),
  dark: require('../assets/brand/mark-dark.png'),
} as const;

/** The lotus on its own, cropped from the brand logo (plum with a gold centre in light, gold in dark). `size` is in dp. */
export function LogoMark({ size = 26 }: { size?: number }) {
  const theme = useTheme();
  return (
    <Image
      source={MARKS[theme.scheme]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      resizeMode="contain"
      style={{ width: size, height: size }}
    />
  );
}
