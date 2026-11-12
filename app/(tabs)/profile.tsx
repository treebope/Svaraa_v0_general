import { Scene } from '@/features/main/Scene';
import { useState } from 'react';
import { View } from 'react-native';
import { Columns, usePageWidth } from '@/features/main/Columns';
import { Pill } from '@/features/main/palette';
import { ProfileField } from '@/features/main/ProfileField';
import { MainTop } from '@/features/main/TopBar';
import { usePendantStatus } from '@/features/pendant/store';
import { useWearer } from '@/features/wearer/store';
import { ageFromIso, isoToDobInput } from '@/features/wearer/dateOfBirth';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSettings, type SchemePreference } from '@/features/settings/store';
import { logout } from '@/services/auth/authApi';
import { MAX_CONTACTS } from '@/services/household/wearerApi';
import { useSession } from '@/services/auth/session';
import { Button, Card, Choice, LanguageSwitch, ListRow, Screen, Text, useTheme } from '@/ui';

/**
 * My Profile: everything about the person in one place. About you (what they gave in setup), emergency contacts,
 * the pendant, the sign-in details, and Settings (display and language). Sign out is at the end.
 */
export default function Profile() {
  const theme = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const { method, mobile } = useSession();
  const { scheme, setScheme } = useSettings();
  const [busy, setBusy] = useState(false);
  const profile = useWearer((s) => s.profile);
  const contacts = useWearer((s) => s.contacts);
  const { connection, battery } = usePendantStatus();
  const pageWidth = usePageWidth();
  const age = ageFromIso(profile?.date_of_birth);
  const connected = connection === 'connected';

  return (
    <Scene>
      <MainTop kind="profile" title={t('tabs.profile')} />
      <Screen bottomInset={false} transparent maxWidth={pageWidth}>
        <Columns
          left={
            <>
              <Card>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text variant="kicker" tone="spirit">
                    {t('profile.aboutYou')}
                  </Text>
                  {profile ? (
                    <Button
                      label={t('profile.edit')}
                      variant="tertiary"
                      size="sm"
                      onPress={() => router.push('/edit-profile')}
                    />
                  ) : null}
                </View>
                {profile ? (
                  <>
                    <ProfileField label={t('profile.name')} value={profile.name} />
                    <ProfileField
                      label={t('profile.callAs')}
                      value={profile.call_as || t('profile.notAdded')}
                    />
                    <ProfileField
                      label={t('profile.dob')}
                      value={
                        profile.date_of_birth
                          ? `${isoToDobInput(profile.date_of_birth)}${age === undefined ? '' : ` · ${t('profile.age', { count: age })}`}`
                          : t('profile.notAdded')
                      }
                    />
                    <ProfileField
                      label={t('profile.voiceLanguages')}
                      value={profile.languages.map((l) => t(`languages.${l}`)).join(', ')}
                    />
                    <ProfileField
                      label={t('profile.notes')}
                      value={profile.health_notes || t('profile.notAdded')}
                    />
                    <ProfileField
                      label={t('profile.pacemaker')}
                      value={t(profile.pacemaker ? 'profile.yes' : 'profile.no')}
                    />
                  </>
                ) : (
                  <Text tone="secondary">{t('profile.notAdded')}</Text>
                )}
              </Card>

              <Card>
                <Text variant="kicker" tone="spirit">
                  {t('profile.contacts')}
                </Text>
                {contacts.length ? (
                  contacts.map((p, i) => (
                    <ListRow
                      key={`${p.countryCode}${p.mobile}`}
                      title={`${i + 1} · ${p.name}`}
                      detail={[p.relationship, `${p.countryCode} ${p.mobile}`].filter(Boolean).join(' · ')}
                      actionLabel={t('profile.editContacts')}
                      onPress={() =>
                        router.push({
                          pathname: '/wearer/contact',
                          params: { index: String(i), from: 'profile' },
                        })
                      }
                    />
                  ))
                ) : (
                  <Text tone="secondary">{t('wearerHome.noPeople')}</Text>
                )}
                {contacts.length < MAX_CONTACTS ? (
                  <Button
                    label={t('profile.addContact')}
                    variant="secondary"
                    onPress={() => router.push({ pathname: '/wearer/contact', params: { from: 'profile' } })}
                    fullWidth
                  />
                ) : null}
                <Text variant="caption" tone="secondary">
                  {t('profile.contactsLimit', { max: MAX_CONTACTS })}
                </Text>
              </Card>

              <Card>
                <Text variant="kicker" tone="spirit">
                  {t('profile.apps')}
                </Text>
                <ListRow
                  title={t('manage.title')}
                  detail={t('profile.manageAppsDetail')}
                  actionLabel={t('manage.title')}
                  onPress={() => router.push('/manage-apps')}
                />
              </Card>

              <Card>
                <Text variant="kicker" tone="spirit">
                  {t('profile.pendant')}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space[2] }}>
                  <Pill
                    label={t(connected ? 'pendant.connected' : 'pendant.notConnected')}
                    tone={connected ? 'good' : 'plain'}
                  />
                  {connected && battery !== undefined ? <Text tone="secondary">{`${battery}%`}</Text> : null}
                </View>
              </Card>
            </>
          }
          right={
            <>
              <Card>
                <Text variant="kicker" tone="spirit">
                  {t('profile.account')}
                </Text>
                <ProfileField
                  label={t('profile.signedInWith')}
                  value={method === 'google' ? t('profile.google') : t('profile.phone')}
                />
                <ProfileField label={t('profile.mobile')} value={mobile ?? t('profile.mobileNone')} />
              </Card>

              <Card>
                <Text variant="kicker" tone="spirit">
                  {t('profile.settings')}
                </Text>
                <View style={{ gap: theme.space[2] }}>
                  <Text variant="label" tone="secondary">
                    {t('profile.scheme')}
                  </Text>
                  <Choice<SchemePreference>
                    label={t('profile.scheme')}
                    value={scheme}
                    onChange={setScheme}
                    options={[
                      { id: 'light', label: t('demo.theme.light') },
                      { id: 'dark', label: t('demo.theme.dark') },
                      { id: 'system', label: t('demo.theme.system') },
                    ]}
                  />
                </View>
                <View style={{ gap: theme.space[2] }}>
                  <Text variant="label" tone="secondary">
                    {t('profile.language')}
                  </Text>
                  <LanguageSwitch />
                  <Text variant="caption" tone="secondary">
                    {t('profile.languageHint')}
                  </Text>
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
