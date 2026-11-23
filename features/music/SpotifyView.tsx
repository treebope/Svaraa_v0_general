import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, useWindowDimensions, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useErrorText } from '@/features/auth/useErrorText';
import { InfoRow, Pill, useMainPalette } from '@/features/main/palette';
import { openSpotifyLogin } from '@/services/spotify/openLogin';
import {
  disconnectSpotify,
  getLoginUrl,
  getNowPlaying,
  getSpotifyStatus,
  playItem,
  sendPlayerCommand,
  type PlayerAction,
} from '@/services/spotify/spotifyApi';
import { Button, Text, glassStyle, useTheme } from '@/ui';
import { MusicScroll, MUSIC_SECTION_HEIGHT } from './MusicScroll';
import { SpotifyBrowse } from './SpotifyBrowse';
import { SPOTIFY_BLACK, SPOTIFY_GREEN, SPOTIFY_GREEN_PRESSED, SpotifyLogo } from './SpotifyLogo';

const VOLUME_STEP = 10;
/** After Connect, check this often (and for this long) in case the phone's browser cannot say when it closed. */
const CONNECT_POLL_MS = 3000;
const CONNECT_POLL_FOR_MS = 2 * 60_000;
/** While something plays, refresh the mini player this often. */
const NOW_PLAYING_POLL_MS = 5000;

const STATUS_KEY = ['spotify', 'status'] as const;
const NOW_KEY = ['spotify', 'now-playing'] as const;

/** Room left under Music chrome (tabs + Apps header + bottom nav). */
function useSpotifyPaneHeight(): number {
  const { height } = useWindowDimensions();
  // Dynamic: shrinks on short screens, caps so it does not force the Apps page to scroll.
  return Math.round(Math.min(Math.max(height - 250, 300), Math.min(height * 0.62, 520)));
}

