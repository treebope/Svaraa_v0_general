import { useMemo, useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useGreetingName } from '@/features/home/useGreetingName';
import { Avatar, useMainPalette } from '@/features/main/palette';
import { useInitial } from '@/features/main/TopBar';
import { useWearer } from '@/features/wearer/store';
import { Icon, Text, fontFamily, useTheme } from '@/ui';
import { groupOf, timeAgo, useChat, type Group } from './store';

const ORDER: Group[] = ['today', 'yesterday', 'week', 'older'];

/** "2 hours ago", from the translations. */
export function useTimeAgo() {
  const { t } = useTranslation();
  return (at: number) => {
    const a = timeAgo(at);
    return a.unit === 'justNow' ? t('chat.time.justNow') : t(`chat.time.${a.unit}`, { count: a.count });
  };
}

/**
 * Chats, newest first (wireframe `.hist`). In the sidebar and drawer they are grouped under "Recents";
 * on the All chats page each shows when its last message was.
 */
export function ChatList({
  onPick,
  showTime,
  query,
}: {
  onPick: (id: string) => void;
  showTime?: boolean;
  query: string;
}) {
  const theme = useTheme();
  const { t } = useTranslation();
  const p = useMainPalette();
  const { conversations, currentId } = useChat();
  const ago = useTimeAgo();
  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = conversations
      .filter((x) => !q || x.title.toLowerCase().includes(q))
      .sort((a, b) => b.updatedAt - a.updatedAt);
    return ORDER.map((g) => ({ g, items: list.filter((x) => groupOf(x.updatedAt) === g) })).filter(
      (x) => x.items.length,
    );
  }, [conversations, query]);

  if (!groups.length)
    return (
      <Text variant="bodySm" style={{ padding: 10, color: p.muted }}>
        {t('chat.noMatches')}
      </Text>
    );

  return (
    <View style={{ gap: theme.space[2] }}>
      {groups.map(({ g, items }) => (
        <View key={g} style={{ gap: 2 }}>
          {showTime ? null : (
            <Text
              variant="caption"
              style={{ marginHorizontal: 10, marginTop: 8, color: p.muted, fontWeight: '600' }}
            >
              {t(`chat.group.${g}`)}
            </Text>
          )}
          {items.map((x) => {
            const current = x.id === currentId;
            return (
              <Pressable
                key={x.id}
                accessibilityRole="button"
                accessibilityState={{ selected: current }}
                onPress={() => onPick(x.id)}
                style={({ pressed }) => ({
                  minHeight: theme.minTarget,
                  justifyContent: 'center',
                  borderRadius: 10,
                  paddingHorizontal: 10,
                  paddingVertical: 8,
                  backgroundColor: current || pressed ? p.seg : 'transparent',
                })}
              >
                <Text
                  numberOfLines={1}
                  style={{ color: p.ink, fontSize: 14, fontWeight: current ? '600' : '400' }}
                >
                  {x.title}
                </Text>
                {showTime ? (
                  <Text variant="caption" style={{ color: p.muted }}>
                    {t('chat.lastMessage', { time: ago(x.updatedAt) })}
                  </Text>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

/** Search field with a magnifier (wireframe `.sb-search`). */
export function SearchBox({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  label?: string;
}) {
  const theme = useTheme();
  const { t, i18n } = useTranslation();
  const p = useMainPalette();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        minHeight: theme.minTarget,
        borderWidth: 1,
        borderColor: p.line2,
        borderRadius: 11,
        paddingHorizontal: 10,
        backgroundColor: p.card,
      }}
    >
      <Icon name="search" size={17} color={p.muted} />
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={label ?? t('chat.search')}
        placeholderTextColor={p.muted}
        accessibilityLabel={label ?? t('chat.search')}
        style={
          {
            flex: 1,
            minWidth: 0,
            paddingVertical: 8,
            color: p.ink,
            fontFamily: fontFamily(i18n.language, theme.typeScale.body),
            fontSize: 14 * theme.fontScale,
            outlineStyle: 'none',
          } as object
        }
      />
    </View>
  );
}

/** A row in the sidebar or drawer (wireframe `.rowbtn`): an icon and a label. */
export function SidebarRow({
  label,
  onPress,
  active,
  plus,
  icon,
}: {
  label: string;
  onPress: () => void;
  active?: boolean;
  /** The plum circle with a plus, for "New chat". */
  plus?: boolean;
  icon?: 'chat';
}) {
  const theme = useTheme();
  const p = useMainPalette();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        minHeight: theme.minTarget,
        paddingHorizontal: 10,
        borderRadius: 11,
        backgroundColor: active || pressed ? p.seg : 'transparent',
      })}
    >
      {plus ? (
        <View
          style={{
            width: 26,
            height: 26,
            borderRadius: 13,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: p.plum,
          }}
        >
          <Icon name="plus" size={16} color={p.on} />
        </View>
      ) : (
        <Icon name={icon ?? 'chat'} size={19} color={p.plum} />
      )}
      <Text style={{ color: p.ink, fontWeight: '500', fontSize: 14.5 }}>{label}</Text>
    </Pressable>
  );
}

/** The person at the bottom of the sidebar: avatar, name and role (wireframe `.sb-user`). */
export function SidebarUser({ onPress }: { onPress: () => void }) {
  const { t } = useTranslation();
  const p = useMainPalette();
  const initial = useInitial();
  const profile = useWearer((s) => s.profile);
  const greeting = useGreetingName();
  const name = profile?.name || greeting || t('main.account');
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('tabs.profile')}
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingTop: 10,
        paddingHorizontal: 6,
        marginTop: 6,
        borderTopWidth: 1,
        borderTopColor: p.line,
      }}
    >
      <Avatar initial={initial} label={t('tabs.profile')} />
      <View>
        <Text style={{ color: p.ink, fontWeight: '500', fontSize: 14.5 }}>{name}</Text>
        <Text variant="caption" style={{ color: p.muted }}>
          {t('main.wearerOwner')}
        </Text>
      </View>
    </Pressable>
  );
}

/**
 * Sidebar / drawer body: optional search, New chat, Chats, Recents and the person (wireframe D).
 * The phone drawer has the search field; the web sidebar has the search icon in the header instead.
 */
export function ChatHistory({
  onPick,
  onAll,
  onNew,
  onUser,
  search,
  chatsActive,
}: {
  onPick: (id: string) => void;
  onAll: () => void;
  onNew: () => void;
  onUser: () => void;
  search?: boolean;
  chatsActive?: boolean;
}) {
  const { t } = useTranslation();
  const p = useMainPalette();
  const [q, setQ] = useState('');
  return (
    <View style={{ flex: 1, minHeight: 0, gap: 4 }}>
      {search ? <SearchBox value={q} onChange={setQ} label={t('chat.search')} /> : null}
      <SidebarRow label={t('chat.new')} plus onPress={onNew} />
      <SidebarRow label={t('chat.all')} active={chatsActive} onPress={onAll} />
      <Text
        variant="caption"
        style={{ marginHorizontal: 10, marginTop: 14, marginBottom: 2, color: p.muted, fontWeight: '600' }}
      >
        {t('chat.recents')}
      </Text>
      <ScrollView keyboardShouldPersistTaps="handled" style={{ flex: 1 }}>
        <ChatList query={q} onPick={onPick} />
      </ScrollView>
      <SidebarUser onPress={onUser} />
    </View>
  );
}
