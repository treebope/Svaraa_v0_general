import { Pressable, View } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, Text, type IconName } from '@/ui';
import { useMainPalette } from './palette';
import { useWide } from './useWide';

const TABS: { name: 'chat' | 'apps'; icon: IconName }[] = [
  { name: 'chat', icon: 'chat' },
  { name: 'apps', icon: 'apps' },
];

/**
 * Bottom nav (wireframe `.a-nav`): Chat and Apps, across the whole width under the sidebar and the page.
 * The phone shows an icon above each label; the web shows the words only. The chosen tab sits on a soft pill.
 * "Chats" (All chats) is a page of Chat, so it keeps Chat selected. My Profile is not in the nav: it opens from the
 * avatar (top bar, sidebar, drawer) and the My Profile tile in Apps, and then no tab is selected.
 */
export function MainNav() {
  const { t } = useTranslation();
  const p = useMainPalette();
  const wide = useWide();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const path = usePathname();
  const active = path.startsWith('/chat') ? 'chat' : path.startsWith('/profile') ? undefined : 'apps';
  return (
    <View
      accessibilityRole="tablist"
      style={{
        flexDirection: 'row',
        gap: 8,
        paddingHorizontal: 12,
        paddingTop: 8,
        paddingBottom: 8 + (wide ? 0 : insets.bottom),
        backgroundColor: p.card,
        borderTopWidth: 1,
        borderTopColor: p.line,
      }}
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
              borderRadius: 12,
              backgroundColor: on ? p.seg : 'transparent',
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
