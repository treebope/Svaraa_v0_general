import { Image, Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Pill, useMainPalette } from '@/features/main/palette';
import { glassStyle, Text, useTheme } from '@/ui';
import { MusicScroll } from './MusicScroll';
import { YouTubeEmbed } from './YouTubeEmbed';
import { YOUTUBE_VIDEOS, youtubeThumbUrl, type YoutubeVideo } from './youtubeCatalog';
import { useYouTubePlayer } from './youtubePlayer';

/** Music > YouTube: curated embeds play inline; chat can drive the same store. */
export function YouTubeView() {
  const { t } = useTranslation();
  const theme = useTheme();
  const p = useMainPalette();
  const activeId = useYouTubePlayer((s) => s.activeId);
  const play = useYouTubePlayer((s) => s.play);

  return (
    <View style={{ gap: theme.space[3] }}>
      <Text variant="bodySm" style={{ color: p.muted }}>
        {t('music.youtube.intro')}
      </Text>

      <Text variant="kicker" style={{ color: p.gold }}>
        {t('music.youtube.collection')}
      </Text>

      <MusicScroll maxHeight={320}>
        {YOUTUBE_VIDEOS.map((video) => {
          const selected = video.id === activeId;
          return (
            <VideoRow key={video.id} video={video} selected={selected} onSelect={() => play(video.id)} />
          );
        })}
      </MusicScroll>

      <Text variant="bodySm" style={{ color: p.muted }}>
        {t('music.youtube.footer')}
      </Text>
    </View>
  );
}

function VideoRow({
  video,
  selected,
  onSelect,
}: {
  video: YoutubeVideo;
  selected: boolean;
  onSelect: () => void;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const p = useMainPalette();

  if (selected) {
    return (
      <View
        style={[
          glassStyle({
            scheme: theme.scheme,
            fill: p.plumSoft,
            border: p.line2,
            kind: 'tile',
            radius: 16,
          }),
          { padding: 10, gap: 10 },
        ]}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={{ color: p.ink, fontWeight: '700' }} numberOfLines={2}>
              {video.title}
            </Text>
            <Text variant="bodySm" style={{ color: p.muted }} numberOfLines={1}>
              {video.channel}
            </Text>
          </View>
          <Pill label={t('music.youtube.playing')} tone="plum" />
        </View>
        <YouTubeEmbed video={video} autoplay />
      </View>
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: false }}
      accessibilityLabel={video.title}
      onPress={onSelect}
      style={[
        glassStyle({
          scheme: theme.scheme,
          fill: p.card,
          border: p.line,
          kind: 'tile',
          radius: 16,
        }),
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          padding: 10,
          minHeight: theme.minTarget,
        },
      ]}
    >
      <View
        style={{
          width: 96,
          aspectRatio: 16 / 9,
          borderRadius: 10,
          overflow: 'hidden',
          backgroundColor: '#1A1518',
          borderWidth: 1,
          borderColor: p.line2,
        }}
      >
        <Image
          source={{ uri: youtubeThumbUrl(video) }}
          accessibilityIgnoresInvertColors
          style={{ width: '100%', height: '100%' }}
          resizeMode="cover"
        />
      </View>
      <View style={{ flex: 1, gap: 3 }}>
        <Text style={{ color: p.ink, fontWeight: '600' }} numberOfLines={2}>
          {video.title}
        </Text>
        <Text variant="bodySm" style={{ color: p.muted }} numberOfLines={1}>
          {video.channel}
        </Text>
      </View>
    </Pressable>
  );
}
