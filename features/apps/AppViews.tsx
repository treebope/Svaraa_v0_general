import type { ReactNode } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { flags } from '@/config/flags';
import { NewsView } from '@/features/news/NewsView';
import { usePendantStatus } from '@/features/pendant/store';
import { SosHistory } from '@/features/pendant/SosHistory';
import { useWearer } from '@/features/wearer/store';
import { InfoRow, Pill, useMainPalette } from '@/features/main/palette';
import { Button, Text, useTheme } from '@/ui';

export type AppId = 'music' | 'reminders' | 'responses' | 'news' | 'pendant' | 'contacts';

/** Apps in the grid, in wireframe order. "My Profile" is the seventh tile and opens the Profile tab. */
export const APP_IDS: AppId[] = (
  ['music', 'reminders', 'responses', 'news', 'pendant', 'contacts'] as AppId[]
).filter((id) => id !== 'news' || flags.news);

const Row = InfoRow;

/** PENDING BACKEND: Music, Reminders and Responses show the sample content from the wireframes until their APIs exist. */
function Music() {
  const { t } = useTranslation();
  const p = useMainPalette();
  return (
    <>
      <Row title={t('apps.music.now')} detail={t('apps.music.nowDetail')} />
      <Text variant="kicker" style={{ color: p.gold }}>
        {t('apps.music.lists')}
      </Text>
      {(['bhajans', 'film', 'carnatic'] as const).map((k) => (
        <Row key={k} title={t(`apps.music.list.${k}`)} detail={t(`apps.music.count.${k}`)} />
      ))}
    </>
  );
}

function Reminders() {
  const { t } = useTranslation();
  const p = useMainPalette();
  return (
    <>
      {(['bp', 'doctor', 'ravi'] as const).map((k) => (
        <Row
          key={k}
          title={t(`apps.reminders.${k}.title`)}
          detail={t(`apps.reminders.${k}.when`)}
          right={
            <Pill
              label={t(k === 'bp' ? 'apps.reminders.daily' : 'apps.reminders.once')}
              tone={k === 'bp' ? 'plum' : 'plain'}
            />
          }
        />
      ))}
      <Text style={{ color: p.muted }}>{t('apps.reminders.hint')}</Text>
    </>
  );
}

function Responses() {
  const { t } = useTranslation();
  const p = useMainPalette();
  return (
    <>
      <Text style={{ color: p.muted }}>{t('apps.responses.intro')}</Text>
      {(['fine', 'call', 'medicine'] as const).map((k) => (
        <Row key={k} title={t(`apps.responses.${k}`)} />
      ))}
    </>
  );
}

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
  music: Music,
  reminders: Reminders,
  responses: Responses,
  news: NewsView,
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
