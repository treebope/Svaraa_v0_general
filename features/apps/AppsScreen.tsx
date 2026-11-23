import { Scene } from '@/features/main/Scene';
import { useEffect, useState } from 'react';
import { Platform, Pressable, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ChatView } from '@/features/chat/ChatView';
import { useChat } from '@/features/chat/store';
import { IconButton, useMainPalette } from '@/features/main/palette';
import { MainTop } from '@/features/main/TopBar';
import { useWide } from '@/features/main/useWide';
import { ProfileView } from '@/features/profile/ProfileView';
import { displayScaleFactor } from '@/features/settings/displayScale';
import { useSettings } from '@/features/settings/store';
import { glassStyle, Icon, Text, useTheme, type IconName } from '@/ui';
import { useManageApps } from '@/features/manage/store';
import { APP_IDS, AppView } from './AppViews';
import { useOpenApp, type OpenableApp } from './openApp';

export const APP_ICON: Record<OpenableApp, IconName> = {
  music: 'music',
  reminders: 'remind',
  notes: 'note',
  responses: 'resp',
  news: 'news',
  games: 'game',
  pendant: 'pendant',
  contacts: 'contacts',
  profile: 'user',
};
const MIN_SPLIT = 1 / 3;
const MAX_SPLIT = 2 / 3;

/** The app tiles, or one app open in this area with a back button (wireframe D pins 10 and 9). */
function AppsPane({
  open,
  setOpen,
  phone,
}: {
  open: OpenableApp | undefined;
  setOpen: (a: OpenableApp | undefined) => void;
  phone: boolean;
}) {
  const theme = useTheme();
  const { t } = useTranslation();
  const p = useMainPalette();
  const displayScale = useSettings((s) => s.displayScale);
  const zoom = displayScaleFactor(displayScale);
  const enabled = useManageApps((s) => s.enabled);
  useEffect(() => void useManageApps.getState().load(), []);
  // Manage apps (F7): an app turned off there is not shown on Explore.
  const shown = APP_IDS.filter((id) => !(id in enabled) || enabled[id as keyof typeof enabled]);
  const tileSide = (phone ? 72 : 78) * zoom;
  const cellWidth = phone ? (displayScale >= 3 ? '50%' : '33.33%') : 112 * zoom;
  const tile = (id: OpenableApp) => (
    <Pressable
      key={id}
      accessibilityRole="button"
      accessibilityLabel={t(`apps.name.${id}`)}
      onPress={() => setOpen(id)}
      style={{ width: cellWidth, alignItems: 'center', gap: 11, padding: 4 }}
    >
      {({ pressed }) => (
        <>
          <View
            style={[
              glassStyle({
                scheme: theme.scheme,
                fill: p.tile,
                border: p.line,
                kind: 'tile',
                radius: (phone ? 22 : 24) * zoom,
              }),
              {
                width: tileSide,
                height: tileSide,
                alignItems: 'center',
                justifyContent: 'center',
                transform: [{ translateY: pressed ? -3 : 0 }, { scale: pressed ? 0.97 : 1 }],
                ...(Platform.OS === 'web'
                  ? ({ backgroundImage: `linear-gradient(165deg, ${p.tile2}, ${p.tile})` } as object)
                  : null),
              },
            ]}
          >
            <Icon name={APP_ICON[id]} size={28 * zoom} color={p.plum} />
          </View>
          <Text variant="label" style={{ color: p.ink, fontWeight: '600', textAlign: 'center' }}>
            {t(`apps.name.${id}`)}
          </Text>
        </>
      )}
    </Pressable>
  );
  return (
    <ScrollView
      contentContainerStyle={{
        paddingTop: phone ? 22 : 12,
        paddingHorizontal: phone ? 14 : 20,
        paddingBottom: 90,
        gap: theme.space[3],
        flexGrow: 1,
      }}
    >
      {open ? (
        <>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <IconButton icon="back" label={t('apps.back')} onPress={() => setOpen(undefined)} />
            <View
              style={[
                glassStyle({
                  scheme: theme.scheme,
                  fill: p.tile,
                  border: p.line,
                  kind: 'tile',
                  radius: 14,
                }),
                { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
              ]}
            >
              <Icon name={APP_ICON[open]} size={22} color={p.plum} />
            </View>
            <Text variant="title2" style={{ color: p.ink }} accessibilityRole="header">
              {t(`apps.name.${open}`)}
            </Text>
          </View>
          {open === 'profile' ? <ProfileView /> : <AppView id={open} />}
        </>
      ) : (
        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            rowGap: phone ? 24 : 26,
            columnGap: phone ? 0 : 10,
          }}
        >
          {[...shown, 'profile' as const].map(tile)}
        </View>
      )}
    </ScrollView>
  );
}

