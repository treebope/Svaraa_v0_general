import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  HOME_BACKGROUNDS,
  homeBackgroundSwatch,
  type HomeBackgroundId,
} from '@/features/settings/homeBackground';
import { useSettings } from '@/features/settings/store';
import { Text, useTheme } from '@/ui';

/** Three placeholder home backgrounds; real art can replace the colour pairs later. */
export function HomeBackgroundPicker() {
  const theme = useTheme();
  const { t } = useTranslation();
  const { homeBackground, setHomeBackground } = useSettings();
  const p = theme.colors;

  return (
    <View style={{ gap: theme.space[2] }}>
      <Text variant="label" tone="secondary">
        {t('profile.background')}
      </Text>
      <View style={{ flexDirection: 'row', gap: theme.space[2] }}>
        {HOME_BACKGROUNDS.map((id) => {
          const on = homeBackground === id;
          return (
            <Pressable
              key={id}
              accessibilityRole="radio"
              accessibilityLabel={t(`profile.backgroundOptions.${id}`)}
              accessibilityState={{ selected: on }}
              onPress={() => setHomeBackground(id as HomeBackgroundId)}
              style={({ pressed }) => ({
                flex: 1,
                minHeight: 64,
                borderRadius: theme.radius.lg,
                borderWidth: 2,
                borderColor: on ? p.action : p.borderSubtle,
                overflow: 'hidden',
                opacity: pressed ? 0.9 : 1,
                ...homeBackgroundSwatch(id, theme.scheme),
              })}
            >
              <View
                style={{
                  flex: 1,
                  justifyContent: 'flex-end',
                  padding: theme.space[2],
                  backgroundColor: on ? 'rgba(0,0,0,0.06)' : 'transparent',
                }}
              >
                <Text variant="caption" tone="heading" style={{ fontWeight: '600' }}>
                  {t(`profile.backgroundOptions.${id}`)}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>
      <Text variant="caption" tone="secondary">
        {t('profile.backgroundHint')}
      </Text>
    </View>
  );
}
