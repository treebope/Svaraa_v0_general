import { useEffect, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { GameButton, Stat, Step, useBest, useBoard, useG } from '@/features/games/kit';
import { checkTaps, growSequence, PETALS } from '@/features/games/logic';
import Svg, { Circle, Ellipse } from 'react-native-svg';
import { useWide } from '@/features/main/useWide';
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

const GAP = 14;
const PETAL_COLOURS = ['#F063AE', '#FFC857', '#4FCB9A', '#8F7BFF'];
const SHOW_MS = 650;
const GAP_MS = 850;

type Phase = 'idle' | 'watch' | 'repeat' | 'ok' | 'lost';

/** Petal Sequence: watch the petals light up, then tap them in the same order. Your own taps light up too. */
export function PetalSequence() {
  const G = useG();
  const { t } = useTranslation();
  const wide = useWide();
  const board = useBoard(wide ? 900 : 560, wide ? 4 : 2, GAP);
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
      record('petals', round - 1);
      setPhase('lost');
    } else if (r === 'done') {
      record('petals', round);
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
    <View style={{ alignItems: 'center' }} onLayout={board.onLayout}>
      <View style={{ width: board.width, gap: 16 }}>
        {phase === 'idle' ? (
          <View
            style={{
              gap: 10,
              padding: 16,
              borderRadius: 20,
              borderWidth: 1,
              borderColor: G.line,
              backgroundColor: G.card,
            }}
          >
            <Text style={{ color: G.gold, fontWeight: '700', fontSize: 17 }}>{t('games.howTitle')}</Text>
            <Step n={1}>{t('games.petals.step1')}</Step>
            <Step n={2}>{t('games.petals.step2')}</Step>
            <Step n={3}>{t('games.petals.step3')}</Step>
          </View>
        ) : null}

        <View style={{ flexDirection: 'row' }}>
          <Stat label={t('games.petals.roundLabel')} value={phase === 'idle' ? 1 : round} />
          <Stat label={t('games.bestLabel')} value={best} />
        </View>

        {/* One dot per petal in the pattern: filled as it is shown, then as you tap it. */}
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 10, minHeight: 20 }}>
          {seq.map((_, i) => {
            const on = phase === 'watch' ? i < shown : i < taps.length;
            return (
              <View
                key={i}
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: 9,
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
            minHeight: 48,
            textAlign: 'center',
            fontSize: 18,
            fontWeight: '600',
            color: phase === 'lost' ? G.bad : phase === 'ok' ? G.good : G.ink,
          }}
          accessibilityLiveRegion="polite"
        >
          {message}
        </Text>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: GAP }}>
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
                  width: board.cell,
                  height: Math.round(board.cell * (wide ? 1.05 : 0.85)),
                  borderRadius: 30,
                  backgroundColor: PETAL_COLOURS[i],
                  opacity: on ? 1 : phase === 'repeat' ? 0.78 : 0.3,
                  borderWidth: on ? 6 : 0,
                  borderColor: G.ring,
                  transform: [{ scale: on ? 1.06 : 1 }],
                  alignItems: 'center',
                  justifyContent: 'center',
                  ...(on ? { shadowColor: PETAL_COLOURS[i], shadowOpacity: 1, shadowRadius: 24 } : null),
                }}
              >
                <PetalMark size={Math.round(board.cell * 0.42)} opacity={on ? 0.95 : 0.4} />
              </Pressable>
            );
          })}
        </View>

        {phase === 'idle' || phase === 'lost' ? (
          <View style={{ alignItems: 'center' }}>
            <GameButton
              label={phase === 'lost' ? t('games.again') : t('games.start')}
              onPress={() => begin(growSequence([]))}
            />
          </View>
        ) : null}
      </View>
    </View>
  );
}
