import { useRef } from 'react';
import { PanResponder, View, type LayoutChangeEvent } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useMainPalette } from '@/features/main/palette';
import { Text } from '@/ui';
import { useMusicPlayer } from './player';

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const s = Math.floor(seconds);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, '0')}`;
}

/** Scrub bar on Now Playing — drag or tap to seek in the current song. */
export function MusicSeekBar() {
  const { t } = useTranslation();
  const p = useMainPalette();
  const position = useMusicPlayer((s) => s.position);
  const duration = useMusicPlayer((s) => s.duration);
  const status = useMusicPlayer((s) => s.status);
  const seek = useMusicPlayer((s) => s.seek);
  const widthRef = useRef(0);

  const disabled = status === 'loading' || status === 'idle' || duration <= 0;
  const progress = duration > 0 ? Math.min(1, Math.max(0, position / duration)) : 0;

  const seekFromX = (x: number) => {
    const w = widthRef.current;
    if (w <= 0 || duration <= 0) return;
    const ratio = Math.min(1, Math.max(0, x / w));
    void seek(ratio * duration);
  };

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !disabled,
      onMoveShouldSetPanResponder: () => !disabled,
      onPanResponderGrant: (e) => seekFromX(e.nativeEvent.locationX),
      onPanResponderMove: (e) => seekFromX(e.nativeEvent.locationX),
    }),
  ).current;

  const onLayout = (e: LayoutChangeEvent) => {
    widthRef.current = e.nativeEvent.layout.width;
  };

  return (
    <View style={{ gap: 6 }} accessibilityLabel={t('music.seekLabel')}>
      <View
        onLayout={onLayout}
        {...pan.panHandlers}
        style={{
          height: 28,
          justifyContent: 'center',
          opacity: disabled ? 0.45 : 1,
        }}
        accessibilityRole="adjustable"
        accessibilityValue={{
          min: 0,
          max: Math.round(duration),
          now: Math.round(position),
          text: `${formatTime(position)} / ${formatTime(duration)}`,
        }}
      >
        <View
          style={{
            height: 6,
            borderRadius: 3,
            backgroundColor: p.seg,
            overflow: 'hidden',
          }}
        >
          <View
            style={{
              width: `${progress * 100}%`,
              height: '100%',
              backgroundColor: p.plum,
              borderRadius: 3,
            }}
          />
        </View>
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: `${progress * 100}%`,
            marginLeft: -8,
            width: 16,
            height: 16,
            borderRadius: 8,
            backgroundColor: p.plum,
            borderWidth: 2,
            borderColor: p.on,
          }}
        />
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text variant="caption" style={{ color: p.muted }}>
          {formatTime(position)}
        </Text>
        <Text variant="caption" style={{ color: p.muted }}>
          {formatTime(duration)}
        </Text>
      </View>
    </View>
  );
}
