import { useState } from 'react';
import { Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useErrorText } from '@/features/auth/useErrorText';
import { useHousehold } from '@/features/household/store';
import { StepHeader } from '@/features/wearer/StepHeader';
import { WEARER_STEP } from '@/features/wearer/steps';
import { useWearer } from '@/features/wearer/store';
import { MAX_SETUP_CONTACTS, saveContacts, toContactIn } from '@/services/household/wearerApi';
import { Button, ListRow, Screen, Text, useTheme } from '@/ui';

/**
 * C5 · Set up emergency contacts. If the wearer needs help, Svaraa alerts these people in this order.
 * Name and number only; contacts don't need the app, and how they are alerted (call, push) is decided by Svaraa,
 * so nothing about it is shown or chosen here. Up to two now, more later in My Profile.
 */
export default function EmergencyContacts() {
  const theme = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const errorText = useErrorText();
  const householdId = useHousehold((s) => s.householdId);
  const contacts = useWearer((s) => s.contacts);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const next = async () => {
    if (!householdId || !contacts.length) return;
    setBusy(true);
    setError(null);
    try {
      await saveContacts(householdId, contacts.map(toContactIn));
      await useHousehold.getState().reachStep(WEARER_STEP.contacts);
      router.push('/wearer/invite');
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
          disabled={!contacts.length}
          loading={busy}
          fullWidth
        />
      }
    >
      <StepHeader step={4} title={t('wearer.contacts.title')} />
      <Text tone="secondary">{t('wearer.contacts.body')}</Text>
      {contacts.map((c, i) => (
        <ListRow
          key={`${i}-${c.mobile}`}
          title={t('wearer.contacts.row', { n: i + 1, name: c.name })}
          detail={[c.relationship, `${c.countryCode} ${c.mobile}`].filter(Boolean).join(' · ')}
          onPress={() => router.push({ pathname: '/wearer/contact', params: { index: String(i) } })}
        />
      ))}
      {contacts.length < MAX_SETUP_CONTACTS ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('wearer.contacts.add')}
          onPress={() => router.push('/wearer/contact')}
          style={({ pressed }) => ({
            minHeight: theme.minTarget + theme.space[3],
            borderRadius: theme.radius.lg,
            borderWidth: 1.5,
            borderStyle: 'dashed',
            borderColor: theme.colors.border,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: pressed ? theme.colors.sunken : 'transparent',
          })}
        >
          <Text variant="heading" tone="secondary">
            {`＋ ${t('wearer.contacts.add')}`}
          </Text>
        </Pressable>
      ) : null}
      <Text variant="bodySm" tone="tertiary">
        {t('wearer.contacts.limit', { max: MAX_SETUP_CONTACTS })}
      </Text>
      {error ? (
        <Text tone="safety" accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
    </Screen>
  );
}
