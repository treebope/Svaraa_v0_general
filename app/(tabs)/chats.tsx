import { Scene } from '@/features/main/Scene';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { SearchBox, useTimeAgo } from '@/features/chat/ChatHistory';
import { useChat } from '@/features/chat/store';
import { useNewChat } from '@/features/main/useNewChat';
import { MainTop } from '@/features/main/TopBar';
import { useMainPalette } from '@/features/main/palette';
import { Text, useTheme } from '@/ui';

/** D · All chats: "Your chats", a search field, the count, and each chat with when its last message was. */
export default function AllChats() {
  const theme = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const newChat = useNewChat();
  const p = useMainPalette();
  const ago = useTimeAgo();
  const [q, setQ] = useState('');
  const conversations = useChat((s) => s.conversations);
  const list = conversations
    .filter((c) => !q.trim() || c.title.toLowerCase().includes(q.trim().toLowerCase()))
    .sort((a, b) => b.updatedAt - a.updatedAt);
  return (
    <Scene>
      <MainTop kind="chat" title={t('chat.all')} onMenu={() => router.back()} />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: 16, gap: 12, maxWidth: 720, width: '100%', alignSelf: 'center' }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text variant="title2" style={{ color: p.plum }} accessibilityRole="header">
            {t('chat.yourChats')}
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={newChat}
            style={{
              minHeight: 40,
              justifyContent: 'center',
              borderRadius: 999,
              paddingHorizontal: 14,
              backgroundColor: p.plum,
            }}
          >
            <Text variant="label" style={{ color: p.on, fontWeight: '600' }}>
              ＋ {t('chat.new')}
            </Text>
          </Pressable>
        </View>
        <SearchBox value={q} onChange={setQ} label={t('chat.searchYours')} />
        <Text variant="bodySm" style={{ color: p.muted, marginHorizontal: 4 }}>
          {t('chat.count', { count: list.length })}
        </Text>
        {list.length ? (
          <View style={{ gap: 2 }}>
            {list.map((c) => (
              <Pressable
                key={c.id}
                accessibilityRole="button"
                onPress={() => {
                  useChat.getState().open(c.id);
                  router.navigate('/chat');
                }}
                style={({ pressed }) => ({
                  minHeight: theme.minTarget,
                  justifyContent: 'center',
                  borderRadius: 12,
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  backgroundColor: pressed ? p.seg : 'transparent',
                  borderBottomWidth: 1,
                  borderBottomColor: p.line,
                })}
              >
                <Text style={{ color: p.ink }}>{c.title}</Text>
                <Text variant="caption" style={{ color: p.muted }}>
                  {t('chat.lastMessage', { time: ago(c.updatedAt) })}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : (
          <Text style={{ color: p.muted, padding: 12 }}>{t('chat.noMatchesFor', { q })}</Text>
        )}
      </ScrollView>
    </Scene>
  );
}
