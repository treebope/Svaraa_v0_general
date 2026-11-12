import { useEffect, useRef } from 'react';
import { TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Text } from './Text';
import { useTheme } from './ThemeProvider';
import { fontFamily } from './fonts';

/** Digits in a sign-in code. The backend sends 4-digit codes (the dev server's test code is 0000). */
export const OTP_LENGTH = 4;

/**
 * One-time code field: a box per digit, backed by a single hidden-ish input so paste and SMS autofill work.
 * `onComplete` fires once all digits are entered.
 */
export function OTPInput({
  value,
  onChange,
  length = OTP_LENGTH,
  error,
  autoFocus,
  onComplete,
}: {
  value: string;
  onChange: (next: string) => void;
  length?: number;
  error?: string;
  autoFocus?: boolean;
  onComplete?: (code: string) => void;
}) {
  const theme = useTheme();
  const { t, i18n } = useTranslation();
  const c = theme.colors;
  const complete = useRef(onComplete);
  // Keep the latest callback without re-running the check below when only the callback changes.
  useEffect(() => {
    complete.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    if (value.length === length) complete.current?.(value);
  }, [value, length]);

  const size = Math.max(theme.minTarget, 48);
  const font = theme.typeScale.title2;
  return (
    <View style={{ gap: theme.space[2] }}>
      <View>
        <View style={{ flexDirection: 'row', gap: theme.space[2] }} pointerEvents="none">
          {Array.from({ length }, (_, i) => {
            const active = i === Math.min(value.length, length - 1);
            return (
              <View
                key={i}
                style={{
                  width: size,
                  height: size + 8,
                  borderRadius: theme.radius.md,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: c.surfaceSolid,
                  borderWidth: active || error ? 2 : 1,
                  borderColor: error ? c.safety : active ? c.focus : c.border,
                }}
              >
                <Text variant="title2" tone="heading">
                  {value[i] ?? ''}
                </Text>
              </View>
            );
          })}
        </View>
        <TextInput
          value={value}
          onChangeText={(text) => onChange(text.replace(/\D/g, '').slice(0, length))}
          keyboardType="number-pad"
          textContentType="oneTimeCode"
          autoComplete="sms-otp"
          maxLength={length}
          autoFocus={autoFocus}
          accessibilityLabel={t('otp.label')}
          accessibilityHint={t('otp.digit', { n: Math.min(value.length + 1, length), total: length })}
          caretHidden
          style={{
            position: 'absolute',
            inset: 0,
            opacity: 0.02,
            fontFamily: fontFamily(i18n.language, font),
            fontSize: font.size,
          }}
        />
      </View>
      {error ? (
        <Text variant="bodySm" tone="safety" accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
    </View>
  );
}
