import { createElement } from 'react';
import { Image, Linking, Platform, Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useMainPalette } from '@/features/main/palette';
import { Text } from '@/ui';
import {
  YOUTUBE_PLAYER_HEIGHT,
  youtubeEmbedUrl,
  youtubeThumbUrl,
  youtubeWatchUrl,
  type YoutubeVideo,
} from './youtubeCatalog';

const ALLOW =
  'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
/** DOM tag for the official YouTube player on web (string kept separate for i18n:check). */
const WEB_PLAYER_TAG = 'iframe';

/** Official YouTube player strip (~4 cm tall, full row width; controls + scrubber). */
export function YouTubeEmbed({ video, autoplay }: { video: YoutubeVideo; autoplay?: boolean }) {
  const { t } = useTranslation();
  const p = useMainPalette();
  const embed = youtubeEmbedUrl(video, { autoplay });

  return (
    <View
      style={{
        width: '100%',
        height: YOUTUBE_PLAYER_HEIGHT,
        borderRadius: 12,
        overflow: 'hidden',
        backgroundColor: '#0B0A0C',
        borderWidth: 1,
        borderColor: p.line2,
      }}
    >
      {Platform.OS === 'web' ? (
        createElement(WEB_PLAYER_TAG, {
          src: embed,
          title: video.title,
          width: '100%',
          height: '100%',
          style: {
            border: 'none',
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
          },
          allow: ALLOW,
          referrerPolicy: 'strict-origin-when-cross-origin',
          allowFullScreen: true,
        })
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('music.youtube.open', { title: video.title })}
          onPress={() => void Linking.openURL(youtubeWatchUrl(video))}
          style={{ flex: 1 }}
        >
          <Image
            source={{ uri: youtubeThumbUrl(video) }}
            accessibilityIgnoresInvertColors
            style={{ width: '100%', height: '100%' }}
            resizeMode="cover"
          />
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: 0,
              right: 0,
              bottom: 0,
              left: 0,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'rgba(10,8,12,0.35)',
            }}
          >
            <View
              style={{
                width: 56,
                height: 56,
                borderRadius: 28,
                backgroundColor: 'rgba(255,255,255,0.92)',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <View
                style={{
                  marginLeft: 4,
                  width: 0,
                  height: 0,
                  borderTopWidth: 9,
                  borderBottomWidth: 9,
                  borderLeftWidth: 14,
                  borderTopColor: 'transparent',
                  borderBottomColor: 'transparent',
                  borderLeftColor: p.plum,
                }}
              />
            </View>
            <Text
              variant="bodySm"
              style={{
                color: '#FFF',
                marginTop: 8,
                fontWeight: '600',
                textShadowColor: '#000',
                textShadowRadius: 6,
              }}
            >
              {t('music.youtube.tapToPlay')}
            </Text>
          </View>
        </Pressable>
      )}
    </View>
  );
}
