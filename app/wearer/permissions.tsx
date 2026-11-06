import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useErrorText } from '@/features/auth/useErrorText';
import { useHousehold } from '@/features/household/store';
import { WEARER_STEP } from '@/features/wearer/steps';
import { savePushToken } from '@/services/notifications/notificationsApi';
import {
  WEARER_PERMISSIONS,
  canAskBatteryExemption,
  canGrantPermissions,
  getWearerPermission,
  openAppSettings,
  openBatterySettings,
  requestWearerPermission,
  type PermissionStatus,
  type WearerPermission,
} from '@/services/permissions/wearerPermissions';
import { Button, Card, Chip, ListRow, Screen, Sheet, Text, useTheme } from '@/ui';

type Statuses = Record<WearerPermission, PermissionStatus>;

/**
 * B2 · Permissions for wearers. The phone is the pendant's gateway, so Bluetooth, "always" location and
 * notifications are required; battery exemption (Android) is recommended. Each one shows the system question in turn.
 * If a required one was refused, the system will not ask again, so we point to Settings instead of moving on.
 */
export default function WearerPermissions() {
  const theme = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const errorText = useErrorText();
  const [status, setStatus] = useState<Statuses | null>(null);
  const [busy, setBusy] = useState(false);
  const [why, setWhy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(
    () =>
      void Promise.all(WEARER_PERMISSIONS.map(getWearerPermission)).then((values) =>
        setStatus(Object.fromEntries(WEARER_PERMISSIONS.map((p, i) => [p, values[i]])) as Statuses),
      ),
    [],
  );

  useEffect(() => {
    refresh();
    // Coming back from Settings: read the permissions again.
    const sub = AppState.addEventListener('change', (s) => s === 'active' && refresh());
    return () => sub.remove();
  }, [refresh]);

  const finish = async () => {
    // On the web nothing can be granted yet: carry on, and the phone asks later. A missing push token must not block that.
    if (canGrantPermissions) await savePushToken();
    else await savePushToken().catch(() => undefined);
    await useHousehold.getState().reachStep(WEARER_STEP.permissions);
    router.replace('/wearer/about');
  };

  const allow = async () => {
    if (!canGrantPermissions) {
      setBusy(true);
      try {
        await finish();
      } catch (e) {
        setError(errorText(e));
      } finally {
        setBusy(false);
      }
      return;
    }
    if (!status) return;
    setBusy(true);
    setError(null);
    try {
      const next = { ...status };
      for (const p of WEARER_PERMISSIONS) {
        if (next[p] === 'granted') continue;
        next[p] = await requestWearerPermission(p);
        setStatus({ ...next });
        if (next[p] !== 'granted') return; // stop at the first refusal; the screen shows what to do
      }
      await finish();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const denied =
    canGrantPermissions && status ? WEARER_PERMISSIONS.some((p) => status[p] === 'denied') : false;
  const chip = (p: WearerPermission) => {
    if (!canGrantPermissions) return <Chip label={t('permissions.state.later')} tone="neutral" />;
    const s = status?.[p];
    if (s === 'granted') return <Chip label={t('permissions.state.granted')} tone="good" />;
    if (s === 'denied') return <Chip label={t('permissions.state.denied')} tone="safety" />;
    return <Chip label={t('permissions.state.required')} tone="attention" />;
  };

  return (
    <Screen
      footer={
        <>
          {!canGrantPermissions ? (
            <Button
              label={t('wearer.permissions.continueWeb')}
              onPress={() => void allow()}
              loading={busy}
              fullWidth
            />
          ) : denied ? (
            <Button label={t('permissions.openSettings')} onPress={() => void openAppSettings()} fullWidth />
          ) : (
            <Button
              label={t('wearer.permissions.allow')}
              onPress={() => void allow()}
              loading={busy}
              disabled={status === null}
              fullWidth
            />
          )}
          <Button label={t('wearer.permissions.why')} variant="tertiary" onPress={() => setWhy(true)} />
        </>
      }
    >
      <Button label={t('common.back')} variant="tertiary" onPress={() => router.back()} />
      <Text variant="title1" tone="heading" accessibilityRole="header">
        {t('wearer.permissions.title')}
      </Text>
      <Text tone="secondary">{t('wearer.permissions.body')}</Text>
      {canGrantPermissions ? null : (
        <Card style={{ gap: theme.space[2] }}>
          <Text tone="secondary">{t('wearer.permissions.webNote')}</Text>
        </Card>
      )}
      {WEARER_PERMISSIONS.map((p) => (
        <Card key={p} style={{ gap: theme.space[2] }}>
          <Text variant="heading">{t(`wearer.permissions.${p}.title`)}</Text>
          <Text tone="secondary">{t(`wearer.permissions.${p}.detail`)}</Text>
          {chip(p)}
        </Card>
      ))}
      {canAskBatteryExemption ? (
        <ListRow
          title={t('wearer.permissions.battery.title')}
          detail={t('wearer.permissions.battery.detail')}
          actionLabel={t('wearer.permissions.battery.action')}
          onPress={() => void openBatterySettings()}
        />
      ) : null}
      {denied ? (
        <Card accessibilityRole="alert" style={{ gap: theme.space[2] }}>
          <Text variant="heading">{t('wearer.permissions.denied.title')}</Text>
          <Text tone="secondary">{t('wearer.permissions.denied.body')}</Text>
        </Card>
      ) : null}
      {error ? (
        <Text tone="safety" accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
      <Sheet open={why} title={t('wearer.permissions.whyTitle')} onClose={() => setWhy(false)}>
        <Text tone="secondary">{t('wearer.permissions.whyBody')}</Text>
        <Button label={t('common.close')} variant="secondary" onPress={() => setWhy(false)} fullWidth />
      </Sheet>
    </Screen>
  );
}
