import { useEffect, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { GameButton, Stat, Step, useBest, useBoard, useG } from '@/features/games/kit';
import {
  allMatched,
  closeMismatch,
  flip,
  matchScore,
  MATCH_GLYPHS,
  MISS_POINTS,
  needsClosing,
  newDeck,
  PAIR_POINTS,
  type Card,
} from '@/features/games/logic';
import { useWide } from '@/features/main/useWide';
import { Text } from '@/ui';

const GAP = 10;
const GLYPH_COLOURS = ['#F063AE', '#FFC857', '#FF9F6E', '#8FA8FF', '#FF6F91', '#7FE0A6'];
const colourOf = (glyph: string) => GLYPH_COLOURS[MATCH_GLYPHS.indexOf(glyph as never)] ?? GLYPH_COLOURS[1];

/** Memory Match: turn two cards at a time and find the six pairs. Pairs score points, wrong tries cost a few. */
export function MemoryMatch() {
  const G = useG();
  const { t } = useTranslation();
  const wide = useWide();
  const board = useBoard(wide ? 820 : 560, wide ? 4 : 3, GAP);
  const [deck, setDeck] = useState<Card[]>(() => newDeck());
  const [tries, setTries] = useState(0);
  const [note, setNote] = useState<'none' | 'hit' | 'miss'>('none');
  const record = useBest((s) => s.record);
  const best = useBest((s) => s.best.match);
  const recorded = useRef(false);
  const pairs = deck.filter((c) => c.done).length / 2;
  const score = matchScore(pairs, tries);
  const won = allMatched(deck);

  useEffect(() => {
    if (!needsClosing(deck)) return;
    const id = setTimeout(() => setDeck(closeMismatch), 1100);
    return () => clearTimeout(id);
  }, [deck]);
  useEffect(() => {
    if (won && !recorded.current) {
      recorded.current = true;
      record('match', score);
    }
  }, [won, score, record]);

  const tap = (id: number) => {
    const next = flip(deck, id);
    if (next === deck) return;
    setDeck(next);
    if (deck.some((c) => c.open)) {
      // This was the second card of a try.
      setTries((n) => n + 1);
      setNote(next.filter((c) => c.done).length > deck.filter((c) => c.done).length ? 'hit' : 'miss');
    } else setNote('none');
  };
  const again = () => {
    recorded.current = false;
    setDeck(newDeck());
    setTries(0);
    setNote('none');
  };

  return (
    <View style={{ alignItems: 'center' }} onLayout={board.onLayout}>
      <View style={{ width: board.width, gap: 16 }}>
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
          <Step n={1}>{t('games.match.step1')}</Step>
          <Step n={2}>{t('games.match.step2')}</Step>
          <Step n={3}>{t('games.match.step3')}</Step>
          <Text style={{ color: G.muted, fontSize: 15 }}>
            {t('games.match.scoring', { pair: PAIR_POINTS, miss: MISS_POINTS })}
          </Text>
        </View>

        <View style={{ flexDirection: 'row' }}>
          <Stat label={t('games.scoreLabel')} value={score} />
          <Stat label={t('games.match.pairs')} value={`${pairs}/${MATCH_GLYPHS.length}`} />
          <Stat label={t('games.match.tries')} value={tries} />
          <Stat label={t('games.bestLabel')} value={best} />
        </View>

        <Text
          style={{
            minHeight: 24,
            textAlign: 'center',
            fontSize: 17,
            fontWeight: '600',
            color: note === 'hit' ? G.good : G.bad,
          }}
          accessibilityLiveRegion="polite"
        >
          {won
            ? t('games.match.won', { count: score })
            : note === 'hit'
              ? t('games.match.hit', { count: PAIR_POINTS })
              : note === 'miss'
                ? t('games.match.miss', { count: MISS_POINTS })
                : ''}
        </Text>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: GAP }}>
          {deck.map((c) => {
            const shown = c.open || c.done;
            return (
              <Pressable
                key={c.id}
                accessibilityRole="button"
                accessibilityLabel={shown ? c.glyph : t('games.match.card', { n: c.id + 1 })}
                onPress={() => tap(c.id)}
                style={({ pressed }) => ({
                  width: board.cell,
                  height: board.cell,
                  borderRadius: 20,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: c.done ? G.doneBg : shown ? '#FFF6EC' : '#5E1A3D',
                  borderWidth: 2,
                  borderColor: c.done ? G.good : shown ? colourOf(c.glyph) : G.gold,
                  opacity: pressed ? 0.85 : 1,
                  transform: [{ scale: shown && !c.done ? 1.04 : 1 }],
                })}
              >
                <Text
                  style={{
                    fontSize: shown ? 46 : 30,
                    lineHeight: shown ? 56 : 38,
                    color: shown ? (c.done ? G.good : colourOf(c.glyph)) : G.gold,
                    opacity: shown ? 1 : 0.55,
                  }}
                >
                  {shown ? c.glyph : '❀'}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={{ alignItems: 'center' }}>
          <GameButton
            label={won ? t('games.again') : t('games.match.shuffle')}
            onPress={again}
            quiet={!won}
          />
        </View>
      </View>
    </View>
  );
}
