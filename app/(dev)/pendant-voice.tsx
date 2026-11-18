import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { usePendantLink } from '@/features/pendant/usePendantLink';
import { usePendantVoiceInfo } from '@/features/pendant/voice';
import { Button, Card, ListRow, Text, useTheme } from '@/ui';

/**
 * Dev screen (svaraa://pendant-voice): connect a Bluetooth pendant or the Python simulator straight away and watch
 * its audio go to the voice socket. Skips the wearer set-up, so it works with mocks on and no household.
 */
export default function PendantVoiceDebug() {
  const theme = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const link = usePendantLink();
  const voice = usePendantVoiceInfo();
  const connected = link.status.connection === 'connected';
  const errorText = link.error
    ? link.error === 'bluetooth_permission'
      ? t('pendantVoice.noPermission')
      : t(`errors.${link.error}`, { defaultValue: link.error })
    : undefined;
  const format = voice.format
    ? t('pendantVoice.format', {
        codec: voice.format.codec,
        rate: voice.format.rate,
        channels: voice.format.channels,
        ms: voice.format.frameMs,
      })
    : undefined;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.colors.canvas }}
      contentContainerStyle={{
        padding: theme.space[4],
        paddingTop: theme.space[4] + insets.top,
        paddingBottom: theme.space[6] + insets.bottom,
        gap: theme.space[4],
      }}
    >
      <Text variant="title2" tone="heading">
        {t('pendantVoice.title')}
      </Text>

      <Card style={{ gap: theme.space[2] }}>
        <Text variant="kicker" tone="spirit">
          {t('pendantVoice.pendant')}
        </Text>
        <Text>{t('pendantVoice.transport', { value: link.transport })}</Text>
        <Text>
          {t('pendantVoice.connection', { value: t(`pendantVoice.connections.${link.status.connection}`) })}
        </Text>
        {connected && link.status.pendantId ? <Text tone="secondary">{link.status.pendantId}</Text> : null}
        {format ? <Text tone="secondary">{format}</Text> : null}
        {errorText ? <Text tone="safety">{errorText}</Text> : null}
        <View style={{ flexDirection: 'row', gap: theme.space[2], flexWrap: 'wrap' }}>
          {connected ? (
            <Button
              label={t('pendantVoice.disconnect')}
              variant="secondary"
              onPress={() => void link.disconnect()}
            />
          ) : (
            <Button
              label={link.scanning ? t('pendantVoice.scanning') : t('pendantVoice.scan')}
              loading={link.scanning}
              onPress={() => void link.scan()}
            />
          )}
        </View>
        {!connected
          ? link.found.map((p) => (
              <ListRow
                key={p.id}
                title={p.name || t('apps.pendant.name')}
                detail={p.id}
                actionLabel={t('pendantVoice.connect')}
                onPress={() => void link.connect(p)}
              />
            ))
          : null}
      </Card>

      <Card style={{ gap: theme.space[2] }}>
        <Text variant="kicker" tone="spirit">
          {t('pendantVoice.voice')}
        </Text>
        {voice.enabled ? (
          <>
            <Text tone="secondary">{voice.url}</Text>
            <Text>
              {t('pendantVoice.replyTo', { value: t(`pendantVoice.replyTargets.${voice.replyTo}`) })}
            </Text>
            <Text>{t('pendantVoice.state', { value: t(`pendantVoice.states.${voice.state}`) })}</Text>
            <Text>
              {t('pendantVoice.stats', {
                frames: voice.stats.framesIn,
                chunks: voice.stats.chunksSent,
                dropped: voice.stats.dropped,
                replies: voice.stats.replies,
              })}
            </Text>
            {voice.replyTo === 'pendant' ? (
              <Text>{t('pendantVoice.framesOut', { frames: voice.stats.framesOut })}</Text>
            ) : null}
            {voice.error ? (
              <Text tone="safety">{t('pendantVoice.lastError', { value: voice.error })}</Text>
            ) : null}
          </>
        ) : (
          <Text tone="secondary">{t('pendantVoice.off')}</Text>
        )}
      </Card>

      {voice.log.length ? (
        <Card style={{ gap: theme.space[1] }}>
          <Text variant="kicker" tone="spirit">
            {t('pendantVoice.log')}
          </Text>
          {voice.log.map((line, i) => (
            <Text key={`${i}-${line}`} variant="caption" tone="secondary">
              {line}
            </Text>
          ))}
        </Card>
      ) : null}
    </ScrollView>
  );
}
