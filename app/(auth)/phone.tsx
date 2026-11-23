import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { PhoneVerify } from '@/features/auth/PhoneVerify';
import { safeBack } from '@/features/nav/safeBack';
import { FlowShell } from '@/features/setup/FlowShell';
import { requestOtp, verifyOtpAndSignIn } from '@/services/auth/authApi';
import { Button, Card, Text, useTheme } from '@/ui';

/** A2 · Phone and OTP (sign-in). */
export default function PhoneSignIn() {
  const theme = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  return (
    <FlowShell>
      <Card style={{ gap: theme.space[4], padding: theme.space[5] }}>
        <Button label={t('common.back')} variant="tertiary" onPress={() => safeBack(router, '/welcome')} />
        <Text variant="kicker" tone="spirit">
          {t('auth.welcome.kicker')}
        </Text>
        <Text variant="title1" tone="heading" accessibilityRole="header">
          {t('auth.phone.title')}
        </Text>
        <Text tone="secondary">{t('auth.phone.subtitle')}</Text>
        <PhoneVerify
          onRequest={requestOtp}
          onVerify={async (phone, code) => void (await verifyOtpAndSignIn(phone, code))}
          onVerified={() => router.replace('/')}
        />
      </Card>
    </FlowShell>
  );
}
