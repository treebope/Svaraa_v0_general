import { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { env } from '@/config/env';
import { toApiError, type ApiError } from '@/services/api';
import type { PhoneNumber } from '@/services/auth/authApi';
import { Button, Input, OTP_LENGTH, OTPInput, Select, Text, useTheme } from '@/ui';
import { COUNTRIES, DEFAULT_COUNTRY, dialCode, type CountryId } from './countries';
import { formatClock, useCooldown } from './useCooldown';
import { useErrorText } from './useErrorText';

/** The server asks for a 60 s wait between codes. */
const COOLDOWN_SECONDS = 60;

/**
 * Phone number and code, in one form. Used for sign-in (A2) and for "Add your phone" after Google sign-in.
 * It does not know which API it talks to: the screen passes `onRequest` and `onVerify`.
 */
export function PhoneVerify({
  onRequest,
  onVerify,
  onVerified,
}: {
  onRequest(phone: PhoneNumber): Promise<void>;
  onVerify(phone: PhoneNumber, code: string): Promise<void>;
  onVerified: () => void;
}) {
  const theme = useTheme();
  const { t } = useTranslation();
  const errorText = useErrorText();
  const { remaining, start } = useCooldown();
  const [country, setCountry] = useState<CountryId>(DEFAULT_COUNTRY);
  const [mobile, setMobile] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState<'send' | 'verify' | null>(null);
  const [error, setError] = useState<string>();

  const phone = (): PhoneNumber => ({ countryCode: dialCode(country), mobile: mobile.replace(/\D/g, '') });
  const canSend = mobile.replace(/\D/g, '').length >= 6;

  async function send() {
    setError(undefined);
    setBusy('send');
    try {
      await onRequest(phone());
      setSent(true);
      setCode('');
      start(COOLDOWN_SECONDS);
    } catch (e) {
      const err: ApiError = toApiError(e);
      // The server is still counting its own wait: show the timer rather than only an error.
      if (err.code === 'otp_cooldown') {
        setSent(true);
        start(COOLDOWN_SECONDS);
      }
      setError(errorText(err));
    } finally {
      setBusy(null);
    }
  }

  async function verify(value = code) {
    if (value.length < OTP_LENGTH || busy) return;
    setError(undefined);
    setBusy('verify');
    try {
      await onVerify(phone(), value);
      onVerified();
    } catch (e) {
      setError(errorText(e));
      setCode('');
    } finally {
      setBusy(null);
    }
  }

  return (
    <View style={{ gap: theme.space[4] }}>
      <Select
        label={t('auth.phone.country')}
        title={t('auth.phone.country')}
        value={country}
        onChange={setCountry}
        disabled={sent}
        options={COUNTRIES.map((c) => ({ id: c.id, label: `${t(`countries.${c.id}`)} (${c.dial})` }))}
      />
      <Input
        label={t('auth.phone.mobile')}
        value={mobile}
        onChangeText={(v) => setMobile(v.replace(/[^\d ]/g, ''))}
        keyboardType="number-pad"
        textContentType="telephoneNumber"
        autoComplete="tel"
        editable={!sent}
        maxLength={15}
        error={!sent ? error : undefined}
      />
      {!sent ? (
        <Button
          label={t('auth.phone.sendOtp')}
          onPress={() => void send()}
          disabled={!canSend}
          loading={busy === 'send'}
          fullWidth
        />
      ) : (
        <View style={{ gap: theme.space[4] }}>
          <Text tone="secondary">{t('otp.sent', { to: `${dialCode(country)} ${mobile}` })}</Text>
          <OTPInput value={code} onChange={setCode} error={error} autoFocus />
          {remaining > 0 ? (
            <Text tone="tertiary" accessibilityLiveRegion="polite">
              {t('otp.resendIn', { time: formatClock(remaining) })}
            </Text>
          ) : (
            <Button
              label={t('otp.resend')}
              variant="tertiary"
              onPress={() => void send()}
              loading={busy === 'send'}
            />
          )}
          <Button
            label={t('otp.verify')}
            onPress={() => void verify()}
            disabled={code.length < OTP_LENGTH}
            loading={busy === 'verify'}
            fullWidth
          />
          <Button
            label={t('auth.phone.changeNumber')}
            variant="tertiary"
            onPress={() => {
              setSent(false);
              setCode('');
              setError(undefined);
            }}
          />
        </View>
      )}
      {env.useMocks ? (
        <Text variant="caption" tone="tertiary">
          {t('auth.phone.devHint')}
        </Text>
      ) : null}
    </View>
  );
}
