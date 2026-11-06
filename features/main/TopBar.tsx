import type { ReactNode } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useChat } from '@/features/chat/store';
import { useGreetingName } from '@/features/home/useGreetingName';
import { usePendantStatus } from '@/features/pendant/store';
import { useWearer } from '@/features/wearer/store';
import { Logo, Text, useTheme } from '@/ui';
import { Avatar, DotPill, IconButton, NewChatButton, useMainPalette } from './palette';
import { useWide } from './useWide';

/** The letter in the round avatar: the wearer's name, otherwise the name from sign-in. */
export function useInitial(): string {
  const profile = useWearer((s) => s.profile);
  const name = useGreetingName();
  return ((profile?.call_as || profile?.name || name || 'S').trim()[0] ?? 'S').toUpperCase();
}

/** "Connected · 78%" with a green dot (wireframe `.a-pill`). */
export function StatusPill() {
  const { t } = useTranslation();
  const wide = useWide();
  const { connection, battery } = usePendantStatus();
  const connected = connection === 'connected';
  const label = connected
    ? battery !== undefined
      ? t('main.status.connectedBattery', { battery })
      : t('pendant.connected')
    : connection === 'connecting'
      ? t('wearerHome.connecting')
      : t('pendant.notConnected');
  // On a phone the bar is narrow: show just the battery, and keep the full words for screen readers.
  const short = !wide && connected && battery !== undefined ? `${battery}%` : undefined;
  return <DotPill label={label} short={short} good={connected} />;
}

function Bar({ children }: { children: ReactNode }) {
  const theme = useTheme();
  const p = useMainPalette();
  // On a phone, start below the status bar (clock, battery) and the notch.
  const insets = useSafeAreaInsets();
  return (
    <View
      style={{
        height: 58 + insets.top,
        paddingTop: insets.top,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: theme.space[3] + 2,
        borderBottomWidth: 1,
        borderBottomColor: p.line,
        backgroundColor: p.bg1,
      }}
    >
      {children}
    </View>
  );
}

/** The Svaraa logo, the same picture as on sign-in, setup and profile, on the left of the bar. */
function BrandLogo({ height }: { height: number }) {
  return (
    <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
      <Logo height={height} />
    </View>
  );
}

function useBarParts() {
  const { t } = useTranslation();
  const router = useRouter();
  const wide = useWide();
  const initial = useInitial();
  const newChat = () => {
    useChat.getState().newChat();
    router.navigate(wide ? '/apps' : '/chat');
  };
  return {
    t,
    newChat,
    search: <IconButton icon="search" label={t('chat.search')} onPress={() => router.navigate('/chats')} />,
    bell: <IconButton icon="bell" label={t('main.alerts')} onPress={() => router.push('/alerts')} />,
    avatar: (
      <Avatar initial={initial} label={t('tabs.profile')} onPress={() => router.navigate('/profile')} />
    ),
    wide,
  };
}

/** Web: logo, New chat, search, bell, status and avatar, once, above the sidebar and the page (wireframe D). */
export function WebHeader() {
  const { t, newChat, search, bell, avatar } = useBarParts();
  return (
    <Bar>
      <BrandLogo height={34} />
      <NewChatButton label={t('chat.new')} onPress={newChat} />
      {search}
      {bell}
      <StatusPill />
      {avatar}
    </Bar>
  );
}

/**
 * Phone top bars (wireframe D). Chat: menu, title, new chat. Apps: logo, search, bell, status, avatar.
 * My Profile: just the title. On the wide web the WebHeader does this job, so nothing is drawn here.
 */
export function MainTop({
  kind,
  title,
  onMenu,
}: {
  kind: 'chat' | 'apps' | 'profile';
  title?: string;
  onMenu?: () => void;
}) {
  const { t, newChat, search, bell, avatar, wide } = useBarParts();
  if (wide) return null;
  if (kind === 'chat')
    return (
      <Bar>
        <IconButton icon="menu" label={t('main.menu')} onPress={onMenu} />
        <Text
          variant="label"
          numberOfLines={1}
          accessibilityRole="header"
          style={{ flex: 1, textAlign: 'center', fontWeight: '600', fontSize: 15 }}
        >
          {title}
        </Text>
        <IconButton icon="compose" label={t('chat.new')} onPress={newChat} />
      </Bar>
    );
  if (kind === 'apps')
    return (
      <Bar>
        <BrandLogo height={30} />
        {search}
        {bell}
        <StatusPill />
        {avatar}
      </Bar>
    );
  return (
    <Bar>
      <BrandLogo height={30} />
      <Text
        variant="label"
        accessibilityRole="header"
        style={{ fontWeight: '600', fontSize: 15, marginRight: 8 }}
      >
        {title}
      </Text>
    </Bar>
  );
}