/** Music > Spotify tab: connect a Spotify account to this phone, see what plays, and use the player buttons. */
export function SpotifyView() {
  const { t } = useTranslation();
  const theme = useTheme();
  const p = useMainPalette();
  const errorText = useErrorText();
  const queryClient = useQueryClient();
  const paneH = useSpotifyPaneHeight();
  // After Connect, keep asking the server for a while whether Spotify is linked (see CONNECT_POLL_FOR_MS).
  const [waiting, setWaiting] = useState(false);
  useEffect(() => {
    if (!waiting) return;
    const timer = setTimeout(() => setWaiting(false), CONNECT_POLL_FOR_MS);
    return () => clearTimeout(timer);
  }, [waiting]);

  const status = useQuery({
    queryKey: STATUS_KEY,
    queryFn: getSpotifyStatus,
    refetchInterval: (q) => (waiting && !q.state.data?.connected ? CONNECT_POLL_MS : false),
    refetchOnWindowFocus: true,
  });
  const connected = status.data?.connected === true;

  const nowPlaying = useQuery({
    queryKey: NOW_KEY,
    queryFn: getNowPlaying,
    enabled: connected,
    refetchInterval: (q) => (q.state.data?.is_playing ? NOW_PLAYING_POLL_MS : false),
  });

  const connect = useMutation({
    mutationFn: async () => {
      const url = await getLoginUrl();
      setWaiting(true);
      await openSpotifyLogin(url);
    },
    // The browser has closed (or never opened): ask the server whether Spotify is now linked.
    onSettled: () => void queryClient.invalidateQueries({ queryKey: STATUS_KEY }),
  });
  const command = useMutation({
    mutationFn: ({ action, volume }: { action: PlayerAction; volume?: number }) =>
      sendPlayerCommand(action, volume),
    onSuccess: (out) => queryClient.setQueryData(NOW_KEY, out),
  });
  const playCard = useMutation({
    mutationFn: ({ uri, context }: { uri: string; context?: string }) => playItem(uri, context),
    onSuccess: (out) => queryClient.setQueryData(NOW_KEY, out),
  });
  const disconnect = useMutation({
    mutationFn: disconnectSpotify,
    onSuccess: () => {
      setWaiting(false);
      queryClient.removeQueries({ queryKey: NOW_KEY });
      void queryClient.invalidateQueries({ queryKey: STATUS_KEY });
    },
  });

  if (status.isPending) return <ActivityIndicator color={p.plum} />;

  if (status.isError)
    return (
      <View style={{ gap: theme.space[2] }}>
        <Text tone="safety" accessibilityRole="alert">
          {errorText(status.error)}
        </Text>
        <Button
          label={t('music.retry')}
          variant="secondary"
          onPress={() => void status.refetch()}
          fullWidth
        />
      </View>
    );

  // Pre-connect: fixed pane, no scroll — layout flexes to the available height.
  if (!connected)
    return (
      <SpotifyConnectCard
        height={paneH}
        waiting={waiting}
        loading={connect.isPending}
        error={connect.isError ? errorText(connect.error) : null}
        onConnect={() => connect.mutate()}
      />
    );

  const now = nowPlaying.data;
  const premium = status.data?.product === 'premium';
  const devices = status.data?.devices ?? [];
  const busy = command.isPending || playCard.isPending;
  const press = (action: PlayerAction, volume?: number) => command.mutate({ action, volume });
  const volume = now?.volume_percent;

  // Connected: same pane height, scroll only when library / devices need it.
  return (
    <MusicScroll
      maxHeight={paneH || MUSIC_SECTION_HEIGHT}
      framed
      contentContainerStyle={{ gap: theme.space[3], padding: 10 }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space[2] }}>
        <Text style={{ color: p.ink, fontWeight: '700', flexShrink: 1 }}>
          {t('music.spotify.connectedAs', { name: status.data?.display_name ?? 'Spotify' })}
        </Text>
        <Pill label={t('music.spotify.connected')} tone="plum" />
      </View>
      {!premium ? (
        <Text variant="bodySm" style={{ color: p.muted }}>
          {t('music.spotify.needsPremium')}
        </Text>
      ) : null}

      {status.data?.needs_reconnect ? (
        <View style={{ gap: theme.space[2] }}>
          <Text variant="bodySm" style={{ color: p.muted }}>
            {t('music.spotify.needsReconnect')}
          </Text>
          <Button
            label={t('music.spotify.reconnect')}
            variant="secondary"
            onPress={() => connect.mutate()}
            loading={connect.isPending}
            fullWidth
          />
        </View>
      ) : null}

      <View
        style={[
          glassStyle({
            scheme: theme.scheme,
            fill: p.card,
            border: p.line,
            kind: 'card',
            radius: 18,
          }),
          { padding: 16, gap: theme.space[2] },
        ]}
      >
        <Text variant="kicker" style={{ color: p.gold }}>
          {t('music.spotify.nowPlaying')}
        </Text>
        {now?.track ? (
          <>
            <Text style={{ color: p.ink, fontWeight: '700' }}>{now.track.name}</Text>
            <Text variant="bodySm" style={{ color: p.muted }}>
              {[now.track.artists, now.track.album].filter(Boolean).join(' · ')}
            </Text>
          </>
        ) : nowPlaying.isPending ? (
          <ActivityIndicator color={p.plum} />
        ) : (
          <Text variant="bodySm" style={{ color: p.muted }}>
            {t('music.spotify.nothingPlaying')}
          </Text>
        )}
        {now?.device ? (
          <Text variant="bodySm" style={{ color: p.muted }}>
            {t('music.spotify.onDevice', { name: now.device.name })}
          </Text>
        ) : null}
        <View style={{ flexDirection: 'row', gap: theme.space[2] }}>
          <View style={{ flex: 1 }}>
            <Button
              label={t('music.spotify.previous')}
              variant="secondary"
              onPress={() => press('previous')}
              disabled={busy || !premium}
              fullWidth
            />
          </View>
          <View style={{ flex: 1 }}>
            <Button
              label={now?.is_playing ? t('music.pause') : t('music.play')}
              onPress={() => press(now?.is_playing ? 'pause' : 'play')}
              disabled={!premium}
              loading={busy}
              fullWidth
            />
          </View>
          <View style={{ flex: 1 }}>
            <Button
              label={t('music.spotify.next')}
              variant="secondary"
              onPress={() => press('next')}
              disabled={busy || !premium}
              fullWidth
            />
          </View>
        </View>
        {typeof volume === 'number' ? (
          <View style={{ gap: theme.space[2] }}>
            <Text variant="bodySm" style={{ color: p.muted }} accessibilityLiveRegion="polite">
              {t('music.spotify.volume', { n: volume })}
            </Text>
            <View style={{ flexDirection: 'row', gap: theme.space[2] }}>
              <View style={{ flex: 1 }}>
                <Button
                  label={t('music.spotify.quieter')}
                  variant="secondary"
                  onPress={() => press('volume', Math.max(0, volume - VOLUME_STEP))}
                  disabled={busy || !premium || volume <= 0}
                  fullWidth
                />
              </View>
              <View style={{ flex: 1 }}>
                <Button
                  label={t('music.spotify.louder')}
                  variant="secondary"
                  onPress={() => press('volume', Math.min(100, volume + VOLUME_STEP))}
                  disabled={busy || !premium || volume >= 100}
                  fullWidth
                />
              </View>
            </View>
          </View>
        ) : null}
        {command.isError || playCard.isError || nowPlaying.isError ? (
          <Text tone="safety" accessibilityRole="alert">
            {errorText(command.error ?? playCard.error ?? nowPlaying.error)}
          </Text>
        ) : null}
      </View>

      <Text variant="bodySm" style={{ color: p.muted }}>
        {t('music.spotify.askSvaraa')}
      </Text>

      <SpotifyBrowse onPlay={(uri, context) => playCard.mutate({ uri, context })} />

      <Text variant="kicker" style={{ color: p.gold }}>
        {t('music.spotify.devices')}
      </Text>
      {devices.length ? (
        devices.map((d) => (
          <InfoRow
            key={`${d.name}-${d.type}`}
            title={d.name}
            detail={d.type}
            right={d.is_active ? <Pill label={t('music.spotify.active')} tone="plum" /> : undefined}
          />
        ))
      ) : (
        <Text variant="bodySm" style={{ color: p.muted }}>
          {t('music.spotify.noDevices')}
        </Text>
      )}

      {disconnect.isError ? (
        <Text tone="safety" accessibilityRole="alert">
          {errorText(disconnect.error)}
        </Text>
      ) : null}
      <Button
        label={t('music.spotify.disconnect')}
        variant="secondary"
        onPress={() => disconnect.mutate()}
        loading={disconnect.isPending}
        fullWidth
      />
    </MusicScroll>
  );
}