/**
 * Web: the chat pane beside the apps, one third wide, draggable out to two thirds (pins 5 to 7). The header has the
 * chat title and two icon buttons: widen (or narrow) and open full.
 */
function ChatPane({ split, onSplit }: { split: number; onSplit: (n: number) => void }) {
  const { t } = useTranslation();
  const router = useRouter();
  const theme = useTheme();
  const p = useMainPalette();
  const wide = split > 0.5;
  const title =
    useChat((s) => s.conversations.find((c) => c.id === s.currentId)?.title) ?? t('chat.newTitle');
  return (
    <View
      style={[
        glassStyle({
          scheme: theme.scheme,
          fill: p.card,
          border: p.line,
          kind: 'panel',
          radius: 28,
        }),
        { flex: 1, minHeight: 0, overflow: 'hidden' },
      ]}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 2,
          paddingTop: 10,
          paddingRight: 10,
          paddingLeft: 16,
        }}
      >
        <Text numberOfLines={1} style={{ flex: 1, color: p.muted, fontSize: 13 }}>
          {title}
        </Text>
        <IconButton
          icon={wide ? 'narrow' : 'widen'}
          iconSize={19}
          size={34}
          label={wide ? t('main.narrow') : t('main.widen')}
          onPress={() => onSplit(wide ? MIN_SPLIT : MAX_SPLIT)}
        />
        <IconButton
          icon="full"
          iconSize={19}
          size={34}
          label={t('main.openFull')}
          onPress={() => router.navigate('/chat')}
        />
      </View>
      <ChatView />
    </View>
  );
}

/**
 * Drag handle between the chat and the apps (pin 6): a thin line with a grip. The chat stays between one and two
 * thirds of the width. Web only (the split exists only on wide web), so it listens to pointer events on the window.
 */
function Divider({ split, width, onSplit }: { split: number; width: number; onSplit: (n: number) => void }) {
  const { t } = useTranslation();
  const p = useMainPalette();
  const [active, setActive] = useState(false);
  const begin = (e: { nativeEvent: { clientX?: number; pageX?: number } }) => {
    const startX = e.nativeEvent.clientX ?? e.nativeEvent.pageX ?? 0;
    const startSplit = split;
    const win = globalThis as unknown as {
      addEventListener: (n: string, f: (ev: { clientX: number }) => void) => void;
      removeEventListener: (n: string, f: (ev: { clientX: number }) => void) => void;
    };
    const move = (ev: { clientX: number }) =>
      onSplit(Math.min(MAX_SPLIT, Math.max(MIN_SPLIT, startSplit + (ev.clientX - startX) / (width || 1))));
    const end = () => {
      win.removeEventListener('pointermove', move);
      win.removeEventListener('pointerup', end);
      setActive(false);
    };
    setActive(true);
    win.addEventListener('pointermove', move);
    win.addEventListener('pointerup', end);
  };
  return (
    <View
      onPointerDown={begin}
      accessibilityRole="adjustable"
      accessibilityLabel={t('main.divider')}
      style={
        {
          width: 22,
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'col-resize',
          touchAction: 'none',
          userSelect: 'none',
        } as object
      }
    >
      <View
        style={{
          position: 'absolute',
          top: 10,
          bottom: 10,
          width: active ? 2 : 1,
          backgroundColor: active ? p.plum : p.line2,
        }}
      />
      <View
        style={{
          width: 4,
          height: active ? 64 : 44,
          borderRadius: 4,
          backgroundColor: active ? p.plum : p.line2,
        }}
      />
    </View>
  );
}

export default function AppsScreen() {
  const { t } = useTranslation();
  const wideWeb = useWide();
  const open = useOpenApp((s) => s.open);
  const setOpen = useOpenApp((s) => s.setOpen);
  const [split, setSplit] = useState(MIN_SPLIT);
  const [width, setWidth] = useState(0);

  return (
    <Scene>
      <MainTop kind="apps" title={t('tabs.apps')} />
      {wideWeb ? (
        // Chat + Apps stay side by side (same as Music / My Profile). Games size to the Apps pane.
        <View
          style={{ flex: 1, flexDirection: 'row', minHeight: 0, paddingVertical: 16, paddingLeft: 16 }}
          onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
        >
          <View style={{ flex: split, minWidth: 0 }}>
            <ChatPane split={split} onSplit={setSplit} />
          </View>
          <Divider split={split} width={width} onSplit={setSplit} />
          <View style={{ flex: 1 - split, minWidth: 0 }}>
            <AppsPane open={open} setOpen={setOpen} phone={false} />
          </View>
        </View>
      ) : (
        <AppsPane open={open} setOpen={setOpen} phone />
      )}
    </Scene>
  );
}
