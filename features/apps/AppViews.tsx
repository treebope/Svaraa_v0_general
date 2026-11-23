import type { ReactNode } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { flags } from '@/config/flags';
import { GamesView } from '@/features/games/GamesView';
import { MusicView } from '@/features/music/MusicView';
import { ResponsesView } from './ResponsesView';
import { RemindersView } from '@/features/reminders/RemindersView';
import { NewsView } from '@/features/news/NewsView';
import { NotesView } from '@/features/notes/NotesView';
import { usePendantStatus } from '@/features/pendant/store';
import { SosHistory } from '@/features/pendant/SosHistory';
import { useWearer } from '@/features/wearer/store';
import { InfoRow, Pill, useMainPalette } from '@/features/main/palette';
import { Button, Text, useTheme } from '@/ui';

export type AppId = 'music' | 'reminders' | 'notes' | 'responses' | 'news' | 'games' | 'pendant' | 'contacts';

/** Apps in the grid, in wireframe order. "My Profile" is a separate tile that opens in this same pane. */
export const APP_IDS: AppId[] = (
  ['music', 'reminders', 'notes', 'responses', 'news', 'games', 'pendant', 'contacts'] as AppId[]
).filter((id) => (id !== 'news' || flags.news) && (id !== 'notes' || flags.notes));

const Row = InfoRow;

function Pendant() {
  const { t } = useTranslation();
  const router = useRouter();
  const { connection, battery, charging } = usePendantStatus();
  const connected = connection === 'connected';
  return (
    <>
      <Row
        title={t('apps.pendant.name')}
        detail={
          connected && battery !== undefined
            ? t(charging ? 'wearerHome.pendantCharging' : 'wearerHome.pendant', { battery })
            : t('pendant.notConnected')
        }
        right={
          <Pill
            label={connected ? t('pendant.connected') : t('pendant.notConnected')}
            tone={connected ? 'good' : 'plain'}
          />
        }
      />
      <Row
        title={t('wearerHome.listening')}
        detail={t('wearerHome.listeningDetail')}
        right={<Pill label={t('wearerHome.listeningOff')} />}
      />
      <Button
        label={t('wearer.drill.run')}
        variant="secondary"
        onPress={() => router.push('/wearer/drill')}
        fullWidth
      />
      <SosHistory />
    </>
  );
}

function Contacts() {
  const { t } = useTranslation();
  const p = useMainPalette();
  const contacts = useWearer((s) => s.contacts);
  return (
    <>
      <Text variant="kicker" style={{ color: p.gold }}>
        {t('apps.contacts.order')}
      </Text>
      {contacts.length ? (
        contacts.map((p, i) => (
          <Row
            key={`${p.countryCode}${p.mobile}`}
            title={`${i + 1} · ${p.name}`}
            detail={`${p.countryCode} ${p.mobile}`}
          />
        ))
      ) : (
        <Text style={{ color: p.muted }}>{t('wearerHome.noPeople')}</Text>
      )}
    </>
  );
}

const VIEWS: Record<AppId, () => ReactNode> = {
  music: MusicView,
  reminders: RemindersView,
  notes: NotesView,
  responses: ResponsesView,
  news: NewsView,
  games: GamesView,
  pendant: Pendant,
  contacts: Contacts,
};

export function AppView({ id }: { id: AppId }) {
  const theme = useTheme();
  const View_ = VIEWS[id];
  return (
    <View style={{ gap: theme.space[3] }}>
      <View_ />
    </View>
  );
}
