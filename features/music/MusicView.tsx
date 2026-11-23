import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useErrorText } from '@/features/auth/useErrorText';
import { InfoRow, Pill, useMainPalette } from '@/features/main/palette';
import { listTracks, TRACK_CATEGORIES, type Track, type TrackCategory } from '@/services/music/musicApi';
import { Button, Choice, Input, Tabs, Text, useTheme } from '@/ui';
import { MusicScroll } from './MusicScroll';
import { MusicSeekBar } from './MusicSeekBar';
import { NotPlayable, useMusicPlayer } from './player';
import { SpotifyView } from './SpotifyView';
import { YouTubeView } from './YouTubeView';
import { useYouTubePlayer } from './youtubePlayer';

type Category = TrackCategory | 'all';
const SEARCH_DELAY_MS = 500;

type Source = 'songs' | 'spotify' | 'youtube';

/** Music app: Songs, Spotify, and curated YouTube embeds. */
export function MusicView() {
  const { t } = useTranslation();
  const theme = useTheme();
  const source = useYouTubePlayer((s) => s.source);
  const setSource = useYouTubePlayer((s) => s.setSource);
  return (
    <View style={{ gap: theme.space[3] }}>
      <Tabs<Source>
        tabs={[
          { id: 'songs', label: t('music.tabSongs') },
          { id: 'spotify', label: t('music.tabSpotify') },
          { id: 'youtube', label: t('music.tabYouTube') },
        ]}
        value={source}
        onChange={setSource}
      />
      {source === 'songs' ? <SongsTab /> : null}
      {source === 'spotify' ? <SpotifyView /> : null}
      {source === 'youtube' ? <YouTubeView /> : null}
    </View>
  );
}

/** Old film songs and bhajans from the server, with search and a simple player. */
function SongsTab() {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const p = useMainPalette();
  const errorText = useErrorText();
  const [category, setCategory] = useState<Category>('all');
  const [text, setText] = useState('');
  const [search, setSearch] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => setSearch(text.trim()), SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [text]);

  const tracks = useQuery({
    queryKey: ['music', category, search],
    queryFn: () =>
      listTracks({ category: category === 'all' ? undefined : category, q: search || undefined }),
    staleTime: 5 * 60_000,
  });
  const { track: current, status, error, play, pause, resume, stop } = useMusicPlayer();

  /** The title in the app's language when the server has it. */
  const titleOf = (tr: Track) => (i18n.language === 'hi' && tr.title_hi ? tr.title_hi : tr.title);
  const detailOf = (tr: Track) =>
    [
      tr.artist,
      tr.film ? (tr.year ? `${tr.film} (${tr.year})` : tr.film) : null,
      !tr.artist && !tr.film ? t(`music.category.${tr.category}`) : null,
    ]
      .filter(Boolean)
      .join(' · ');

  return (
    <View style={{ gap: theme.space[3] }}>
      {current ? (
        <View
          style={{
            backgroundColor: p.card,
            borderWidth: 1,
            borderColor: p.line,
            borderRadius: 15,
            padding: 14,
            gap: theme.space[2],
          }}
        >
          <Text variant="kicker" style={{ color: p.gold }}>
            {t('music.nowPlaying')}
          </Text>
          <Text style={{ color: p.ink, fontWeight: '700' }}>{titleOf(current)}</Text>
          {detailOf(current) ? (
            <Text variant="bodySm" style={{ color: p.muted }}>
              {detailOf(current)}
            </Text>
          ) : null}
          <Text variant="bodySm" style={{ color: p.muted }} accessibilityLiveRegion="polite">
            {t(`music.status.${status}`)}
          </Text>
          <MusicSeekBar />
          <View style={{ flexDirection: 'row', gap: theme.space[2] }}>
            <View style={{ flex: 1 }}>
              <Button
                label={status === 'paused' ? t('music.play') : t('music.pause')}
                onPress={status === 'paused' ? resume : pause}
                disabled={status === 'loading' || status === 'idle'}
                loading={status === 'loading'}
                fullWidth
              />
            </View>
            <View style={{ flex: 1 }}>
              <Button label={t('music.stop')} variant="secondary" onPress={stop} fullWidth />
            </View>
          </View>
        </View>
      ) : null}
      {error ? (
        <Text tone="safety" accessibilityRole="alert">
          {error instanceof NotPlayable ? t('music.notPlayable') : errorText(error)}
        </Text>
      ) : null}

      <Input
        label={t('music.search.label')}
        placeholder={t('music.search.placeholder')}
        value={text}
        onChangeText={setText}
        onSubmitEditing={() => setSearch(text.trim())}
        returnKeyType="search"
        autoCorrect={false}
      />
      <Choice<Category>
        label={t('music.categoryLabel')}
        value={category}
        onChange={setCategory}
        options={(['all', ...TRACK_CATEGORIES] as Category[]).map((id) => ({
          id,
          label: t(`music.category.${id}`),
        }))}
      />

      {tracks.isPending ? <ActivityIndicator color={p.plum} /> : null}
      {tracks.isError ? (
        <View style={{ gap: theme.space[2] }}>
          <Text tone="safety" accessibilityRole="alert">
            {errorText(tracks.error)}
          </Text>
          <Button
            label={t('music.retry')}
            variant="secondary"
            onPress={() => void tracks.refetch()}
            fullWidth
          />
        </View>
      ) : null}
      {tracks.data && !tracks.data.length ? (
        <Text style={{ color: p.muted }}>
          {search ? t('music.noMatches', { q: search }) : t('music.empty')}
        </Text>
      ) : null}
      {tracks.data?.length ? (
        <Text variant="bodySm" style={{ color: p.muted }}>
          {t('music.count', { n: tracks.data.length })}
        </Text>
      ) : null}
      {tracks.data?.length ? (
        <MusicScroll maxHeight={240}>
          {tracks.data.map((tr) => {
            const playing = current?.id === tr.id && status !== 'idle';
            return (
              <InfoRow
                key={tr.id}
                title={titleOf(tr)}
                detail={detailOf(tr)}
                right={
                  playing ? (
                    <Pill label={t(`music.status.${status}`)} tone="plum" />
                  ) : !tr.stream_url ? (
                    <Pill label={t('music.soon')} />
                  ) : undefined
                }
                onPress={() => void play(tr)}
              />
            );
          })}
        </MusicScroll>
      ) : null}
      <Text variant="bodySm" style={{ color: p.muted }}>
        {t('music.onPhone')}
      </Text>
    </View>
  );
}
