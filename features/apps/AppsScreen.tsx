import { Scene } from '@/features/main/Scene';
import { useState } from 'react';
import { Platform, Pressable, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ChatView } from '@/features/chat/ChatView';
import { useChat } from '@/features/chat/store';
import { IconButton, useMainPalette } from '@/features/main/palette';
import { MainTop } from '@/features/main/TopBar';
import { useWide } from '@/features/main/useWide';
import { Icon, Text, useTheme, type IconName } from '@/ui';
import { APP_IDS, AppView, type AppId } from './AppViews';

export const APP_ICON: Record<AppId | 'profile', IconName> = {
  music: 'music',
  reminders: 'remind',
  responses: 'resp',
  news: 'news',
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
  open: AppId | undefined;
  setOpen: (a: AppId | undefined) => void;
  phone: boolean;
}) {
  const theme = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const p = useMainPalette();
  const tile = (id: AppId | 'profile') => (
    <Pressable
      key={id}
      accessibilityRole="button"
      accessibilityLabel={t(`apps.name.${id}`)}
      onPress={() => (id === 'profile' ? router.navigate('/profile') : setOpen(id))}
      style={{ width: phone ? '33.33%' : 112, alignItems: 'center', gap: 11, padding: 4 }}
    >
      {({ pressed }) => (
        <>
          <View
            style={{
              width: phone ? 72 : 78,
              height: phone ? 72 : 78,
              borderRadius: phone ? 20 : 21,
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 1,
              borderColor: p.line,
              backgroundColor: p.tile,
              transform: [{ translateY: pressed ? -2 : 0 }],
              ...(Platform.OS === 'web'
                ? ({ backgroundImage: `linear-gradient(180deg, ${p.tile}, ${p.tile2})` } as object)
                : null),
            }}
          >
            <Icon name={APP_ICON[id]} size={28} color={p.plum} />
          </View>
          <Text style={{ color: p.ink, fontWeight: '600', fontSize: 15, textAlign: 'center' }}>
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
              style={{
                width: 44,
                height: 44,
                borderRadius: 13,
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 1,
                borderColor: p.line,
                backgroundColor: p.tile,
              }}
            >
              <Icon name={APP_ICON[open]} size={22} color={p.plum} />
            </View>
            <Text variant="title2" style={{ color: p.ink }} accessibilityRole="header">
              {t(`apps.name.${open}`)}
            </Text>
          </View>
          <AppView id={open} />
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
          {[...APP_IDS, 'profile' as const].map(tile)}
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
  const p = useMainPalette();
  const wide = split > 0.5;
  const title =
    useChat((s) => s.conversations.find((c) => c.id === s.currentId)?.title) ?? t('chat.newTitle');
  return (
    <View
      style={{
        flex: 1,
        minHeight: 0,
        backgroundColor: `${p.card}D1`,
        borderWidth: 1,
        borderColor: p.line,
        borderRadius: 24,
        overflow: 'hidden',
      }}
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
  const [open, setOpen] = useState<AppId | undefined>();
  const [split, setSplit] = useState(MIN_SPLIT);
  const [width, setWidth] = useState(0);

  return (
    <Scene>
      <MainTop kind="apps" title={t('tabs.apps')} />
      {wideWeb ? (
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