function SpotifyConnectCard({
  height,
  waiting,
  loading,
  error,
  onConnect,
}: {
  height: number;
  waiting: boolean;
  loading: boolean;
  error: string | null;
  onConnect: () => void;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const p = useMainPalette();
  const compact = height < 380;
  const points = [
    t('music.spotify.pointLibrary'),
    t('music.spotify.pointPhone'),
    t('music.spotify.pointChat'),
  ] as const;

  const plumBg = '#5E1A3D';
  const ink = '#FFFFFF';
  const muted = 'rgba(255,255,255,0.78)';
  const tile = 'rgba(255,255,255,0.1)';
  const line = 'rgba(255,255,255,0.18)';
  const logo = compact ? 36 : 48;
  const logoWrap = compact ? 56 : 72;

  return (
    <View
      style={{
        // minHeight, not height: on a phone the content is taller than the pane, and a fixed height with
        // overflow hidden clipped the Connect button at the bottom. The card now grows to fit.
        minHeight: height,
        paddingHorizontal: compact ? 14 : 18,
        paddingTop: compact ? 12 : 16,
        paddingBottom: compact ? 12 : 16,
        borderRadius: 20,
        backgroundColor: plumBg,
        borderWidth: 1,
        borderColor: p.line2,
      }}
    >
      <View style={{ flexGrow: 1, justifyContent: 'space-between', gap: compact ? 8 : 12 }}>
        <View style={{ alignItems: 'center', gap: compact ? 8 : 12 }}>
          <View
            accessibilityLabel={t('music.tabSpotify')}
            style={{
              width: logoWrap,
              height: logoWrap,
              borderRadius: logoWrap / 2,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'rgba(29,185,84,0.16)',
              borderWidth: 1,
              borderColor: 'rgba(29,185,84,0.35)',
            }}
          >
            <SpotifyLogo size={logo} />
          </View>
          <View style={{ gap: 4, alignItems: 'center' }}>
            <Text variant="kicker" style={{ color: SPOTIFY_GREEN }}>
              {t('music.tabSpotify')}
            </Text>
            <Text
              variant={compact ? 'heading' : 'title2'}
              style={{ color: ink, textAlign: 'center', fontWeight: '700' }}
              accessibilityRole="header"
              numberOfLines={2}
            >
              {t('music.spotify.introTitle')}
            </Text>
            <Text
              variant="bodySm"
              style={{ color: muted, textAlign: 'center', lineHeight: 18 }}
              numberOfLines={compact ? 2 : 3}
            >
              {t('music.spotify.introLead')}
            </Text>
          </View>
        </View>

        <View style={{ gap: compact ? 6 : 8, marginVertical: compact ? 8 : 12 }}>
          {points.map((lineText) => (
            <View
              key={lineText}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 10,
                paddingVertical: compact ? 8 : 10,
                paddingHorizontal: 12,
                borderRadius: 14,
                backgroundColor: tile,
                borderWidth: 1,
                borderColor: line,
              }}
            >
              <View
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: SPOTIFY_GREEN,
                }}
              />
              <Text style={{ color: ink, flex: 1 }} numberOfLines={2}>
                {lineText}
              </Text>
            </View>
          ))}
        </View>

        <View style={{ gap: compact ? 8 : 10 }}>
          <View
            style={{
              paddingVertical: 8,
              paddingHorizontal: 12,
              borderRadius: 12,
              backgroundColor: 'rgba(29,185,84,0.12)',
              borderWidth: 1,
              borderColor: 'rgba(29,185,84,0.28)',
            }}
          >
            <Text variant="bodySm" style={{ color: muted }} numberOfLines={2}>
              {t('music.spotify.premiumNote')}
            </Text>
          </View>

          {error ? (
            <Text tone="safety" accessibilityRole="alert" numberOfLines={2}>
              {error}
            </Text>
          ) : null}
          {waiting ? (
            <Text
              variant="bodySm"
              style={{ color: muted, textAlign: 'center' }}
              accessibilityLiveRegion="polite"
              numberOfLines={2}
            >
              {t('music.spotify.waiting')}
            </Text>
          ) : null}

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('music.spotify.connect')}
            accessibilityState={{ disabled: loading, busy: loading }}
            disabled={loading}
            onPress={onConnect}
            style={({ pressed }) => ({
              minHeight: theme.minTarget,
              borderRadius: theme.radius.md,
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'row',
              gap: theme.space[2],
              backgroundColor: pressed || loading ? SPOTIFY_GREEN_PRESSED : SPOTIFY_GREEN,
              opacity: loading ? 0.85 : 1,
            })}
          >
            {loading ? <ActivityIndicator color={SPOTIFY_BLACK} /> : <SpotifyLogo size={22} onGreen />}
            <Text variant="label" style={{ color: SPOTIFY_BLACK, fontWeight: '700' }}>
              {t('music.spotify.connect')}
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
