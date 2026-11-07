import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ChatHistory } from '@/features/chat/ChatHistory';
import { useChat } from '@/features/chat/store';
import { Icon, useTheme } from '@/ui';
import { Avatar, IconButton, useMainPalette } from './palette';
import { useNewChat } from './useNewChat';
import { useInitial } from './TopBar';

/**
 * Web: chat history as a left sidebar (wireframe D pin 1). A slim rail (expand, new chat, chats, avatar) on Apps and
 * My Profile; open by default on Chat. The button at the top opens or closes it by hand; the next tab switch goes back
 * to that tab's default.
 */
export function WebSidebar() {
  const { t } = useTranslation();
  const router = useRouter();
  const path = usePathname();
  const p = useMainPalette();
  const initial = useInitial();
  const onChat = path.startsWith('/chat');
  const [manual, setManual] = useState<{ path: string; open: boolean } | undefined>();
  const open = manual && manual.path === path ? manual.open : onChat;
  const toggle = () => setManual({ path, open: !open });
  const newChat = useNewChat();

  return (
    <View
      style={{
        width: open ? 252 : 60,
        backgroundColor: `${p.card}8C`,
        borderRightWidth: 1,
        borderRightColor: p.line,
        paddingVertical: 10,
        paddingHorizontal: open ? 10 : 0,
        alignItems: open ? 'stretch' : 'center',
        gap: 6,
      }}
    >
      {open ? (
        <>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
            <IconButton icon="sidebar" label={t('main.collapse')} onPress={toggle} />
          </View>
          <ChatHistory
            chatsActive={path === '/chats'}
            onPick={(id) => {
              useChat.getState().open(id);
              router.navigate('/chat');
            }}
            onNew={newChat}
            onAll={() => router.navigate('/chats')}
            onUser={() => router.navigate('/profile')}
          />
        </>
      ) : (
        <>
          <IconButton icon="sidebar" label={t('main.expand')} onPress={toggle} />
          <RailPlus label={t('chat.new')} onPress={newChat} />
          <IconButton icon="chat" label={t('chat.all')} onPress={() => router.navigate('/chats')} />
          <View style={{ flex: 1 }} />
          <Avatar initial={initial} label={t('tabs.profile')} onPress={() => router.navigate('/profile')} />
        </>
      )}
    </View>
  );
}

/** "New chat" in the slim rail: the plum circle with a plus (wireframe `.plusc`). */
function RailPlus({ label, onPress }: { label: string; onPress: () => void }) {
  const theme = useTheme();
  const p = useMainPalette();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={{
        width: theme.minTarget,
        height: theme.minTarget,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <View
        style={{
          width: 26,
          height: 26,
          borderRadius: 13,
          backgroundColor: p.plum,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon name="plus" size={16} color={p.on} />
      </View>
    </Pressable>
  );
}
