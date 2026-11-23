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
import { MockPairingPendant } from '@/features/wearer/MockPairingPendant';
import { useWearer } from '@/features/wearer/store';
import { ApiError } from '@/services/api';
import { StepHeader } from '@/features/wearer/StepHeader';
import { useDrill } from '@/features/wearer/useDrill';
import { safeBack } from '@/features/nav/safeBack';
import { FlowShell } from '@/features/setup/FlowShell';
import { Button, Choice, Text, useTheme } from '@/ui';

/**
 * C8 · Test your SOS. Press the gold button 3 times. Contacts get an alert marked DRILL;
 * the drill passes when one of them answers within five minutes, then setup is finished and Home shows "Protected".
 * Also reachable from the wearer Home ("Run SOS drill"): once setup is done it is a practice run that ends with Done.
 */
export default function SosDrill() {
  const theme = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const errorText = useErrorText();
  const setupDone = useHousehold((s) => s.hasActiveDevice);
  const { drill, starting, acknowledge, acknowledging, ackError, error, secondsLeft } = useDrill();
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

  const finish = async () => {
    setFinishing(true);
    await useHousehold.getState().activate();
    router.replace('/home');
  };

  // Answer the drill from this phone; during setup a pass moves straight on to Home.
  const answer = async () => {
    if ((await acknowledge()) && !setupDone) await finish();
  };
  const ackErrorText =
    ackError instanceof ApiError && ackError.code === 'forbidden'
      ? t('wearer.drill.ack.forbidden')
      : ackError
        ? errorText(ackError)
        : null;

  const waiting = drill?.status === 'waiting';
  const passed = drill?.status === 'passed';
  const running = !!drill && drill.status !== 'expired';

  return (
    <FlowShell
      footer={
        setupDone ? (
          <Button label={t('common.done')} onPress={() => safeBack(router)} disabled={waiting} fullWidth />
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
      <View style={{ gap: theme.space[5] }}>
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
          <View style={{ gap: theme.space[4] }}>
            {running ? null : (
              <View style={{ gap: theme.space[5] }}>
                <Text tone="secondary">{t('wearer.drill.how')}</Text>
                <MockPairingPendant intent="sos" disabled={starting} />
              </View>
            )}
            {waiting ? (
              <View style={{ gap: theme.space[1] }}>
                <Button
                  label={t('wearer.drill.ack.button')}
                  onPress={() => void answer()}
                  loading={acknowledging || finishing}
                  fullWidth
                />
                <Text variant="bodySm" tone="secondary" style={{ textAlign: 'center' }}>
                  {t('wearer.drill.ack.hint')}
                </Text>
                {ackErrorText ? (
                  <Text tone="safety" accessibilityRole="alert">
                    {ackErrorText}
                  </Text>
                ) : null}
              </View>
            ) : null}
            {drill ? (
              <DrillSteps
                drill={drill}
                contacts={contacts}
                secondsLeft={secondsLeft}
                onOverride={() => void answer()}
                overriding={acknowledging || finishing}
              />
            ) : null}
            <CallChain drill />
            {error ? (
              <Text tone="safety" accessibilityRole="alert">
                {errorText(error)}
              </Text>
            ) : null}
          </View>
        )}
      </View>
    </FlowShell>
  );
}
