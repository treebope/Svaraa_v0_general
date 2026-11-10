import { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useErrorText } from '@/features/auth/useErrorText';
import { GoogleCancelled, getGoogleCredential, signInWithGoogleToken } from '@/services/auth/authApi';
import { Button, LanguageSwitch, Logo, Screen, Text, useTheme } from '@/ui';

/** A1 · Welcome and sign in. */
export default function Welcome() {
  const theme = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const errorText = useErrorText();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  async function google() {
    setError(undefined);
    setBusy(true);
    try {
      const { idToken, name } = await getGoogleCredential();
      await signInWithGoogleToken(idToken, name);
      router.replace('/');
    } catch (e) {
      if (!(e instanceof GoogleCancelled)) setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen
      footer={
        <>
          {error ? (
            <Text variant="bodySm" tone="safety" accessibilityRole="alert">
              {error}
            </Text>
          ) : null}
          <Button label={t('auth.welcome.google')} onPress={() => void google()} loading={busy} fullWidth />
          {/* TODO(open-items): Terms and Privacy Policy links. See docs/open-items.md */}
          <Button
            label={t('auth.welcome.phone')}
            variant="secondary"
            onPress={() => router.push('/phone')}
            disabled={busy}
            fullWidth
          />
          <Text variant="caption" tone="tertiary" style={{ textAlign: 'center' }}>
            {t('auth.welcome.terms')}
          </Text>
        </>
      }
    >
      <LanguageSwitch />
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          gap: theme.space[4],
          minHeight: 320,
        }}
      >
        <Logo height={72} />
        <Text variant="title1" tone="heading" accessibilityRole="header" style={{ textAlign: 'center' }}>
          {t('auth.welcome.line1')}
          {'\n'}
          <Text variant="title1" tone="accent" italic>
            {t('auth.welcome.line2')}
          </Text>
        </Text>
      </View>
    </Screen>
  );
}
