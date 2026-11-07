import { useState } from 'react';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useErrorText } from '@/features/auth/useErrorText';
import { useGreetingName } from '@/features/home/useGreetingName';
import { useHousehold } from '@/features/household/store';
import { StepHeader } from '@/features/wearer/StepHeader';
import { WEARER_STEP } from '@/features/wearer/steps';
import { useWearer } from '@/features/wearer/store';
import { ProfileFields, useProfileForm } from '@/features/wearer/ProfileFields';
import { giveConsent, saveWearerProfile } from '@/services/household/wearerApi';
import { Button, Checkbox, Screen, Sheet, Text } from '@/ui';

/**
 * C1 · About you + consent. Name, date of birth (required), an optional name for the voice assistant to use, languages, health notes and
 * pacemaker. The consent checkbox replaces the old consent screen: Continue stays off until it is ticked, and
 * agreeing saves a versioned consent record. No address in v0.
 */
export default function AboutYou() {
  const { t } = useTranslation();
  const router = useRouter();
  const errorText = useErrorText();
  const householdId = useHousehold((s) => s.householdId);
  const saved = useWearer((s) => s.profile);
  const greetingName = useGreetingName();

  const form = useProfileForm(saved, greetingName ?? '');
  const [agreed, setAgreed] = useState(false);
  const [details, setDetails] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ready = !!householdId && form.valid && agreed;

  const next = async () => {
    if (!ready || !householdId || !form.payload) return;
    setBusy(true);
    setError(null);
    try {
      const profile = await saveWearerProfile(householdId, form.payload);
      await giveConsent(householdId, 'app');
      await useWearer.getState().save({ profile });
      await useHousehold.getState().reachStep(WEARER_STEP.about);
      router.push('/wearer/claim');
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen
      footer={
        <Button
          label={t('common.continue')}
          onPress={() => void next()}
          disabled={!ready}
          loading={busy}
          fullWidth
        />
      }
    >
      <StepHeader step={1} title={t('wearer.about.title')} />
      <ProfileFields form={form} />
      <Checkbox label={t('wearer.about.consent')} checked={agreed} onChange={setAgreed}>
        <Button
          label={t('wearer.about.details')}
          variant="tertiary"
          size="sm"
          onPress={() => setDetails(true)}
        />
      </Checkbox>
      {error ? (
        <Text tone="safety" accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
      <Sheet open={details} title={t('wearer.consent.title')} onClose={() => setDetails(false)}>
        <Text variant="heading">{t('wearer.consent.hearsTitle')}</Text>
        <Text tone="secondary">{t('wearer.consent.hears')}</Text>
        <Text variant="heading">{t('wearer.consent.recordsTitle')}</Text>
        <Text tone="secondary">{t('wearer.consent.records')}</Text>
        <Text variant="heading">{t('wearer.consent.seesTitle')}</Text>
        <Text tone="secondary">{t('wearer.consent.sees')}</Text>
        <Button label={t('common.close')} variant="secondary" onPress={() => setDetails(false)} fullWidth />
      </Sheet>
    </Screen>
  );
}
