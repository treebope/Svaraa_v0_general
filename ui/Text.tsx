import { Text as RNText, type TextProps as RNTextProps } from 'react-native';
import { useTranslation } from 'react-i18next';
import { fontFamily, scriptLineFactor } from './fonts';
import { useTheme } from './ThemeProvider';
import type { TypeVariant } from './tokens';

export type TextTone =
  'primary' | 'secondary' | 'tertiary' | 'heading' | 'accent' | 'spirit' | 'onAction' | 'safety';

export type TextProps = RNTextProps & {
  variant?: TypeVariant;
  tone?: TextTone;
  italic?: boolean;
};

/** All text goes through this component so size, font and Hindi glyphs follow the theme and language. */
export function Text({ variant = 'body', tone = 'primary', italic, style, ...rest }: TextProps) {
  const theme = useTheme();
  const { i18n } = useTranslation();
  const t = theme.typeScale[variant];
  const c = theme.colors;
  const color = {
    primary: c.textPrimary,
    secondary: c.textSecondary,
    tertiary: c.textTertiary,
    heading: c.heading,
    accent: c.accentItalic,
    spirit: c.accentSpirit,
    onAction: c.onAction,
    safety: c.safety,
  }[tone];
  const lang = i18n.language;
  const nonLatin = lang !== 'en';
  return (
    <RNText
      {...rest}
      style={[
        {
          color,
          fontFamily: fontFamily(lang, t, italic),
          fontSize: t.size * theme.fontScale,
          lineHeight: t.line * theme.fontScale * scriptLineFactor(lang),
          letterSpacing: nonLatin ? 0 : t.tracking,
          textTransform: t.uppercase && !nonLatin ? 'uppercase' : undefined,
        },
        style,
      ]}
    />
  );
}
