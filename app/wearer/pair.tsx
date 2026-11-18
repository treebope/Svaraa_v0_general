import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useErrorText } from '@/features/auth/useErrorText';
import { StepHeader } from '@/features/wearer/StepHeader';
import { usePairing } from '@/features/wearer/usePairing';
import { Button, Card, ListRow, Screen, StepList, Text, useTheme, type StepListItem } from '@/ui';

/**
 * C3 · Pair your pendant, always on the wearer's phone. The pendant has no screen, so there is no code to compare:
 * pressing the gold dot opens a short pairing window (proof the person is holding it), the pendant confirms with a
 * tick and a spoken "Connected", and a silent signed-challenge check proves it is genuine.
 */
export default function PairPendant() {
  const theme = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const errorText = useErrorText();
  const { phase, found, error, scan, pair } = usePairing();

  useEffect(() => {
    if (phase === 'paired') router.replace('/wearer/check');
  }, [phase, router]);

  const step: StepListItem['state'][] =
    phase === 'ready'
      ? ['now', 'todo', 'todo']
      : phase === 'scanning' || phase === 'found' || phase === 'failed'
        ? ['done', 'now', 'todo']
        : ['done', 'done', 'now'];

  return (
    <Screen
      footer={
        phase === 'ready' || phase === 'failed' ? (
          <Button
            label={phase === 'failed' ? t('wearer.pair.retry') : t('wearer.pair.pressed')}
            onPress={scan}
            fullWidth
          />
        ) : null
      }
    >
      <StepHeader step={3} title={t('wearer.pair.title')} />
      <StepList
        items={[
          { label: t('wearer.pair.step1'), detail: t('wearer.pair.step1Detail'), state: step[0] },
          { label: t('wearer.pair.step2'), state: step[1] },
          { label: t('wearer.pair.step3'), state: step[2] },
        ]}
      />
      {phase === 'scanning' ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space[3] }}>
          <ActivityIndicator color={theme.colors.action} />
          <Text tone="secondary" accessibilityLiveRegion="polite">
            {t('wearer.pair.scanning')}
          </Text>
        </View>
      ) : null}
      {phase === 'found'
        ? found.map((p) => (
            <ListRow
              key={p.id}
              title={p.name || t('apps.pendant.name')}
              detail={t('wearer.pair.nearby', { serial: p.serial })}
              actionLabel={t('wearer.pair.pair')}
              onPress={() => void pair(p)}
            />
          ))
        : null}
      {phase === 'pairing' ? (
        <Card style={{ gap: theme.space[2] }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space[3] }}>
            <ActivityIndicator color={theme.colors.action} />
            <Text variant="heading" accessibilityLiveRegion="polite">
              {t('wearer.pair.pairing')}
            </Text>
          </View>
          <Text tone="secondary">{t('wearer.pair.confirms')}</Text>
        </Card>
      ) : null}
      {phase === 'failed' && error ? (
        <Text tone="safety" accessibilityRole="alert">
          {errorText(error)}
        </Text>
      ) : null}
      <Text variant="bodySm" tone="tertiary">
        {t('wearer.pair.charging')}
      </Text>
    </Screen>
  );
}
