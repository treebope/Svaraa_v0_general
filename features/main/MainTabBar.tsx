import { Platform, Pressable, View } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { glassStyle, Icon, Text, useTheme, type IconName } from '@/ui';
import { useMainPalette } from './palette';
import { useWide } from './useWide';

const TABS: { name: 'chat' | 'apps'; icon: IconName }[] = [
  { name: 'chat', icon: 'chat' },
  { name: 'apps', icon: 'apps' },
];

/**
 * Bottom nav (wireframe `.a-nav`): Chat and Apps, across the whole width under the sidebar and the page.
 * The phone shows an icon above each label; the web shows the words only. The chosen tab sits on a soft pill.
 * "Chats" (All chats) is a page of Chat, so it keeps Chat selected. My Profile opens inside Apps (same pane as Music).
 */
export function MainNav() {
  const { t } = useTranslation();
  const theme = useTheme();
  const p = useMainPalette();
  const wide = useWide();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const path = usePathname();
  const active = path.startsWith('/chat') ? 'chat' : 'apps';
  const floating = Platform.OS === 'web' && wide;
  return (
    <View
      accessibilityRole="tablist"
      style={[
        glassStyle({
          scheme: theme.scheme,
          fill: p.card,
          border: p.line,
          kind: 'chrome',
          radius: floating ? 22 : 0,
        }),
        {
          flexDirection: 'row',
          gap: 8,
          paddingHorizontal: 12,
          paddingTop: 8,
          paddingBottom: 8 + (wide ? 0 : insets.bottom),
          ...(floating
            ? { marginHorizontal: 20, marginBottom: 14, borderTopWidth: 0 }
            : { borderTopWidth: 0, borderLeftWidth: 0, borderRightWidth: 0, borderRadius: 0 }),
        },
      ]}
    >
      {TABS.map((tab) => {
        const on = active === tab.name;
        return (
          <Pressable
            key={tab.name}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={t(`tabs.${tab.name}`)}
            onPress={() => router.navigate(`/${tab.name}`)}
            style={{
              flex: 1,
              minHeight: 46,
              alignItems: 'center',
              justifyContent: 'center',
              gap: 2,
              borderRadius: 14,
              backgroundColor: on ? p.seg : 'transparent',
              ...(Platform.OS === 'web' && on
                ? ({
                    backdropFilter: 'blur(12px)',
                    WebkitBackdropFilter: 'blur(12px)',
                    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.35)',
                  } as object)
                : null),
            }}
          >
            {wide ? null : <Icon name={tab.icon} size={21} color={on ? p.ink : p.muted} />}
            <Text
              style={{
                color: on ? p.ink : p.muted,
                fontWeight: on ? '600' : '500',
                fontSize: wide ? 15 : 12,
              }}
            >
              {t(`tabs.${tab.name}`)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
