import { useState } from 'react';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useErrorText } from '@/features/auth/useErrorText';
import { useHousehold } from '@/features/household/store';
import { ProfileFields, useProfileForm } from '@/features/wearer/ProfileFields';
import { useWearer } from '@/features/wearer/store';
import { saveWearerProfile } from '@/services/household/wearerApi';
import { Button, Screen, Text } from '@/ui';

/** Edit profile (from My Profile): the same questions as About you in setup, without the consent tick. */
export default function EditProfile() {
  const { t } = useTranslation();
  const router = useRouter();
  const errorText = useErrorText();
  const householdId = useHousehold((s) => s.householdId);
  const saved = useWearer((s) => s.profile);
  const form = useProfileForm(saved);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    if (!householdId || !form.payload) return;
    setBusy(true);
    setError(null);
    try {
      const profile = await saveWearerProfile(householdId, form.payload);
      await useWearer.getState().save({ profile });
      router.back();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen
      footer={
        <>
          <Button
            label={t('common.save')}
            onPress={() => void save()}
            disabled={!householdId || !form.valid}
            loading={busy}
            fullWidth
          />
          <Button label={t('common.cancel')} variant="tertiary" onPress={() => router.back()} fullWidth />
        </>
      }
    >
      <Button label={t('common.back')} variant="tertiary" onPress={() => router.back()} />
      <Text variant="title1" tone="heading" accessibilityRole="header">
        {t('profile.editTitle')}
      </Text>
      <ProfileFields form={form} />
      {error ? (
        <Text tone="safety" accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
    </Screen>
  );
}
