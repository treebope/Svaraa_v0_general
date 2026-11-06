import { Scene } from '@/features/main/Scene';
import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { KeyboardAvoidingView, Platform, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ChatView } from '@/features/chat/ChatView';
import { useChat } from '@/features/chat/store';
import { ChatDrawer } from '@/features/main/ChatDrawer';
import { MainTop } from '@/features/main/TopBar';
import { useWide } from '@/features/main/useWide';
import { Text } from '@/ui';
import { useMainPalette } from '@/features/main/palette';

/**
 * D · Chat tab. Phone: menu, title and new chat on top; the menu opens the history drawer.
 * Web: the chat fills the page next to the sidebar, with its title above and a centred column.
 */
export default function Chat() {
  const { t } = useTranslation();
  const wide = useWide();
  const p = useMainPalette();
  const [drawer, setDrawer] = useState(false);
  // Leaving the tab closes the drawer, so coming back always starts with the menu button working.
  useFocusEffect(useCallback(() => () => setDrawer(false), []));
  const title =
    useChat((s) => s.conversations.find((c) => c.id === s.currentId)?.title) ?? t('chat.emptyTitle');
  return (
    <Scene>
      <MainTop kind="chat" title={title} onMenu={() => setDrawer(true)} />
      {wide ? (
        <View
          style={{
            width: '100%',
            maxWidth: 780,
            alignSelf: 'center',
            paddingHorizontal: 14,
            paddingVertical: 12,
          }}
        >
          <Text
            numberOfLines={1}
            accessibilityRole="header"
            style={{ fontWeight: '600', fontSize: 15, color: p.ink }}
          >
            {title}
          </Text>
        </View>
      ) : null}
      {/* The composer stays above the keyboard on iPhone. */}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ChatView compact={!wide} centered={wide} />
      </KeyboardAvoidingView>
      {wide ? null : <ChatDrawer open={drawer} onClose={() => setDrawer(false)} />}
    </Scene>
  );
}
