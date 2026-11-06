import { Scene } from '@/features/main/Scene';
import { useState } from 'react';
import { View } from 'react-native';
import { Columns, usePageWidth } from '@/features/main/Columns';
import { MainTop } from '@/features/main/TopBar';
import { useWearer } from '@/features/wearer/store';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSettings, type SchemePreference } from '@/features/settings/store';
import { logout } from '@/services/auth/authApi';
import { useSession } from '@/services/auth/session';
import { Button, Card, Choice, LanguageSwitch, ListRow, Screen, Text, useTheme } from '@/ui';

/** Profile tab: account, display settings (theme and language) and sign out. */
export default function Profile() {
  const theme = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const { method, mobile } = useSession();
  const { scheme, setScheme } = useSettings();
  const [busy, setBusy] = useState(false);
  const wearerProfile = useWearer((s) => s.profile);
  const contacts = useWearer((s) => s.contacts);
  const pageWidth = usePageWidth();

  return (
    <Scene>
      <MainTop kind="profile" title={t('tabs.profile')} />
      <Screen bottomInset={false} transparent maxWidth={pageWidth}>
        <Columns
          left={
            <>
              {wearerProfile ? (
                <Card>
                  <Text variant="kicker" tone="spirit">
                    {t('profile.aboutWearer')}
                  </Text>
                  <Text variant="heading">{wearerProfile.call_as || wearerProfile.name}</Text>
                  <Text tone="secondary">{wearerProfile.name}</Text>
                </Card>
              ) : null}

              <Card>
                <Text variant="kicker" tone="spirit">
                  {t('profile.contacts')}
                </Text>
                {contacts.length ? (
                  contacts.map((p, i) => (
                    <Text key={`${p.countryCode}${p.mobile}`}>
                      {i + 1} · {p.name} · {p.countryCode} {p.mobile}
                    </Text>
                  ))
                ) : (
                  <Text tone="secondary">{t('wearerHome.noPeople')}</Text>
                )}
                <Text variant="caption" tone="secondary">
                  {t('profile.laterNote')}
                </Text>
              </Card>
            </>
          }
          right={
            <>
              <Card>
                <Text variant="kicker" tone="spirit">
                  {t('profile.account')}
                </Text>
                <Text>
                  {t('profile.signedInWith')}:{' '}
                  {method === 'google' ? t('profile.google') : t('profile.phone')}
                </Text>
                <Text>
                  {t('profile.mobile')}: {mobile ?? t('profile.mobileNone')}
                </Text>
              </Card>

              <Card>
                <Text variant="kicker" tone="spirit">
                  {t('profile.display')}
                </Text>
                <View style={{ gap: theme.space[2] }}>
                  <Text variant="label" tone="secondary">
                    {t('profile.language')}
                  </Text>
                  <LanguageSwitch />
                </View>
                <View style={{ gap: theme.space[2] }}>
                  <Text variant="label" tone="secondary">
                    {t('profile.scheme')}
                  </Text>
                  <Choice<SchemePreference>
                    label={t('profile.scheme')}
                    value={scheme}
                    onChange={setScheme}
                    options={[
                      { id: 'system', label: t('demo.theme.system') },
                      { id: 'light', label: t('demo.theme.light') },
                      { id: 'dark', label: t('demo.theme.dark') },
                    ]}
                  />
                </View>
              </Card>

              {__DEV__ ? (
                <ListRow title={t('profile.dev')} onPress={() => router.push('/components')} />
              ) : null}

              <Button
                label={t('profile.signOut')}
                variant="secondary"
                loading={busy}
                onPress={() => {
                  setBusy(true);
                  void logout(); // the auth guard then sends the person to sign-in
                }}
                fullWidth
              />
            </>
          }
        />
      </Screen>
    </Scene>
  );
}
