import { useState } from 'react';
import { Platform, View, type ViewStyle } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useErrorText } from '@/features/auth/useErrorText';
import { useWide } from '@/features/main/useWide';
import { pageBackground, useMainPalette } from '@/features/main/palette';
import { GoogleCancelled, getGoogleCredential, signInWithGoogleToken } from '@/services/auth/authApi';
import { FlowChrome } from '@/features/setup/FlowChrome';
import { Button, Card, Screen, Text, useTheme } from '@/ui';

/** A1 · Welcome and sign in. */
export default function Welcome() {
  const theme = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const errorText = useErrorText();
  const wide = useWide();
  const palette = useMainPalette();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const web = Platform.OS === 'web';

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

  const actions = (
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
  );

  const brandBlock = (
    <View style={{ gap: theme.space[4], width: '100%' }}>
      <Text variant="kicker" tone="spirit">
        {t('auth.welcome.kicker')}
      </Text>
      <Text variant={wide ? 'display' : 'title1'} tone="heading" accessibilityRole="header">
        {t('auth.welcome.line1')}
        {'\n'}
        <Text variant={wide ? 'display' : 'title1'} tone="accent" italic>
          {t('auth.welcome.line2')}
        </Text>
      </Text>
      <Text variant="bodyLg" tone="secondary">
        {t('auth.welcome.subtitle')}
      </Text>
      {web ? (
        <>
          <Text variant="body" tone="secondary">
            {t('auth.welcome.body')}
          </Text>
          <View style={{ gap: theme.space[3], marginTop: theme.space[1] }}>
            {(['recite', 'remind', 'rescue'] as const).map((id) => (
              <View key={id} style={{ flexDirection: 'row', gap: theme.space[3], alignItems: 'flex-start' }}>
                <View
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    marginTop: 7,
                    backgroundColor: theme.colors.accentSpirit,
                  }}
                />
                <Text variant="body" tone="primary" style={{ flex: 1 }}>
                  {t(`auth.welcome.points.${id}`)}
                </Text>
              </View>
            ))}
          </View>
        </>
      ) : null}
    </View>
  );

  if (wide) {
    return (
      <View style={[{ flex: 1, overflow: 'hidden' }, pageBackground(palette)]}>
        <Glow />
        {/* Full-bleed navbar so the logo sits inside the top-left glow. */}
        <View
          style={{
            width: '100%',
            paddingHorizontal: theme.space[6],
            paddingTop: theme.space[5],
            paddingBottom: theme.space[4],
          }}
        >
          <FlowChrome />
        </View>
        <View
          style={{
            flex: 1,
            width: '100%',
            maxWidth: 920,
            alignSelf: 'center',
            paddingHorizontal: theme.space[5],
            paddingBottom: theme.space[5],
            justifyContent: 'center',
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: theme.space[5],
              width: '100%',
            }}
          >
            <View style={{ flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0, maxWidth: 460 }}>
              {brandBlock}
            </View>
            <View style={{ width: '100%', maxWidth: 380, flexShrink: 0 }}>
              <Card style={{ gap: theme.space[4], padding: theme.space[5], width: '100%' }}>
                <View style={{ gap: theme.space[2] }}>
                  <Text variant="title2" tone="heading" accessibilityRole="header">
                    {t('auth.welcome.signInTitle')}
                  </Text>
                  <Text variant="bodySm" tone="secondary">
                    {t('auth.welcome.signInHint')}
                  </Text>
                </View>
                <View style={{ gap: theme.space[2] }}>{actions}</View>
              </Card>
            </View>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View
      style={[
        { flex: 1, overflow: 'hidden' },
        web ? pageBackground(palette) : { backgroundColor: theme.colors.canvas },
      ]}
    >
      {web ? <Glow /> : null}
      <Screen transparent={web} footer={<View style={{ gap: theme.space[2] }}>{actions}</View>}>
        <FlowChrome />
        <View
          style={{
            flex: 1,
            justifyContent: 'center',
            gap: theme.space[4],
            minHeight: web ? 280 : 320,
          }}
        >
          {brandBlock}
        </View>
      </Screen>
    </View>
  );
}

/** Soft brand glow behind the welcome page on web (matches the marketing site atmosphere). */
function Glow() {
  const theme = useTheme();
  const light = theme.scheme === 'light';
  const blob = (extra: ViewStyle): ViewStyle => ({
    position: 'absolute',
    width: 420,
    height: 420,
    borderRadius: 210,
    pointerEvents: 'none',
    ...extra,
  });
  return (
    <>
      <View
        style={blob({
          top: -120,
          left: -80,
          backgroundColor: light ? 'rgba(111,29,71,0.10)' : 'rgba(226,189,114,0.10)',
        })}
      />
      <View
        style={blob({
          bottom: -160,
          right: -100,
          backgroundColor: light ? 'rgba(184,138,68,0.12)' : 'rgba(111,29,71,0.28)',
        })}
      />
    </>
  );
}
