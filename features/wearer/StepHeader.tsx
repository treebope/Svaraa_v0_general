import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { safeBack } from '@/features/nav/safeBack';
import { Button, Text, useTheme } from '@/ui';
import { WEARER_PATH_STEPS } from './steps';

/** Back button, "Step n of 5" (or "Optional") and the screen title, as on every C screen. */
export function StepHeader({ step, title }: { step?: number; title: string }) {
  const theme = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  return (
    <View style={{ gap: theme.space[2] }}>
      <Button label={t('common.back')} variant="tertiary" onPress={() => safeBack(router)} />
      <Text variant="kicker" tone="spirit">
        {step ? t('steps.progress', { current: step, total: WEARER_PATH_STEPS }) : t('wearer.optional')}
      </Text>
      <Text variant="title1" tone="heading" accessibilityRole="header">
        {title}
      </Text>
    </View>
  );
}
