import { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useErrorText } from '@/features/auth/useErrorText';
import { useHousehold } from '@/features/household/store';
import { usePendantStatus, useReconnect } from '@/features/pendant/store';
import { StepHeader } from '@/features/wearer/StepHeader';
import { WEARER_STEP } from '@/features/wearer/steps';
import { useWearer } from '@/features/wearer/store';
import { pendant, type PendantCheck } from '@/services/pendant';
import { Button, Checkbox, Chip, Screen, Text, useTheme } from '@/ui';

const CHECKS: PendantCheck[] = ['touch', 'announce', 'mic'];

/**
 * C4 · Check your pendant. The wearer ticks each check when it works: the touch tick, the spoken status, and
 * "Hello" on the microphone. "Again" asks the pendant to repeat one. Finish unlocks when all three are ticked.
 */
export default function CheckPendant() {
  const theme = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const errorText = useErrorText();
  const { connection } = usePendantStatus();
  useReconnect(useWearer((s) => s.pendantId));
  const [ticked, setTicked] = useState<Record<PendantCheck, boolean>>({
    touch: false,
    announce: false,
    mic: false,
  });
  const [running, setRunning] = useState<PendantCheck | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const connected = connection === 'connected';

  const again = async (check: PendantCheck) => {
    setError(null);
    setRunning(check);
    try {
      await pendant().runCheck(check);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setRunning(null);
    }
  };

  const finish = async () => {
    setBusy(true);
    await useHousehold.getState().reachStep(WEARER_STEP.pairing);
    router.replace('/wearer/contacts');
  };

  const repair = async () => {
    await useWearer.getState().save({ pendantId: undefined });
    router.replace('/wearer/pair');
  };

  return (
    <Screen
      footer={
        <Button
          label={t('wearer.check.finish')}
          onPress={() => void finish()}
          disabled={!CHECKS.every((c) => ticked[c])}
          loading={busy}
          fullWidth
        />
      }
    >
      <StepHeader step={3} title={t('wearer.check.title')} />
      <Text tone="secondary">{t('wearer.check.body')}</Text>
      <Chip
        label={connected ? t('pendant.connected') : t('pendant.notConnected')}
        tone={connected ? 'good' : 'neutral'}
      />
      {CHECKS.map((c) => (
        <View
          key={c}
          style={{
            borderRadius: theme.radius.lg,
            borderWidth: 1,
            borderColor: theme.colors.borderSubtle,
            backgroundColor: theme.colors.surfaceSolid,
            paddingHorizontal: theme.space[4],
            paddingVertical: theme.space[2],
          }}
        >
          <Checkbox
            actionAtEnd
            label={t(`wearer.check.${c}`)}
            checked={ticked[c]}
            onChange={(on) => setTicked((s) => ({ ...s, [c]: on }))}
          >
            <Button
              label={t('wearer.check.again')}
              accessibilityLabel={t('wearer.check.againFor', { check: t(`wearer.check.${c}`) })}
              variant="tertiary"
              size="sm"
              loading={running === c}
              disabled={!connected || (running !== null && running !== c)}
              onPress={() => void again(c)}
            />
          </Checkbox>
        </View>
      ))}
      {error ? (
        <Text tone="safety" accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
      {!connected ? (
        <Button label={t('wearer.check.repair')} variant="secondary" onPress={() => void repair()} />
      ) : null}
    </Screen>
  );
}
