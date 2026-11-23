import type { ReactNode } from 'react';
import { Image, Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Text, useTheme } from '@/ui';

/** Studio product render (black Fold on blush), matched to svaraa.ai. width / height. */
const PHOTO_RATIO = 644 / 582;
/** Soft blush behind the product, same family as the marketing site. */
const STUDIO_BG = { light: '#F6EBE8', dark: '#2A2226' } as const;

/**
 * Product card on Home (A4) and setup shells: the pendant studio shot with its name and one line about it.
 * `fill` grows the card to match a sibling column (equal-height onboarding boxes).
 * `onPress` is optional — without it the card is display-only (setup forms).
 */
export function ProductCard({ onPress, fill }: { onPress?: () => void; fill?: boolean }) {
  const theme = useTheme();
  const { t } = useTranslation();
  const studioBg = STUDIO_BG[theme.scheme];

  const body: ReactNode = (
    <>
      <View
        style={{
          width: '100%',
          aspectRatio: PHOTO_RATIO,
          // When matching a taller form card, the studio area grows; otherwise aspect ratio sets height.
          ...(fill ? { flexGrow: 1, flexShrink: 1, minHeight: 0 } : null),
          backgroundColor: studioBg,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Image
          source={require('../../assets/story/pendant-product.png')}
          accessibilityRole="image"
          accessibilityLabel={t('home.product.alt')}
          resizeMode="contain"
          style={{ width: '100%', height: '100%' }}
        />
      </View>
      <View style={{ padding: theme.space[4], gap: theme.space[1] }}>
        <Text variant="heading" tone="heading">
          {t('home.product.name')}
        </Text>
        <Text variant="bodySm" tone="secondary">
          {t('home.product.body')}
        </Text>
      </View>
    </>
  );

  const frame = {
    alignSelf: 'stretch' as const,
    width: '100%' as const,
    ...(fill ? { flex: 1 } : null),
    overflow: 'hidden' as const,
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
    backgroundColor: theme.colors.surfaceSolid,
  };

  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${t('home.product.name')}. ${t('home.product.body')}`}
        onPress={onPress}
        style={frame}
      >
        {body}
      </Pressable>
    );
  }

  return (
    <View
      accessible
      accessibilityLabel={`${t('home.product.name')}. ${t('home.product.body')}`}
      style={frame}
    >
      {body}
    </View>
  );
}
