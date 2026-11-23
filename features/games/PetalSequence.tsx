import { useEffect, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { fitCell, GameButton, Stat, useBest, useBoard, useG, useGamePaneHeight } from '@/features/games/kit';
import { checkTaps, growSequence, PETALS } from '@/features/games/logic';
import { useWide } from '@/features/main/useWide';
import Svg, { Circle, Ellipse } from 'react-native-svg';
import { Text } from '@/ui';

/** A five-petal flower drawn in the middle of a petal button, so it is centred exactly. */
function PetalMark({ size, opacity }: { size: number; opacity: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 40 40" opacity={opacity}>
      {[0, 1, 2, 3, 4].map((i) => (
        <Ellipse
          key={i}
          cx={20}
          cy={10.5}
          rx={5}
          ry={8}
          fill="#FFFFFF"
          transform={`rotate(${i * 72} 20 20)`}
        />
      ))}
      <Circle cx={20} cy={20} r={3.6} fill="#FFD98A" />
    </Svg>
  );
}

const GAP = 10;
const COLS = 2;
const ROWS = 2;
const PETAL_COLOURS = ['#F063AE', '#FFC857', '#4FCB9A', '#8F7BFF'];
const SHOW_MS = 650;
const GAP_MS = 850;

type Phase = 'idle' | 'watch' | 'repeat' | 'ok' | 'lost';

/** Petal Sequence: watch the petals light up, then tap them in the same order. Fits Apps pane, no scroll. */
export function PetalSequence() {
  const G = useG();
  const { t } = useTranslation();
  const wide = useWide();
  const paneH = useGamePaneHeight();
  const board = useBoard(560, COLS, GAP);
  const heightFactor = wide ? 1.05 : 0.85;
  const cell = fitCell(board.cell, ROWS, GAP, Math.floor((paneH - 160) / heightFactor));
  const petalH = Math.round(cell * heightFactor);
  const [seq, setSeq] = useState<number[]>([]);
  const [taps, setTaps] = useState<number[]>([]);
  const [lit, setLit] = useState<number | undefined>();
  const [shown, setShown] = useState(0);
  const [phase, setPhase] = useState<Phase>('idle');
  const [wrong, setWrong] = useState<number | undefined>();
  const record = useBest((s) => s.record);
  const best = useBest((s) => s.best.petals);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const later = (fn: () => void, ms: number) => void timers.current.push(setTimeout(fn, ms));
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const round = Math.max(1, seq.length - 1);

  const begin = (next: number[]) => {
    setSeq(next);
    setTaps([]);
    setWrong(undefined);
    setShown(0);
    setPhase('watch');
    next.forEach((petal, i) => {
      later(
        () => {
          setLit(petal);
          setShown(i + 1);
        },
        800 + i * GAP_MS,
      );
      later(() => setLit(undefined), 800 + i * GAP_MS + SHOW_MS);
    });
    later(() => setPhase('repeat'), 800 + next.length * GAP_MS);
  };

  const tap = (petal: number) => {
    if (phase !== 'repeat') return;
    const next = [...taps, petal];
    setTaps(next);
    setLit(petal);
    later(() => setLit(undefined), 320);
    const r = checkTaps(seq, next);
    if (r === 'wrong') {
      setWrong(petal);
      setPhase('lost');
      record('petals', Math.max(0, round - 1));
      return;
    }
    if (r === 'done') {
      setPhase('ok');
      later(() => begin(growSequence(seq)), 1300);
    }
  };

  const message =
    phase === 'watch'
      ? t('games.petals.watch')
      : phase === 'repeat'
        ? t('games.petals.repeat', { done: taps.length, total: seq.length })
        : phase === 'ok'
          ? t('games.petals.ok')
          : phase === 'lost'
            ? t('games.petals.lost', { count: round - 1 })
            : '';

  return (
    <View
      style={{ height: paneH, alignSelf: 'stretch', width: '100%', overflow: 'hidden' }}
      onLayout={board.onLayout}
    >
      <View
        style={{
          flex: 1,
          width: board.width,
          maxWidth: '100%',
          alignSelf: 'center',
          justifyContent: 'space-between',
          gap: 8,
        }}
      >
        <View style={{ gap: 6 }}>
          {phase === 'idle' ? (
            <>
              <Text style={{ color: G.gold, fontWeight: '700', fontSize: 15 }}>{t('games.howTitle')}</Text>
              <Text style={{ color: G.muted, fontSize: 13 }} numberOfLines={2}>
                {t('games.petals.step1')} {t('games.petals.step2')}
              </Text>
            </>
          ) : null}
          <View style={{ flexDirection: 'row' }}>
            <Stat label={t('games.petals.roundLabel')} value={phase === 'idle' ? 1 : round} />
            <Stat label={t('games.bestLabel')} value={best} />
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 8, minHeight: 16 }}>
            {seq.map((_, i) => {
              const on = phase === 'watch' ? i < shown : i < taps.length;
              return (
                <View
                  key={i}
                  style={{
                    width: 14,
                    height: 14,
                    borderRadius: 7,
                    borderWidth: 2,
                    borderColor: wrong !== undefined && i === taps.length - 1 ? G.bad : G.gold,
                    backgroundColor: on
                      ? wrong !== undefined && i === taps.length - 1
                        ? G.bad
                        : G.gold
                      : 'transparent',
                  }}
                />
              );
            })}
          </View>
          <Text
            style={{
              minHeight: 22,
              textAlign: 'center',
              fontSize: 16,
              fontWeight: '600',
              color: phase === 'lost' ? G.bad : phase === 'ok' ? G.good : G.ink,
            }}
            accessibilityLiveRegion="polite"
            numberOfLines={1}
          >
            {message || ' '}
          </Text>
        </View>

        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            justifyContent: 'center',
            alignContent: 'center',
            gap: GAP,
            flexGrow: 1,
          }}
        >
          {Array.from({ length: PETALS }, (_, i) => {
            const on = lit === i;
            return (
              <Pressable
                key={i}
                accessibilityRole="button"
                accessibilityLabel={t(`games.petals.petalName.${i}`)}
                accessibilityState={{ selected: on }}
                disabled={phase !== 'repeat'}
                onPress={() => tap(i)}
                style={{
                  width: cell,
                  height: petalH,
                  borderRadius: Math.max(18, Math.round(cell * 0.28)),
                  backgroundColor: PETAL_COLOURS[i],
                  opacity: on ? 1 : phase === 'repeat' ? 0.78 : 0.3,
                  borderWidth: on ? 5 : 0,
                  borderColor: G.ring,
                  transform: [{ scale: on ? 1.06 : 1 }],
                  alignItems: 'center',
                  justifyContent: 'center',
                  ...(on ? { shadowColor: PETAL_COLOURS[i], shadowOpacity: 1, shadowRadius: 18 } : null),
                }}
              >
                <PetalMark size={Math.round(cell * 0.42)} opacity={on ? 0.95 : 0.4} />
              </Pressable>
            );
          })}
        </View>

        <View style={{ alignItems: 'center', minHeight: 48, justifyContent: 'center' }}>
          {phase === 'idle' || phase === 'lost' ? (
            <GameButton
              label={phase === 'lost' ? t('games.again') : t('games.start')}
              onPress={() => begin(growSequence([]))}
            />
          ) : null}
        </View>
      </View>
    </View>
  );
}
