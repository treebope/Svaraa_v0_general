import { useEffect, useState } from 'react';
import { Share, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useErrorText } from '@/features/auth/useErrorText';
import { useHousehold } from '@/features/household/store';
import { StepHeader } from '@/features/wearer/StepHeader';
import type { InviteOut } from '@/services/api';
import { createInvite, type InviteRole } from '@/services/household/wearerApi';
import { FlowShell } from '@/features/setup/FlowShell';
import { Button, Option, Text, useTheme } from '@/ui';

/**
 * C7 · Invite someone to help (optional). The owner picks Admin (sees status, edits settings) or Viewer (sees alerts
 * only), then shares the link through the phone's share sheet. The code expires in 24 hours and joiners stay
 * pending until the owner approves them. Also reachable later from Settings.
 */
export default function InviteCaregiver() {
  const theme = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const errorText = useErrorText();
  const householdId = useHousehold((s) => s.householdId);
  const [role, setRole] = useState<InviteRole>('admin');
  const [invite, setInvite] = useState<InviteOut | null>(null);
  const [shared, setShared] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // A new role makes a new invite; the server cancels the earlier one.
  useEffect(() => {
    if (!householdId) return;
    let live = true;
    createInvite(householdId, role).then(
      (i) => {
        if (!live) return;
        setInvite(i);
        setError(null);
      },
      (e) => {
        if (live) setError(errorText(e));
      },
    );
    return () => {
      live = false;
    };
  }, [householdId, role, errorText]);

  const share = async () => {
    if (!invite) return;
    const result = await Share.share({
      message: t('wearer.invite.message', { code: invite.code, url: invite.url }),
    });
    if (result.action === Share.sharedAction) setShared(true);
  };

  return (
    <FlowShell
      footer={
        <>
          <Button
            label={t('wearer.invite.share')}
            onPress={() => void share()}
            disabled={!invite}
            fullWidth
          />
          <Button
            label={shared ? t('common.continue') : t('wearer.invite.skip')}
            variant="tertiary"
            onPress={() => router.push('/wearer/drill')}
          />
        </>
      }
    >
      <StepHeader title={t('wearer.invite.title')} />
      <Text tone="secondary">{t('wearer.invite.body')}</Text>
      <Option
        title={t('wearer.invite.admin')}
        detail={t('wearer.invite.adminDetail')}
        selected={role === 'admin'}
        onPress={() => setRole('admin')}
      />
      <Option
        title={t('wearer.invite.viewer')}
        detail={t('wearer.invite.viewerDetail')}
        selected={role === 'viewer'}
        onPress={() => setRole('viewer')}
      />
      <View
        accessible
        accessibilityLabel={invite ? t('wearer.invite.codeLabel', { code: invite.code }) : undefined}
        style={{
          borderRadius: theme.radius.lg,
          borderWidth: 1.5,
          borderStyle: 'dashed',
          borderColor: theme.colors.accentSpirit,
          backgroundColor: theme.colors.attentionTint,
          padding: theme.space[4],
          alignItems: 'center',
        }}
      >
        <Text variant="title2" tone="heading" style={{ letterSpacing: 4 }}>
          {invite?.code ?? '…'}
        </Text>
      </View>
      <Text tone="secondary">{t('wearer.invite.expires')}</Text>
      {shared ? <Text tone="secondary">{t('wearer.invite.sent')}</Text> : null}
      {error ? (
        <Text tone="safety" accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
    </FlowShell>
  );
}
