import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSettings, type SchemePreference } from '@/features/settings/store';
import { Text } from './Text';
import { useTheme } from './ThemeProvider';

/**
 * Light / Dark switch for the welcome chrome and other pre-auth surfaces.
 * Sets an explicit preference (not system) so the choice is visible immediately.
 */
export function SchemeSwitch() {
  const theme = useTheme();
  const { t } = useTranslation();
  const setScheme = useSettings((s) => s.setScheme);
  const c = theme.colors;
  const options: { id: Exclude<SchemePreference, 'system'>; label: string }[] = [
    { id: 'light', label: t('demo.theme.light') },
    { id: 'dark', label: t('demo.theme.dark') },
  ];
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={t('auth.welcome.scheme')}
      style={{
        flexDirection: 'row',
        alignSelf: 'flex-start',
        padding: 3,
        borderRadius: theme.radius.full,
        backgroundColor: c.sunken,
      }}
    >
      {options.map((o) => {
        const selected = theme.scheme === o.id;
        return (
          <Pressable
            key={o.id}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            onPress={() => setScheme(o.id)}
            style={{
              minHeight: theme.minTarget - 6,
              paddingHorizontal: theme.space[4],
              justifyContent: 'center',
              borderRadius: theme.radius.full,
              backgroundColor: selected ? c.action : 'transparent',
            }}
          >
            <Text variant="label" style={{ color: selected ? c.onAction : c.textSecondary }}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
