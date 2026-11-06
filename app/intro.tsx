import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, FlatList, View, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { AUTO_ADVANCE_MS, SLIDE_SETTLE_MS, STORIES, STORY_IMAGE_RATIO } from '@/features/intro/stories';
import { useSession } from '@/services/auth/session';
import { Button, Screen, Text, useTheme } from '@/ui';

/** The stories, then the first again at the end (see the effect in Intro). */
const LOOP = [...STORIES, STORIES[0]];

/**
 * A3 · Intro: swipe through how setup works, in four steps (claim, pair, contacts, SOS test).
 * Shown once after a new account is created. Every way out ends the intro.
 */
export default function Intro() {
  const theme = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const { width } = useWindowDimensions();
  // The width really available, measured on the phone. (The sum below is only the starting guess.)
  const [measured, setMeasured] = useState(0);
  const pageWidth = measured || Math.min(width, 520) - (theme.space[4] + theme.space[1]) * 2;
  // The step card is a little narrower than the page and centred.
  const imageWidth = Math.min(Math.round(pageWidth * 0.86), 340);
  // 0 to 3 are the four steps; 4 is a copy of the first, placed after the last so the loop only ever moves forward.
  const [index, setIndex] = useState(0);
  const page = index % STORIES.length;
  const list = useRef<FlatList>(null);
  const [touching, setTouching] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
  }, []);

  // Always moves forward, every 2.5 s. After the last story it slides on to the copy of the first, then jumps back
  // to the real first without animation (the two look the same), so it never scrolls backwards through the others.
  // Waits while a finger is on it, and starts a fresh 2.5 s after any swipe. Off when the phone asks for reduced motion.
  useEffect(() => {
    if (touching) return;
    if (index === STORIES.length) {
      const id = setTimeout(() => {
        list.current?.scrollToIndex({ index: 0, animated: false });
        setIndex(0);
      }, SLIDE_SETTLE_MS);
      return () => clearTimeout(id);
    }
    if (reduceMotion) return;
    const id = setTimeout(() => {
      list.current?.scrollToIndex({ index: index + 1, animated: true });
      setIndex(index + 1);
    }, AUTO_ADVANCE_MS);
    return () => clearTimeout(id);
  }, [index, touching, reduceMotion]);

  const leave = (then: () => void) => {
    useSession.getState().finishIntro();
    router.replace('/home');
    then();
  };

  return (
    <Screen
      footer={
        <>
          <Button label={t('intro.haveSvaraa')} onPress={() => leave(() => undefined)} fullWidth />
          <Button
            label={t('intro.explore')}
            variant="secondary"
            onPress={() => leave(() => router.navigate('/explore'))}
            fullWidth
          />
          <Button
            label={t('intro.skip')}
            variant="tertiary"
            onPress={() => leave(() => undefined)}
            fullWidth
          />
        </>
      }
    >
      {/* flexShrink 0: a horizontal list shrinks by default on a phone, which cut the bottom off the cards. */}
      <View
        onLayout={(e) => setMeasured(Math.floor(e.nativeEvent.layout.width))}
        style={{ flexGrow: 1, flexShrink: 0, justifyContent: 'center', gap: theme.space[4] }}
      >
        <FlatList
          ref={list}
          data={LOOP}
          keyExtractor={(story, i) => `${story.id}-${i}`}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          snapToInterval={pageWidth}
          decelerationRate="fast"
          getItemLayout={(_, index) => ({ length: pageWidth, offset: pageWidth * index, index })}
          onScrollBeginDrag={() => setTouching(true)}
          onMomentumScrollEnd={(e) => {
            setIndex(Math.round(e.nativeEvent.contentOffset.x / pageWidth));
            setTouching(false);
          }}
          // The list is exactly one page wide, so every page lines up with the screen.
          style={{ flexGrow: 0, flexShrink: 0, width: pageWidth, alignSelf: 'center' }}
          renderItem={({ item, index: at }) => {
            const key = `intro.story.${item.id}`;
            const isCopy = at === STORIES.length;
            return (
              <View
                style={{ width: pageWidth, gap: theme.space[3], flexShrink: 0, alignItems: 'center' }}
                // The copy of the first story is only for the loop: screen readers skip it.
                accessibilityElementsHidden={isCopy}
                importantForAccessibility={isCopy ? 'no-hide-descendants' : 'auto'}
              >
                {/* Placeholder until real illustrations exist: a quiet card with the step number. */}
                <View
                  accessibilityElementsHidden
                  importantForAccessibility="no-hide-descendants"
                  style={{
                    width: imageWidth,
                    height: imageWidth / STORY_IMAGE_RATIO,
                    flexShrink: 0,
                    borderRadius: theme.radius.lg,
                    backgroundColor: theme.colors.sunken,
                    borderWidth: 1,
                    borderColor: theme.colors.borderSubtle,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text variant="display" tone="heading">
                    {String((at % STORIES.length) + 1).padStart(2, '0')}
                  </Text>
                </View>
                <View
                  accessible
                  accessibilityRole="header"
                  style={{ gap: theme.space[2], alignItems: 'center' }}
                >
                  <Text variant="kicker" tone="spirit" style={{ textAlign: 'center' }}>
                    {String((at % STORIES.length) + 1).padStart(2, '0')} · {t(`${key}.label`)}
                  </Text>
                  <Text variant="title2" tone="heading" style={{ textAlign: 'center' }}>
                    {t(`${key}.lead`)}
                  </Text>
                </View>
                <Text tone="secondary" style={{ textAlign: 'center' }}>
                  {t(`${key}.sub`)}
                </Text>
              </View>
            );
          }}
        />
        <View
          accessible
          accessibilityLabel={t('intro.page', { n: page + 1, total: STORIES.length })}
          style={{ flexDirection: 'row', gap: theme.space[2], justifyContent: 'center' }}
        >
          {STORIES.map((story, i) => (
            <View
              key={story.id}
              style={{
                width: i === page ? 18 : 6,
                height: 6,
                borderRadius: 3,
                backgroundColor: i === page ? theme.colors.action : theme.colors.border,
              }}
            />
          ))}
        </View>
      </View>
    </Screen>
  );
}
