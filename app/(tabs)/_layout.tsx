import { View } from 'react-native';
import { Tabs } from 'expo-router';
import { VoiceOverlay } from '@/features/chat/VoiceView';
import { MainNav } from '@/features/main/MainTabBar';
import { WebHeader } from '@/features/main/TopBar';
import { WebSidebar } from '@/features/main/WebSidebar';
import { useWide } from '@/features/main/useWide';
import { useReconnect } from '@/features/pendant/store';
import { homePageBackground } from '@/features/settings/homeBackground';
import { useSettings } from '@/features/settings/store';
import { useWearer } from '@/features/wearer/store';
import { useTheme } from '@/ui';

/** The main app opens on Apps. */
export const unstable_settings = { anchor: 'apps' };

/**
 * The main app (wireframe D): Chat, Apps, My Profile. Alerts are the bell in the top bar. "Chats" is a page of Chat
 * that keeps the sidebar. On a wide web window the header runs across the top and the chat history is a sidebar.
 */
export default function TabsLayout() {
  const theme = useTheme();
  const homeBackground = useSettings((s) => s.homeBackground);
  const wide = useWide();
  const pendantId = useWearer((s) => s.pendantId);
  useReconnect(pendantId);
  const bg = homePageBackground(homeBackground, theme.scheme);
  const tabs = (
    <Tabs
      tabBar={() => null}
      backBehavior="initialRoute"
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: 'transparent' } }}
    >
      <Tabs.Screen name="chat" />
      <Tabs.Screen name="apps" />
      <Tabs.Screen name="profile" />
      <Tabs.Screen name="chats" />
    </Tabs>
  );
  return wide ? (
    <View style={{ flex: 1, ...bg }}>
      <WebHeader />
      <View style={{ flex: 1, flexDirection: 'row', minHeight: 0 }}>
        <WebSidebar />
        <View style={{ flex: 1, minWidth: 0 }}>{tabs}</View>
      </View>
      <MainNav />
    </View>
  ) : (
    <View style={{ flex: 1, ...bg }}>
      <View style={{ flex: 1 }}>{tabs}</View>
      <MainNav />
      <VoiceOverlay where="screen" />
    </View>
  );
}
