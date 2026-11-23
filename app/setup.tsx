import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useHousehold } from '@/features/household/store';
import { safeBack } from '@/features/nav/safeBack';
import { FlowShell } from '@/features/setup/FlowShell';
import { Button, Card, Text, useTheme } from '@/ui';

/**
 * Placeholder for the setup flow (B to D), built in a later task.
 * The two test buttons let you check that progress is saved and the Home card resumes.
 */
export default function Setup() {
  const theme = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const { setupStep, totalSteps, hasActiveDevice, advance, reset } = useHousehold();
  return (
    <FlowShell>
      <Card style={{ gap: theme.space[4], padding: theme.space[5] }}>
        <Button label={t('common.back')} variant="tertiary" onPress={() => safeBack(router)} />
        <Text variant="kicker" tone="spirit">
          {t('auth.welcome.kicker')}
        </Text>
        <Text variant="title1" tone="heading" accessibilityRole="header">
          {t('setup.title')}
        </Text>
        <Text tone="secondary">{t('setup.stubBody')}</Text>
        <Text variant="heading">{t('home.setup.saved', { current: setupStep, total: totalSteps })}</Text>
        {hasActiveDevice ? <Text tone="secondary">{t('setup.done')}</Text> : null}
        <Button
          label={t('setup.advance')}
          onPress={() => void advance()}
          disabled={hasActiveDevice}
          fullWidth
        />
        <Button label={t('setup.reset')} variant="secondary" onPress={() => void reset()} fullWidth />
      </Card>
    </FlowShell>
  );
}
