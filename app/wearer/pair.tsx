import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useErrorText } from '@/features/auth/useErrorText';
import { MockPairingPendant } from '@/features/wearer/MockPairingPendant';
import { StepHeader } from '@/features/wearer/StepHeader';
import { usePairing } from '@/features/wearer/usePairing';
import { FlowShell } from '@/features/setup/FlowShell';
import { Button, Card, StepList, Text, useTheme, type StepListItem } from '@/ui';

/**
 * C3 · Pair your pendant, always on the wearer's phone. The pendant has no screen, so there is no code to compare:
 * a gold-button press (BLE `pairing_press`, or the simulator mock below) opens a short pairing window, the phone
 * finds the pendant, and a silent signed-challenge check proves it is genuine.
 */
export default function PairPendant() {
  const theme = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const errorText = useErrorText();
  const { phase, found, error, pair } = usePairing();

  useEffect(() => {
    if (phase === 'paired') router.replace('/wearer/check');
  }, [phase, router]);

  const step: StepListItem['state'][] =
    phase === 'ready'
      ? ['now', 'todo', 'todo']
      : phase === 'scanning' || phase === 'found' || phase === 'failed'
        ? ['done', 'now', 'todo']
        : ['done', 'done', 'now'];

  const step1Verified = phase === 'scanning' || phase === 'found' || phase === 'pairing';
  /** Hide the simulator once we're on step 3 (pairing / Connected). */
  const showMock = phase === 'ready' || phase === 'failed' || phase === 'scanning' || phase === 'found';
  const primary = found[0];
  const canContinue = !!primary && phase === 'found';

  return (
    <FlowShell
      footer={
        step1Verified ? (
          <Button
            label={t('common.continue')}
            onPress={() => {
              if (primary) void pair(primary);
            }}
            disabled={!canContinue}
            loading={phase === 'pairing'}
            fullWidth
          />
        ) : null
      }
    >
      <View style={{ gap: theme.space[5] }}>
        <StepHeader step={3} title={t('wearer.pair.title')} />

        <View style={{ gap: theme.space[4] }}>
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
        </View>

        <View style={{ gap: theme.space[5] }}>
          <Text variant="bodySm" tone="tertiary">
            {t('wearer.pair.charging')}
          </Text>
          {showMock ? (
            <MockPairingPendant
              retry={phase === 'failed'}
              disabled={step1Verified}
              foundLabel={
                primary
                  ? t('wearer.pair.nearbyFound', { name: primary.name, serial: primary.serial })
                  : undefined
              }
            />
          ) : null}
        </View>
      </View>
    </FlowShell>
  );
}
