import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useErrorText } from '@/features/auth/useErrorText';
import { useHousehold } from '@/features/household/store';
import { CallChain } from '@/features/wearer/CallChain';
import { DrillHistory } from '@/features/wearer/DrillHistory';
import { useDrillRecords } from '@/features/wearer/drillRecords';
import { DrillSteps } from '@/features/wearer/DrillSteps';
import { useWearer } from '@/features/wearer/store';
import { StepHeader } from '@/features/wearer/StepHeader';
import { useDrill } from '@/features/wearer/useDrill';
import { Button, Choice, Screen, Text, useTheme } from '@/ui';

/**
 * C8 · Test your SOS. Hold the gold dot for three seconds, or tap the button. Contacts get an alert marked DRILL;
 * the drill passes when one of them answers within five minutes, then setup is finished and Home shows "Protected".
 * Also reachable from the wearer Home ("Run SOS drill"): once setup is done it is a practice run that ends with Done.
 */
export default function SosDrill() {
  const theme = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const errorText = useErrorText();
  const setupDone = useHousehold((s) => s.hasActiveDevice);
  const { drill, start, starting, error, secondsLeft } = useDrill();
  const contacts = useWearer((s) => s.contacts);
  const [finishing, setFinishing] = useState(false);
  const [tab, setTab] = useState<'run' | 'history'>('run');
  const record = useDrillRecords((s) => s.record);

  useEffect(() => void useDrillRecords.getState().load(), []);
  // Keep how each drill ended (passed or nobody answered) for the History tab.
  useEffect(() => {
    if (!drill || drill.status === 'waiting') return;
    const seconds = Math.max(0, Math.round((Date.now() - Date.parse(drill.started_at)) / 1000));
    void record({
      id: drill.id,
      startedAt: drill.started_at,
      status: drill.status,
      answeredBy: drill.acknowledged_by ?? undefined,
      seconds: Math.min(
        seconds,
        Math.round((Date.parse(drill.expires_at) - Date.parse(drill.started_at)) / 1000),
      ),
    });
  }, [drill, record]);
  const c = theme.colors;

  const finish = async () => {
    setFinishing(true);
    await useHousehold.getState().activate();
    router.replace('/home');
  };

  const waiting = drill?.status === 'waiting';
  const passed = drill?.status === 'passed';
  const running = !!drill && drill.status !== 'expired';

  return (
    <Screen
      footer={
        setupDone ? (
          <Button label={t('common.done')} onPress={() => router.back()} disabled={waiting} fullWidth />
        ) : (
          <Button
            label={t('wearer.drill.finish')}
            onPress={() => void finish()}
            disabled={!passed}
            loading={finishing}
            fullWidth
          />
        )
      }
    >
      <StepHeader step={setupDone ? undefined : 5} title={t('wearer.drill.title')} />
      {setupDone ? (
        <Choice<'run' | 'history'>
          label={t('wearer.drill.title')}
          value={tab}
          onChange={setTab}
          options={[
            { id: 'run', label: t('wearer.drill.tabs.run') },
            { id: 'history', label: t('wearer.drill.tabs.history') },
          ]}
        />
      ) : null}
      {setupDone && tab === 'history' ? (
        <DrillHistory />
      ) : (
        <>
          {running ? null : (
            <View
              accessibilityElementsHidden
              importantForAccessibility="no"
              style={{
                alignSelf: 'center',
                width: 112,
                height: 112,
                borderRadius: 56,
                borderWidth: 3,
                borderColor: c.accentSpirit,
                backgroundColor: c.attentionTint,
                alignItems: 'center',
                justifyContent: 'center',
                marginVertical: theme.space[2],
              }}
            >
              <Text variant="label" tone="spirit">
                {t('wearer.drill.dot')}
              </Text>
            </View>
          )}
          {running ? null : (
            <Text tone="secondary" style={{ textAlign: 'center' }}>
              {t('wearer.drill.how')}
            </Text>
          )}
          {!waiting && !passed ? (
            <Button
              label={drill?.status === 'expired' ? t('wearer.drill.again') : t('wearer.drill.run')}
              variant="secondary"
              onPress={() => void start()}
              loading={starting}
              fullWidth
            />
          ) : null}
          {drill ? <DrillSteps drill={drill} contacts={contacts} secondsLeft={secondsLeft} /> : null}
          <CallChain drill />
          {error ? (
            <Text tone="safety" accessibilityRole="alert">
              {errorText(error)}
            </Text>
          ) : null}
        </>
      )}
    </Screen>
  );
}
