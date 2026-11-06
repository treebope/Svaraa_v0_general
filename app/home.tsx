import { Redirect, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useGreetingName } from '@/features/home/useGreetingName';
import { ProductCard } from '@/features/home/ProductCard';
import { nextSetupRoute, useHousehold } from '@/features/household/store';
import { useWearer } from '@/features/wearer/store';
import { AttentionCard, ListRow, Screen, Text } from '@/ui';

/**
 * A4 · Home before setup. The setup card stays until a pendant is Active, and resumes where the person left off.
 * Once a pendant is Active this screen sends people to the main app (D) instead.
 */
export default function Home() {
  const { t } = useTranslation();
  const router = useRouter();
  const name = useGreetingName();
  const { setupStep, totalSteps, hasActiveDevice, role, notificationsDone } = useHousehold();
  const paired = useWearer((s) => !!s.pendantId);
  const started = setupStep > 0;
  // Continues from what was saved: role first, then that role's next step.
  const openSetup = () => router.push(nextSetupRoute({ role, notificationsDone, setupStep, paired }));

  // Setup is finished: the main app (Apps first, then Chat and My Profile) takes over.
  if (hasActiveDevice) return <Redirect href="/apps" />;

  return (
    <Screen>
      <Text variant="title1" tone="heading" accessibilityRole="header">
        {name ? t('home.greeting', { name }) : t('home.greetingNoName')}
      </Text>

      <>
        <AttentionCard
          severity="attention"
          title={t('home.setup.title')}
          detail={
            started
              ? t('home.setup.saved', { current: setupStep, total: totalSteps })
              : t('home.setup.notStarted')
          }
          action={started ? t('home.setup.continue') : t('home.setup.start')}
          onAction={openSetup}
        />
        {/* Shown while nothing is claimed: covers people who skipped the intro. */}
        <ListRow title={t('home.haveSvaraa')} actionLabel={t('home.start')} onPress={openSetup} />
      </>

      {/* Product story: the pendant, from the marketing site. Opens Explore. */}
      <ProductCard onPress={() => router.navigate('/explore')} />
      <ListRow title={t('home.explore')} onPress={() => router.navigate('/explore')} />
      <ListRow title={t('home.buying')} onPress={() => router.navigate('/explore')} />
    </Screen>
  );
}
