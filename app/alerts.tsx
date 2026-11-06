import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Button, Screen, Text } from '@/ui';

export default function Alerts() {
  const { t } = useTranslation();
  const router = useRouter();
  return (
    <Screen>
      <Button
        label={t('common.back')}
        variant="tertiary"
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/home'))}
      />
      <Text variant="title1" tone="heading" accessibilityRole="header">
        {t('tabs.alerts')}
      </Text>
      <Text tone="secondary">{t('placeholder.comingSoon')}</Text>
    </Screen>
  );
}
